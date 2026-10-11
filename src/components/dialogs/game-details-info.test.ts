// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedActionGuard } from '../../app/protected-action-guard';
import { ApiError } from '../../services/api';
import type { GameDetails, GameFavoriteResult } from '../../services/api';
import { createAppSessionController } from '../../services/app-session-controller';
import { APP_SESSION_LIFETIME_MS, APP_SESSION_STORAGE_KEY } from '../../state/app-session';
import type { AppSession } from '../../state/app-session';
import { createAppSessionStore } from '../../state/store';
import { createGameDetailsInfo } from './game-details-info';

const mocks = vi.hoisted(() => ({
  toggleGameFavorite:
    vi.fn<(slug: string, email: string, signal?: AbortSignal) => Promise<GameFavoriteResult>>(),
  logoutFromFirebase: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    toggleGameFavorite: mocks.toggleGameFavorite,
  };
});

vi.mock('../../services/auth', () => ({
  logoutFromFirebase: mocks.logoutFromFirebase,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const now = 1_700_000_000_000;

const session: AppSession = {
  displayName: 'Alex Morgan',
  email: 'alex@example.com',
  authenticatedAt: now,
};

const game: GameDetails = {
  slug: 'chess',
  name: 'Chess',
  heroImage: 'chess.webp',
  rating: 4.8,
  likesCount: 10,
  isLikedByCurrentUser: false,
  fullDescription: 'Chess description.',
  specs: {
    genre: 'Strategy',
    players: '2',
    duration: '30 minutes',
    price: 'Free',
  },
  topRecords: [],
};

async function createFixture(activeSession?: AppSession, gameDetails: GameDetails = game) {
  const store = createAppSessionStore();
  const onExpired = vi.fn();
  const onRequireAuth = vi.fn<(trigger?: HTMLElement) => void>();

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
  });

  if (activeSession) {
    await controller.activate(activeSession);
  }

  const requireSession = createProtectedActionGuard(controller, onRequireAuth);

  const request = new AbortController();

  const element = createGameDetailsInfo(
    gameDetails,
    {
      requireSession,
      getActiveSession: controller.getActiveSession,
    },
    request.signal,
  );

  document.body.append(element);

  const button = element.querySelector<HTMLButtonElement>('.game-dialog__action--favorite');

  if (!button) {
    throw new Error('Favorite button was not found.');
  }

  return {
    element,
    button,
    request,
    controller,
    store,
    onExpired,
    onRequireAuth,
  };
}

function createDeferredResult() {
  const completion: {
    resolve?: (result: GameFavoriteResult) => void;
  } = {};

  const promise = new Promise<GameFavoriteResult>((resolve) => {
    completion.resolve = resolve;
  });

  return { promise, completion };
}

async function waitForCompletion(button: HTMLButtonElement): Promise<void> {
  await vi.waitFor(() => {
    expect(button.getAttribute('aria-busy')).toBe('false');
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);

  mocks.logoutFromFirebase.mockResolvedValue(undefined);
  mocks.toggleGameFavorite.mockResolvedValue({
    isFavorited: true,
    likesCount: 11,
  });

  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

describe('game details favorite action', () => {
  it('allows a Guest click to request auth without sending a POST', async () => {
    const { button, onRequireAuth } = await createFixture();

    expect(button.disabled).toBe(false);

    button.click();

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Please sign in to use this feature.',
      'warning',
    );
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it.each([
    {
      initial: false,
      returned: true,
      likesCount: 11,
      label: 'In Favorites',
      icon: '♥',
      message: 'Added to favorites.',
    },
    {
      initial: true,
      returned: false,
      likesCount: 9,
      label: 'Add to Favorites',
      icon: '♡',
      message: 'Removed from favorites.',
    },
  ])(
    'updates the button and count when the server returns $returned',
    async ({ initial, returned, likesCount, label, icon, message }) => {
      mocks.toggleGameFavorite.mockResolvedValueOnce({
        isFavorited: returned,
        likesCount,
      });

      const { element, button, request } = await createFixture(session, {
        ...game,
        isLikedByCurrentUser: initial,
      });

      expect(button.getAttribute('aria-pressed')).toBe(String(initial));

      button.click();

      await waitForCompletion(button);

      expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
      expect(mocks.toggleGameFavorite).toHaveBeenCalledWith('chess', session.email, request.signal);

      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-pressed')).toBe(String(returned));
      expect(button.getAttribute('aria-label')).toBe(label);
      expect(button.textContent).toContain(label);

      expect(button.querySelector('.game-dialog__favorite-icon')?.textContent).toBe(icon);

      const likesMetric = [
        ...element.querySelectorAll<HTMLSpanElement>('.game-dialog__metric'),
      ].find((metric) => metric.getAttribute('aria-label') === `${likesCount} likes`);

      expect(likesMetric?.textContent).toBe(String(likesCount));

      expect(mocks.showSnackbar).toHaveBeenCalledWith(message, 'success');
    },
  );

  it('blocks repeated clicks while a request is pending', async () => {
    const deferred = createDeferredResult();
    mocks.toggleGameFavorite.mockReturnValueOnce(deferred.promise);

    const { button } = await createFixture(session);

    button.click();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Saving…');

    button.click();

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);

    deferred.completion.resolve?.({
      isFavorited: true,
      likesCount: 11,
    });

    await waitForCompletion(button);

    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('In Favorites');
  });

  it.each([new ApiError(500), new TypeError('Network request failed')])(
    'preserves state after a request error: %s',
    async (error) => {
      mocks.toggleGameFavorite.mockRejectedValueOnce(error);

      const { element, button } = await createFixture(session);

      button.click();

      await waitForCompletion(button);

      expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(button.textContent).toContain('Add to Favorites');
      expect(element.querySelector('[aria-label="10 likes"]')?.textContent).toBe('10');

      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'Could not update favorites. Please try again.',
        'error',
      );

      button.click();

      await waitForCompletion(button);

      expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(2);
      expect(button.getAttribute('aria-pressed')).toBe('true');
    },
  );

  it('requires another explicit click after a Guest authenticates', async () => {
    const { controller, button, onRequireAuth } = await createFixture();

    button.click();

    await controller.activate(session);

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();

    button.click();

    await waitForCompletion(button);

    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('blocks an expired session before sending a POST', async () => {
    const { controller, store, button, onExpired, onRequireAuth } = await createFixture(session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    button.click();

    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onRequireAuth).toHaveBeenCalledWith(button);

    await controller.whenReady();
  });

  it('ignores a late response after the content is aborted', async () => {
    const deferred = createDeferredResult();
    mocks.toggleGameFavorite.mockReturnValueOnce(deferred.promise);

    const { element, button, request } = await createFixture(session);

    button.click();
    request.abort();

    deferred.completion.resolve?.({
      isFavorited: true,
      likesCount: 11,
    });

    await waitForCompletion(button);

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelector('[aria-label="10 likes"]')?.textContent).toBe('10');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
  });

  it('ignores a late response after logout', async () => {
    const deferred = createDeferredResult();
    mocks.toggleGameFavorite.mockReturnValueOnce(deferred.promise);

    const { controller, button } = await createFixture(session);

    button.click();

    await controller.logout();

    deferred.completion.resolve?.({
      isFavorited: true,
      likesCount: 11,
    });

    await waitForCompletion(button);

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
  });

  it('ignores a response from a previous session of the same user', async () => {
    const deferred = createDeferredResult();
    mocks.toggleGameFavorite.mockReturnValueOnce(deferred.promise);

    const { controller, button } = await createFixture(session);

    button.click();

    vi.mocked(Date.now).mockReturnValue(now + 1000);

    await controller.activate({
      ...session,
      authenticatedAt: now + 1000,
    });

    deferred.completion.resolve?.({
      isFavorited: true,
      likesCount: 11,
    });

    await waitForCompletion(button);

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
  });

  it('ignores a response when the session expires during the request', async () => {
    const deferred = createDeferredResult();
    mocks.toggleGameFavorite.mockReturnValueOnce(deferred.promise);

    const { controller, store, button, onExpired } = await createFixture(session);

    button.click();

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    deferred.completion.resolve?.({
      isFavorited: true,
      likesCount: 11,
    });

    await waitForCompletion(button);

    expect(store.getSession()).toBeUndefined();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();

    await controller.whenReady();

    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
  });
});

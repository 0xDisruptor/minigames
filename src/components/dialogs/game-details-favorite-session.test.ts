// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedActionGuard } from '../../app/protected-action-guard';
import type { GameDetails, GameFavoriteResult } from '../../services/api';
import { createAppSessionController } from '../../services/app-session-controller';
import { APP_SESSION_LIFETIME_MS } from '../../state/app-session';
import type { AppSession } from '../../state/app-session';
import { createAppSessionStore } from '../../state/store';
import { createGameDetailsInfo } from './game-details-info';

const mocks = vi.hoisted(() => ({
  getGameDetails:
    vi.fn<
      (slug: string, signal?: AbortSignal, userEmail?: string) => Promise<GameDetails | undefined>
    >(),
  toggleGameFavorite:
    vi.fn<(slug: string, email: string, signal?: AbortSignal) => Promise<GameFavoriteResult>>(),
  logoutFromFirebase: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getGameDetails: mocks.getGameDetails,
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

const requests: AbortController[] = [];

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
  } = {};

  const promise = new Promise<T>((resolve) => {
    completion.resolve = resolve;
  });

  return { promise, completion };
}

async function createFixture(
  activeSession?: AppSession,
  gameDetails: GameDetails = game,
  shouldUseLoadedSession = true,
) {
  const store = createAppSessionStore();
  const onExpired = vi.fn();
  const onRequireAuth = vi.fn<(trigger?: HTMLElement) => void>();
  const unsubscribe = vi.fn();

  const originalSubscribe = store.subscribe;

  vi.spyOn(store, 'subscribe').mockImplementation((listener) => {
    const stop = originalSubscribe(listener);

    return (): void => {
      unsubscribe();
      stop();
    };
  });

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
  });

  if (activeSession) {
    await controller.activate(activeSession);
  }

  const loadedSession = controller.getActiveSession();

  const requireSession = createProtectedActionGuard(controller, onRequireAuth);

  const request = new AbortController();
  requests.push(request);

  const element = createGameDetailsInfo(
    gameDetails,
    {
      requireSession,
      getActiveSession: controller.getActiveSession,
      sessionStore: store,
      ...(shouldUseLoadedSession && loadedSession && { loadedSession }),
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
    unsubscribe,
  };
}

function getLikesText(element: HTMLElement, count: number): string | undefined {
  return [...element.querySelectorAll<HTMLSpanElement>('.game-dialog__metric')].find(
    (metric) => metric.getAttribute('aria-label') === `${count} likes`,
  )?.textContent;
}

async function waitForLikes(element: HTMLElement, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(getLikesText(element, count)).toBe(String(count));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);

  mocks.logoutFromFirebase.mockResolvedValue(undefined);

  mocks.getGameDetails.mockResolvedValue({
    ...game,
    likesCount: 15,
  });

  mocks.toggleGameFavorite.mockResolvedValue({
    isFavorited: false,
    likesCount: 10,
  });

  localStorage.clear();
});

afterEach(() => {
  for (const request of requests) {
    request.abort();
  }

  requests.length = 0;

  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

describe('game favorite session updates', () => {
  it('uses the initial personalized snapshot without another GET', async () => {
    const { button } = await createFixture(session, {
      ...game,
      isLikedByCurrentUser: true,
    });

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(mocks.getGameDetails).not.toHaveBeenCalled();
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
  });

  it('loads personal state after login without replaying a Guest action', async () => {
    const pending = createDeferred<GameDetails | undefined>();
    mocks.getGameDetails.mockReturnValueOnce(pending.promise);

    const { controller, element, button, onRequireAuth } = await createFixture();

    const originalTitle = element.querySelector('h2');
    const originalDescription = element.querySelector('.game-dialog__description');

    button.click();

    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();

    await controller.activate(session);

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getGameDetails).toHaveBeenCalledWith(
      'chess',
      expect.any(AbortSignal),
      session.email,
    );

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Loading…');
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();

    pending.completion.resolve?.({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 11,
    });

    await waitForLikes(element, 11);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(element.querySelector('h2')).toBe(originalTitle);
    expect(element.querySelector('.game-dialog__description')).toBe(originalDescription);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
  });

  it('resets the heart immediately and fetches public data after logout', async () => {
    const pending = createDeferred<GameDetails | undefined>();
    mocks.getGameDetails.mockReturnValueOnce(pending.promise);

    const { controller, element, button } = await createFixture(session, {
      ...game,
      isLikedByCurrentUser: true,
    });

    const logout = controller.logout();

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.disabled).toBe(false);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getGameDetails.mock.calls[0]?.[2]).toBeUndefined();

    await logout;

    pending.completion.resolve?.({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 9,
    });

    await waitForLikes(element, 9);

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
  });

  it('updates public state when the session expires', async () => {
    const { controller, element, button, store, onExpired } = await createFixture(session, {
      ...game,
      isLikedByCurrentUser: true,
    });

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    expect(controller.getActiveSession()).toBeUndefined();
    expect(store.getSession()).toBeUndefined();
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await controller.whenReady();
    await waitForLikes(element, 15);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getGameDetails.mock.calls[0]?.[2]).toBeUndefined();
    expect(button.disabled).toBe(false);
  });

  it('ignores an old personal GET after switching users', async () => {
    const pending = createDeferred<GameDetails | undefined>();

    mocks.getGameDetails.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 50,
    });

    const { controller, element, button } = await createFixture();

    await controller.activate(session);

    const firstSignal = mocks.getGameDetails.mock.calls[0]?.[1];

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    await waitForLikes(element, 50);

    expect(firstSignal?.aborted).toBe(true);
    expect(mocks.getGameDetails.mock.calls[1]?.[2]).toBe('taylor@example.com');

    pending.completion.resolve?.({
      ...game,
      isLikedByCurrentUser: false,
      likesCount: 1,
    });

    await pending.promise;

    expect(getLikesText(element, 50)).toBe('50');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
  });

  it('cancels a pending POST on logout and ignores its late response', async () => {
    const pending = createDeferred<GameFavoriteResult>();
    mocks.toggleGameFavorite.mockReturnValueOnce(pending.promise);

    const { controller, element, button } = await createFixture(session);

    button.click();

    const mutationSignal = mocks.toggleGameFavorite.mock.calls[0]?.[2];

    expect(button.disabled).toBe(true);

    await controller.logout();
    await waitForLikes(element, 15);

    expect(mutationSignal?.aborted).toBe(true);
    expect(button.disabled).toBe(false);

    pending.completion.resolve?.({
      isFavorited: true,
      likesCount: 999,
    });

    await pending.promise;

    expect(getLikesText(element, 15)).toBe('15');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('retries a failed personal GET without sending a POST', async () => {
    mocks.getGameDetails.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 11,
    });

    const { controller, element, button } = await createFixture();

    await controller.activate(session);

    await vi.waitFor(() => {
      expect(button.getAttribute('aria-label')).toBe('Retry Favorites');
    });

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Could not load favorites. Please try again.',
      'error',
    );

    button.click();

    await waitForLikes(element, 11);

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();

    await waitForLikes(element, 10);

    expect(mocks.toggleGameFavorite).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('offers a retry when personal game details are missing', async () => {
    mocks.getGameDetails.mockResolvedValueOnce(undefined);

    const { controller, button } = await createFixture();

    await controller.activate(session);

    await vi.waitFor(() => {
      expect(button.getAttribute('aria-label')).toBe('Retry Favorites');
    });

    expect(button.disabled).toBe(false);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Could not load favorites. Please try again.',
      'error',
    );
  });

  it('cancels a personal GET and unsubscribes when content is closed', async () => {
    const pending = createDeferred<GameDetails | undefined>();
    mocks.getGameDetails.mockReturnValueOnce(pending.promise);

    const { controller, element, button, request, unsubscribe } = await createFixture();

    await controller.activate(session);

    const personalSignal = mocks.getGameDetails.mock.calls[0]?.[1];

    request.abort();
    request.abort();

    expect(personalSignal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    await controller.activate({
      ...session,
      email: 'taylor@example.com',
    });

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);

    pending.completion.resolve?.({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 99,
    });

    await pending.promise;

    expect(getLikesText(element, 10)).toBe('10');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('refreshes a Guest snapshot if authentication finished during loading', async () => {
    mocks.getGameDetails.mockResolvedValueOnce({
      ...game,
      isLikedByCurrentUser: true,
      likesCount: 20,
    });

    const { element, button } = await createFixture(session, game, false);

    await waitForLikes(element, 20);

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getGameDetails.mock.calls[0]?.[2]).toBe(session.email);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.toggleGameFavorite).not.toHaveBeenCalled();
  });
});

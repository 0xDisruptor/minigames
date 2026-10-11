// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedActionGuard } from '../../app/protected-action-guard';
import { ApiError } from '../../services/api';
import type { GameComment, GameCommentLikeResult } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import { createGameCommentLikeButton } from './game-comment-like';

const mocks = vi.hoisted(() => ({
  toggleCommentLike:
    vi.fn<
      (commentId: string, userEmail: string, signal?: AbortSignal) => Promise<GameCommentLikeResult>
    >(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    toggleCommentLike: mocks.toggleCommentLike,
  };
});

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const session: AppSession = {
  displayName: 'Alex',
  email: 'alex@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const comment: GameComment = {
  commentId: 'comment-1',
  authorName: 'Alex',
  text: 'A good game.',
  createdAt: '2023-11-14T12:00:00.000Z',
  likesCount: 10,
  isLikedByCurrentUser: false,
};

const lifetimes: AbortController[] = [];

interface FixtureOptions {
  readonly isGuest?: boolean;
  readonly isInitiallyLiked?: boolean;
  readonly shouldSupportRefresh?: boolean;
  readonly shouldStartDisposed?: boolean;
}

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
    reject?: (reason: unknown) => void;
  } = {};

  const promise = new Promise<T>((resolve, reject) => {
    completion.resolve = resolve;
    completion.reject = reject;
  });

  return { promise, completion };
}

function createFixture(options: FixtureOptions = {}) {
  const state: { session: AppSession | undefined } = {
    session: options.isGuest ? undefined : session,
  };

  const getActiveSession = vi.fn(() => state.session);
  const onRequireAuth = vi.fn<(trigger?: HTMLElement) => void>();
  const onRefreshComments = vi.fn();

  const requireSession = vi.fn(createProtectedActionGuard({ getActiveSession }, onRequireAuth));

  const lifetime = new AbortController();
  lifetimes.push(lifetime);

  if (options.shouldStartDisposed) {
    lifetime.abort();
  }

  const button = createGameCommentLikeButton(
    {
      ...comment,
      isLikedByCurrentUser: options.isInitiallyLiked ?? false,
    },
    {
      getActiveSession,
      requireSession,
      ...(state.session && { loadedSession: state.session }),
      ...(options.shouldSupportRefresh !== false && {
        onRefreshComments,
      }),
    },
    lifetime.signal,
  );

  document.body.append(button);

  return {
    button,
    state,
    lifetime,
    requireSession,
    onRequireAuth,
    onRefreshComments,
  };
}

function getCount(button: HTMLButtonElement): string | undefined {
  return button.querySelector('.game-comments__likes-count')?.textContent;
}

function getHeart(button: HTMLButtonElement): string | undefined {
  return button.querySelector('.game-comments__heart')?.textContent;
}

async function waitUntilIdle(button: HTMLButtonElement): Promise<void> {
  await vi.waitFor(() => {
    expect(button.getAttribute('aria-busy')).toBe('false');
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.toggleCommentLike.mockResolvedValue({
    isLikedByCurrentUser: true,
    likesCount: 12,
  });
});

afterEach(() => {
  for (const lifetime of lifetimes) {
    lifetime.abort();
  }

  lifetimes.length = 0;
  document.body.replaceChildren();
});

describe('createGameCommentLikeButton', () => {
  it('initializes the personal state from the loaded session snapshot', () => {
    const { button } = createFixture({ isInitiallyLiked: true });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(getHeart(button)).toBe('♥');
    expect(getCount(button)).toBe('10');
  });

  it('clears personal like state for a guest but keeps the button available', () => {
    const { button } = createFixture({
      isGuest: true,
      isInitiallyLiked: true,
    });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(getHeart(button)).toBe('♡');
    expect(getCount(button)).toBe('10');
  });

  it('disables the button when action callbacks are missing', () => {
    const button = createGameCommentLikeButton(comment);

    button.click();

    expect(button.disabled).toBe(true);
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();
  });

  it('opens authentication and warns a guest without sending a POST', () => {
    const { button, onRequireAuth } = createFixture({ isGuest: true });

    button.click();

    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Please sign in to use this feature.',
      'warning',
    );
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();
    expect(getCount(button)).toBe('10');
  });

  it('does not replay a guest action after authentication', async () => {
    const { button, state } = createFixture({ isGuest: true });

    button.click();
    state.session = session;

    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();

    button.click();
    await waitUntilIdle(button);

    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('sends the active session email and uses both server response fields', async () => {
    const { button, requireSession } = createFixture();

    mocks.toggleCommentLike
      .mockResolvedValueOnce({
        isLikedByCurrentUser: true,
        likesCount: 23,
      })
      .mockResolvedValueOnce({
        isLikedByCurrentUser: false,
        likesCount: 4,
      });

    button.click();
    await waitUntilIdle(button);

    expect(requireSession).toHaveBeenCalledWith(button);
    expect(mocks.toggleCommentLike).toHaveBeenCalledWith(
      comment.commentId,
      session.email,
      expect.any(AbortSignal),
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(getHeart(button)).toBe('♥');
    expect(getCount(button)).toBe('23');
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Comment liked.', 'success');

    button.click();
    await waitUntilIdle(button);

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(getHeart(button)).toBe('♡');
    expect(getCount(button)).toBe('4');
    expect(mocks.toggleCommentLike).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Comment like removed.', 'success');
  });

  it('locks the button and prevents duplicate toggles while pending', async () => {
    const { button } = createFixture();
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(getHeart(button)).toBe('♡');
    expect(getCount(button)).toBe('…');

    button.click();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 27,
    });

    await waitUntilIdle(button);

    expect(button.disabled).toBe(false);
    expect(getCount(button)).toBe('27');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it.each([403, 422, 429])(
    'keeps the previous state after HTTP %s and allows a manual retry',
    async (status) => {
      const { button, onRefreshComments } = createFixture();

      mocks.toggleCommentLike.mockRejectedValueOnce(new ApiError(status));

      button.click();
      await waitUntilIdle(button);

      expect(button.disabled).toBe(false);
      expect(getCount(button)).toBe('10');
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(onRefreshComments).not.toHaveBeenCalled();
      expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'Could not update the comment like. Please try again.',
        'error',
      );

      button.click();
      await waitUntilIdle(button);

      expect(mocks.toggleCommentLike).toHaveBeenCalledTimes(2);
      expect(getCount(button)).toBe('12');
    },
  );

  it.each([
    ['timeout', new ApiError(408)],
    ['server failure', new ApiError(500)],
    ['network failure', new TypeError('Connection lost')],
    ['invalid response', new Error('Invalid comment like response')],
  ])('refreshes instead of repeating the POST after an unknown %s', async (_label, error) => {
    const { button, onRefreshComments } = createFixture();

    mocks.toggleCommentLike.mockRejectedValueOnce(error);

    button.click();
    await waitUntilIdle(button);

    expect(getCount(button)).toBe('10');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('Reload comments');
    expect(onRefreshComments).not.toHaveBeenCalled();
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'The like result is unknown. Reload comments to check its state before trying again.',
      'error',
    );

    button.click();

    expect(onRefreshComments).toHaveBeenCalledOnce();
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
  });

  it('disables an uncertain button if no refresh callback is provided', async () => {
    const { button } = createFixture({ shouldSupportRefresh: false });

    mocks.toggleCommentLike.mockRejectedValueOnce(new TypeError('Connection lost'));

    button.click();
    await waitUntilIdle(button);

    expect(button.disabled).toBe(true);
    expect(getCount(button)).toBe('10');

    button.click();

    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
  });

  it('checks the session again before refreshing uncertain state', async () => {
    const { button, state, onRequireAuth, onRefreshComments } = createFixture();

    mocks.toggleCommentLike.mockRejectedValueOnce(new TypeError('Connection lost'));

    button.click();
    await waitUntilIdle(button);

    state.session = undefined;
    button.click();

    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(onRefreshComments).not.toHaveBeenCalled();
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
  });

  it('ignores a result from a session that is no longer active', async () => {
    const { button, state } = createFixture();
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    state.session = {
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    };

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 999,
    });

    await waitUntilIdle(button);

    expect(getCount(button)).toBe('10');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('aborts a pending request and ignores its late success on disposal', async () => {
    const { button, lifetime } = createFixture();
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    lifetime.abort();

    expect(signal?.aborted).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('false');

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 999,
    });

    await pending.promise;

    expect(getCount(button)).toBe('10');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('ignores a late error after disposal', async () => {
    const { button, lifetime, onRefreshComments } = createFixture();
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();
    lifetime.abort();

    pending.completion.reject?.(new TypeError('Connection lost'));

    await expect(pending.promise).rejects.toThrow('Connection lost');

    expect(button.disabled).toBe(true);
    expect(getCount(button)).toBe('10');
    expect(onRefreshComments).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('starts disabled when its lifetime has already ended', () => {
    const { button } = createFixture({ shouldStartDisposed: true });

    button.click();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(button.disabled).toBe(true);
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();
  });
});

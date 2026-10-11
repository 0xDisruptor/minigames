// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedActionGuard } from '../../app/protected-action-guard';
import type { GameComment, GameCommentLikeResult, GameCommentsResponse } from '../../services/api';
import { createAppSessionController } from '../../services/app-session-controller';
import { APP_SESSION_LIFETIME_MS } from '../../state/app-session';
import type { AppSession } from '../../state/app-session';
import { createAppSessionStore } from '../../state/store';
import { createGameDetailsComments } from './game-details-comment';

const mocks = vi.hoisted(() => ({
  getGameComments:
    vi.fn<
      (slug: string, signal?: AbortSignal, userEmail?: string) => Promise<GameCommentsResponse>
    >(),
  toggleCommentLike:
    vi.fn<
      (commentId: string, userEmail: string, signal?: AbortSignal) => Promise<GameCommentLikeResult>
    >(),
  logoutFromFirebase: vi.fn<() => Promise<void>>(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getGameComments: mocks.getGameComments,
    toggleCommentLike: mocks.toggleCommentLike,
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
  displayName: 'Alex',
  email: 'alex@example.com',
  authenticatedAt: now,
};

const comment: GameComment = {
  commentId: 'comment-1',
  authorName: 'Alex',
  text: 'A good game.',
  createdAt: '2023-11-14T12:00:00.000Z',
  likesCount: 10,
  isLikedByCurrentUser: false,
};

const mountedComments: ReturnType<typeof createGameDetailsComments>[] = [];

function createResponse(
  overrides: Partial<GameComment> = {},
  totalComments = 1,
): GameCommentsResponse {
  return {
    data: [{ ...comment, ...overrides }],
    meta: { totalComments },
  };
}

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
  } = {};

  const promise = new Promise<T>((resolve) => {
    completion.resolve = resolve;
  });

  return { promise, completion };
}

function getLikeButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.game-comments__like');

  if (!button) {
    throw new Error('Comment like button is missing.');
  }

  return button;
}

function getRetryButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.feedback-state__retry');

  if (!button) {
    throw new Error('Comments retry button is missing.');
  }

  return button;
}

function getCount(element: HTMLElement): string | undefined {
  return element.querySelector('.game-comments__likes-count')?.textContent;
}

async function waitForCount(element: HTMLElement, count: number): Promise<void> {
  await vi.waitFor(() => {
    expect(getCount(element)).toBe(String(count));
    expect(getLikeButton(element).getAttribute('aria-busy')).toBe('false');
  });
}

async function waitForUnknownResult(button: HTMLButtonElement): Promise<void> {
  await vi.waitFor(() => {
    expect(button.getAttribute('aria-label')).toContain('Reload comments');
    expect(button.getAttribute('aria-busy')).toBe('false');
  });
}

async function createFixture(activeSession?: AppSession) {
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

  const comments = createGameDetailsComments({
    getActiveSession: controller.getActiveSession,
    requireSession: createProtectedActionGuard(controller, onRequireAuth),
    sessionStore: store,
  });

  mountedComments.push(comments);
  document.body.append(comments.element);

  await comments.load('chess');

  const textarea = comments.element.querySelector<HTMLTextAreaElement>('textarea');

  if (!textarea) {
    throw new Error('Comment textarea is missing.');
  }

  return {
    comments,
    textarea,
    button: getLikeButton(comments.element),
    controller,
    store,
    onExpired,
    onRequireAuth,
    unsubscribe,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);

  mocks.logoutFromFirebase.mockResolvedValue(undefined);
  mocks.getGameComments.mockResolvedValue(createResponse());
  mocks.toggleCommentLike.mockResolvedValue({
    isLikedByCurrentUser: true,
    likesCount: 12,
  });

  localStorage.clear();
});

afterEach(() => {
  for (const comments of mountedComments) {
    comments.reset();
  }

  mountedComments.length = 0;

  vi.restoreAllMocks();
  localStorage.clear();
  document.body.replaceChildren();
});

describe('comment likes in the comments view', () => {
  it('initializes buttons from the personalized GET response', async () => {
    mocks.getGameComments.mockResolvedValueOnce(createResponse({ isLikedByCurrentUser: true }));

    const { button } = await createFixture(session);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(mocks.getGameComments).toHaveBeenCalledWith(
      'chess',
      expect.any(AbortSignal),
      session.email,
    );
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();
  });

  it('opens authentication for a guest and does not replay the like after login', async () => {
    const { comments, button, controller, onRequireAuth } = await createFixture();

    button.click();

    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Please sign in to use this feature.',
      'warning',
    );
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse({
        isLikedByCurrentUser: true,
        likesCount: 11,
      }),
    );

    await controller.activate(session);
    await waitForCount(comments.element, 11);

    const personalButton = getLikeButton(comments.element);

    expect(button.disabled).toBe(true);
    expect(personalButton).not.toBe(button);
    expect(personalButton.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe(session.email);
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();

    mocks.toggleCommentLike.mockResolvedValueOnce({
      isLikedByCurrentUser: false,
      likesCount: 4,
    });

    personalButton.click();
    await waitForCount(comments.element, 4);

    expect(mocks.toggleCommentLike).toHaveBeenCalledWith(
      comment.commentId,
      session.email,
      expect.any(AbortSignal),
    );
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(personalButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('blocks a like at the exact session expiration boundary', async () => {
    mocks.getGameComments.mockResolvedValueOnce(createResponse({ isLikedByCurrentUser: true }));

    const { comments, textarea, button, controller, store, onExpired, onRequireAuth } =
      await createFixture(session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    button.click();

    await controller.whenReady();
    await waitForCount(comments.element, 10);

    expect(store.getSession()).toBeUndefined();
    expect(onExpired).toHaveBeenCalledOnce();
    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.toggleCommentLike).not.toHaveBeenCalled();
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBeUndefined();
    expect(textarea.disabled).toBe(true);

    const guestButton = getLikeButton(comments.element);

    expect(guestButton.getAttribute('aria-pressed')).toBe('false');
    expect(guestButton.disabled).toBe(false);
  });

  it('cancels a pending like when the session expires', async () => {
    const { comments, button, controller } = await createFixture(session);
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    expect(controller.getActiveSession()).toBeUndefined();

    await controller.whenReady();
    await waitForCount(comments.element, 10);

    expect(signal?.aborted).toBe(true);

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 999,
    });

    await pending.promise;
    await Promise.resolve();

    expect(getCount(comments.element)).toBe('10');
    expect(getLikeButton(comments.element).getAttribute('aria-pressed')).toBe('false');
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment liked.', 'success');
  });

  it('cancels a pending like on logout and applies public comment state', async () => {
    const { comments, button, controller } = await createFixture(session);
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse({
        isLikedByCurrentUser: true,
        likesCount: 7,
      }),
    );

    await controller.logout();
    await waitForCount(comments.element, 7);

    expect(signal?.aborted).toBe(true);
    expect(button.disabled).toBe(true);
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBeUndefined();

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 999,
    });

    await pending.promise;
    await Promise.resolve();

    expect(getCount(comments.element)).toBe('7');
    expect(getLikeButton(comments.element).getAttribute('aria-pressed')).toBe('false');
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment liked.', 'success');
  });

  it('ignores a pending like from the previous user', async () => {
    const { comments, button, controller } = await createFixture(session);
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse(
        {
          isLikedByCurrentUser: true,
          likesCount: 50,
        },
        99,
      ),
    );

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    await waitForCount(comments.element, 50);

    expect(signal?.aborted).toBe(true);
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe('taylor@example.com');

    pending.completion.resolve?.({
      isLikedByCurrentUser: false,
      likesCount: 1,
    });

    await pending.promise;
    await Promise.resolve();

    expect(getCount(comments.element)).toBe('50');
    expect(getLikeButton(comments.element).getAttribute('aria-pressed')).toBe('true');
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment like removed.', 'success');
  });

  it('reconciles an unknown result with GET before allowing another toggle', async () => {
    const { comments, button } = await createFixture(session);

    mocks.toggleCommentLike
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce({
        isLikedByCurrentUser: false,
        likesCount: 3,
      });

    button.click();
    await waitForUnknownResult(button);

    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(mocks.getGameComments).toHaveBeenCalledOnce();

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse(
        {
          isLikedByCurrentUser: true,
          likesCount: 40,
        },
        12,
      ),
    );

    button.click();
    await waitForCount(comments.element, 40);

    const refreshedButton = getLikeButton(comments.element);

    expect(button.disabled).toBe(true);
    expect(refreshedButton).not.toBe(button);
    expect(refreshedButton.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Comments loaded successfully.', 'success');

    refreshedButton.click();
    await waitForCount(comments.element, 3);

    expect(mocks.toggleCommentLike).toHaveBeenCalledTimes(2);
    expect(refreshedButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('retries a failed reconciliation GET without another POST or draft loss', async () => {
    const { comments, textarea, button } = await createFixture(session);

    textarea.value = 'Keep my draft';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    mocks.toggleCommentLike.mockRejectedValueOnce(new TypeError('Connection lost'));

    button.click();
    await waitForUnknownResult(button);

    mocks.getGameComments.mockRejectedValueOnce(new TypeError('Comments GET failed'));

    button.click();

    await vi.waitFor(() => {
      expect(comments.element.querySelector('.feedback-state--error')).toBeTruthy();
    });

    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe('Keep my draft');

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse({
        isLikedByCurrentUser: true,
        likesCount: 15,
      }),
    );

    getRetryButton(comments.element).click();
    await waitForCount(comments.element, 15);

    expect(mocks.getGameComments).toHaveBeenCalledTimes(3);
    expect(mocks.toggleCommentLike).toHaveBeenCalledOnce();
    expect(textarea.value).toBe('Keep my draft');
    expect(getLikeButton(comments.element).getAttribute('aria-pressed')).toBe('true');
  });

  it('cancels old buttons when the same comments list is refreshed', async () => {
    const { comments, button } = await createFixture(session);
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse({
        isLikedByCurrentUser: true,
        likesCount: 30,
      }),
    );

    await comments.load('chess');

    expect(signal?.aborted).toBe(true);
    expect(button.disabled).toBe(true);
    expect(getCount(comments.element)).toBe('30');

    pending.completion.resolve?.({
      isLikedByCurrentUser: false,
      likesCount: 999,
    });

    await pending.promise;
    await Promise.resolve();

    expect(getCount(comments.element)).toBe('30');
    expect(getLikeButton(comments.element).getAttribute('aria-pressed')).toBe('true');
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment like removed.', 'success');
  });

  it('cancels pending likes and unsubscribes when comments are reset', async () => {
    const { comments, button, controller, unsubscribe } = await createFixture(session);
    const pending = createDeferred<GameCommentLikeResult>();

    mocks.toggleCommentLike.mockReturnValueOnce(pending.promise);

    button.click();

    const signal = mocks.toggleCommentLike.mock.calls[0]?.[2];

    comments.reset();

    expect(signal?.aborted).toBe(true);
    expect(button.disabled).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    pending.completion.resolve?.({
      isLikedByCurrentUser: true,
      likesCount: 999,
    });

    await pending.promise;
    await Promise.resolve();

    expect(mocks.getGameComments).toHaveBeenCalledOnce();
    expect(comments.element.querySelector('.game-comments__like')).toBeNull();
    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments');
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment liked.', 'success');
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProtectedActionGuard } from '../../app/protected-action-guard';
import type { CreateGameCommentInput, GameComment, GameCommentsResponse } from '../../services/api';
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
  createGameComment:
    vi.fn<
      (slug: string, input: CreateGameCommentInput, signal?: AbortSignal) => Promise<GameComment>
    >(),
  logoutFromFirebase: vi.fn<() => Promise<void>>(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getGameComments: mocks.getGameComments,
    createGameComment: mocks.createGameComment,
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
  likesCount: 3,
  isLikedByCurrentUser: true,
};

const mountedComments: ReturnType<typeof createGameDetailsComments>[] = [];

function createResponse(totalComments = 1): GameCommentsResponse {
  return {
    data: [comment],
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

  const form = comments.element.querySelector<HTMLFormElement>('form');
  const textarea = comments.element.querySelector<HTMLTextAreaElement>('textarea');
  const button = comments.element.querySelector<HTMLButtonElement>('.game-comments__submit');

  if (!form || !textarea || !button) {
    throw new Error('Comment form controls are missing.');
  }

  return {
    comments,
    form,
    textarea,
    button,
    controller,
    store,
    onExpired,
    onRequireAuth,
    unsubscribe,
  };
}

function enterText(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function waitForComments(element: HTMLElement, totalComments: number): Promise<void> {
  await vi.waitFor(() => {
    expect(element.querySelector('h3')?.textContent).toBe(`Comments (${totalComments})`);
    expect(element.querySelector('.game-comments__results')?.getAttribute('aria-busy')).toBe(
      'false',
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);

  mocks.logoutFromFirebase.mockResolvedValue(undefined);
  mocks.getGameComments.mockResolvedValue(createResponse());
  mocks.createGameComment.mockResolvedValue(comment);

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

describe('game comments session lifecycle', () => {
  it('requires authentication without replaying the guest submission after login', async () => {
    const { comments, form, textarea, button, controller, onRequireAuth } = await createFixture();

    enterText(textarea, 'My draft');
    submitForm(form);

    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Please sign in to use this feature.',
      'warning',
    );
    expect(mocks.createGameComment).not.toHaveBeenCalled();

    await controller.activate(session);
    await waitForComments(comments.element, 1);

    expect(textarea.disabled).toBe(false);
    expect(textarea.value).toBe('My draft');
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe(session.email);
    expect(mocks.createGameComment).not.toHaveBeenCalled();

    button.click();

    await vi.waitFor(() => {
      expect(textarea.value).toBe('');
    });

    expect(mocks.createGameComment).toHaveBeenCalledOnce();
  });

  it('blocks a POST exactly at the five-minute expiration boundary', async () => {
    const { comments, textarea, button, controller, store, onExpired, onRequireAuth } =
      await createFixture(session);

    enterText(textarea, 'My draft');

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    button.click();

    await controller.whenReady();
    await waitForComments(comments.element, 1);

    expect(store.getSession()).toBeUndefined();
    expect(onExpired).toHaveBeenCalledOnce();
    expect(onRequireAuth).toHaveBeenCalledWith(button);
    expect(mocks.createGameComment).not.toHaveBeenCalled();
    expect(textarea.disabled).toBe(true);
    expect(textarea.value).toBe('My draft');
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBeUndefined();

    expect(
      comments.element.querySelector('.game-comments__like')?.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('aborts a pending POST when the active session expires', async () => {
    const { comments, textarea, button, controller } = await createFixture(session);
    const pending = createDeferred<GameComment>();

    mocks.createGameComment.mockReturnValueOnce(pending.promise);

    enterText(textarea, 'Keep my draft');
    button.click();

    const signal = mocks.createGameComment.mock.calls[0]?.[2];

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    expect(controller.getActiveSession()).toBeUndefined();

    await controller.whenReady();
    await waitForComments(comments.element, 1);

    expect(signal?.aborted).toBe(true);
    expect(textarea.disabled).toBe(true);

    pending.completion.resolve?.(comment);
    await pending.promise;
    await Promise.resolve();

    expect(textarea.value).toBe('Keep my draft');
    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);
    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment posted successfully.', 'success');
  });

  it('ignores a personal GET from the previous user', async () => {
    const { comments, controller } = await createFixture();
    const pending = createDeferred<GameCommentsResponse>();

    mocks.getGameComments
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(createResponse(99));

    await controller.activate(session);

    const oldSignal = mocks.getGameComments.mock.calls[1]?.[1];

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    await waitForComments(comments.element, 99);

    expect(oldSignal?.aborted).toBe(true);
    expect(mocks.getGameComments.mock.calls[2]?.[2]).toBe('taylor@example.com');

    pending.completion.resolve?.(createResponse(7));
    await pending.promise;
    await Promise.resolve();

    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (99)');
    expect(mocks.createGameComment).not.toHaveBeenCalled();
  });

  it('cancels a pending GET and unsubscribes when comments are reset', async () => {
    const { comments, controller, unsubscribe } = await createFixture(session);
    const pending = createDeferred<GameCommentsResponse>();

    mocks.getGameComments.mockReturnValueOnce(pending.promise);

    const loading = comments.load('chess');
    const signal = mocks.getGameComments.mock.calls[1]?.[1];

    comments.reset();

    expect(signal?.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);

    pending.completion.resolve?.(createResponse(999));
    await loading;

    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments');
    expect(comments.element.querySelector('.game-comments__results')?.childElementCount).toBe(0);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('cancels a pending POST on reset and opens again with an empty draft', async () => {
    const { comments, textarea, button, controller } = await createFixture(session);
    const pending = createDeferred<GameComment>();

    mocks.createGameComment.mockReturnValueOnce(pending.promise);

    enterText(textarea, 'Old draft');
    button.click();

    const signal = mocks.createGameComment.mock.calls[0]?.[2];

    comments.reset();

    expect(signal?.aborted).toBe(true);
    expect(textarea.value).toBe('');

    await controller.activate({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    pending.completion.resolve?.(comment);
    await pending.promise;
    await Promise.resolve();

    expect(textarea.value).toBe('');
    expect(mocks.getGameComments).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment posted successfully.', 'success');

    await comments.load('chess');

    expect(textarea.value).toBe('');
    expect(textarea.disabled).toBe(false);
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe('taylor@example.com');
    expect(comments.element.querySelector('.game-comments__avatar--user')?.textContent).toBe('T');
  });
});

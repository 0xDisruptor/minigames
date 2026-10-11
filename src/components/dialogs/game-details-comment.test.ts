// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProtectedActionGuard } from '../../app/protected-action-guard';
import { ApiError } from '../../services/api';
import type { CreateGameCommentInput, GameComment, GameCommentsResponse } from '../../services/api';
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

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const session: AppSession = {
  displayName: 'Alex',
  email: 'alex+games@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const comment: GameComment = {
  commentId: 'comment-1',
  authorName: 'Alex',
  text: 'A good game.',
  createdAt: '2023-11-14T12:00:00.000Z',
  likesCount: 2,
  isLikedByCurrentUser: false,
};

const mountedComments: ReturnType<typeof createGameDetailsComments>[] = [];

function createResponse(data: readonly GameComment[], totalComments: number): GameCommentsResponse {
  return {
    data,
    meta: { totalComments },
  };
}

function createDeferredComment() {
  const completion: {
    resolve?: (value: GameComment) => void;
  } = {};

  const promise = new Promise<GameComment>((resolve) => {
    completion.resolve = resolve;
  });

  return { promise, completion };
}

async function createFixture(isGuest = false) {
  const store = createAppSessionStore();

  if (!isGuest) {
    store.setSession(session);
  }

  const requireSession = vi.fn<ProtectedActionGuard>(() => store.getSession());

  const comments = createGameDetailsComments({
    getActiveSession: store.getSession,
    requireSession,
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

  return { comments, store, requireSession, form, textarea, button };
}

function enterText(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function getRetryButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.feedback-state__retry');

  if (!button) {
    throw new Error('Comments retry button is missing.');
  }

  return button;
}

async function waitUntilIdle(form: HTMLFormElement): Promise<void> {
  await vi.waitFor(() => {
    expect(form.getAttribute('aria-busy')).toBe('false');
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getGameComments.mockResolvedValue(createResponse([comment], 1));
  mocks.createGameComment.mockResolvedValue(comment);
});

afterEach(() => {
  for (const comments of mountedComments) {
    comments.reset();
  }

  mountedComments.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('game details comment submission', () => {
  it('renders the uppercase initial of the trimmed commenter name', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse([{ ...comment, authorName: '  émilie  ' }], 1),
    );

    const { comments } = await createFixture();

    const avatar = comments.element.querySelector('.game-comments__avatar--random-5');

    expect(avatar?.textContent).toBe('É');
  });

  it('preserves author colors when comments are refreshed and reordered', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { comments } = await createFixture();

    const originalAvatar = comments.element.querySelector('.game-comments__avatar--random-1');

    expect(originalAvatar).toBeTruthy();

    random.mockReturnValue(0.8);

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse(
        [
          {
            ...comment,
            commentId: 'taylor-comment',
            authorName: 'Taylor',
          },
          {
            ...comment,
            commentId: 'another-alex-comment',
            text: 'Another comment by Alex.',
          },
          comment,
        ],
        12,
      ),
    );

    await comments.load('chess');

    const avatars = [...comments.element.querySelectorAll('.game-comments__item')].map((item) =>
      item.querySelector('.game-comments__avatar'),
    );

    expect(avatars[0]?.classList.contains('game-comments__avatar--random-5')).toBe(true);
    expect(avatars[1]?.classList.contains('game-comments__avatar--random-1')).toBe(true);
    expect(avatars[2]?.classList.contains('game-comments__avatar--random-1')).toBe(true);

    expect(avatars[2]).not.toBe(originalAvatar);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('can select a new avatar color after resetting and reopening comments', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { comments } = await createFixture();

    expect(comments.element.querySelector('.game-comments__avatar--random-1')).toBeTruthy();

    comments.reset();
    random.mockReturnValue(0.8);

    await comments.load('chess');

    expect(comments.element.querySelector('.game-comments__avatar--random-5')).toBeTruthy();
    expect(comments.element.querySelector('.game-comments__avatar--random-1')).toBeNull();
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('loads personalized comments using the active session email', async () => {
    const { comments, textarea } = await createFixture();

    expect(mocks.getGameComments).toHaveBeenCalledWith(
      'chess',
      expect.any(AbortSignal),
      session.email,
    );
    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (1)');
    expect(textarea.disabled).toBe(false);
  });

  it('loads public comments and prevents guest submissions', async () => {
    const { form, textarea, button, requireSession } = await createFixture(true);

    expect(mocks.getGameComments.mock.calls[0]?.[2]).toBeUndefined();
    expect(textarea.disabled).toBe(true);
    expect(button.disabled).toBe(true);

    enterText(textarea, 'A guest comment');
    submitForm(form);

    expect(requireSession).toHaveBeenCalledOnce();
    expect(mocks.createGameComment).not.toHaveBeenCalled();
  });

  it('posts trimmed text and refreshes the list and full comment count', async () => {
    const { comments, form, textarea, button, store } = await createFixture();

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse(
        [
          { ...comment, commentId: 'new-comment', text: 'New comment' },
          comment,
          { ...comment, commentId: 'older-comment' },
        ],
        42,
      ),
    );

    enterText(textarea, '  New comment  ');
    button.click();

    await vi.waitFor(() => {
      expect(textarea.value).toBe('');
      expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (42)');
    });

    expect(mocks.createGameComment).toHaveBeenCalledWith(
      'chess',
      {
        userEmail: store.getSession()?.email,
        authorName: 'Alex',
        text: 'New comment',
      },
      expect.any(AbortSignal),
    );

    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe(session.email);
    expect(comments.element.querySelectorAll('.game-comments__item')).toHaveLength(3);
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Comment posted successfully.', 'success');
  });

  it('renders returned comment text safely as text', async () => {
    const unsafeText = '<img src=x onerror=alert(1)>';

    mocks.getGameComments.mockResolvedValueOnce(
      createResponse([{ ...comment, text: unsafeText }], 1),
    );

    const { comments } = await createFixture();
    const text = comments.element.querySelector('.game-comments__text');

    expect(text?.textContent).toBe(unsafeText);
    expect(text?.querySelector('img')).toBeNull();
  });

  it('locks the form while posting and prevents duplicate POST requests', async () => {
    const { form, textarea, button } = await createFixture();
    const pending = createDeferredComment();

    mocks.createGameComment.mockReturnValueOnce(pending.promise);

    enterText(textarea, 'My comment');
    submitForm(form);

    expect(textarea.disabled).toBe(true);
    expect(button.disabled).toBe(true);

    submitForm(form);
    button.click();

    expect(mocks.createGameComment).toHaveBeenCalledOnce();

    pending.completion.resolve?.(comment);
    await waitUntilIdle(form);

    expect(textarea.value).toBe('');
    expect(textarea.disabled).toBe(false);
  });

  it.each([400, 403, 422, 429])(
    'keeps the draft after a definitive HTTP %s rejection',
    async (status) => {
      const { form, textarea, button } = await createFixture();

      mocks.createGameComment.mockRejectedValueOnce(new ApiError(status));

      enterText(textarea, '  Keep my draft  ');
      submitForm(form);

      await waitUntilIdle(form);

      expect(textarea.value).toBe('  Keep my draft  ');
      expect(textarea.disabled).toBe(false);
      expect(button.disabled).toBe(false);
      expect(mocks.createGameComment).toHaveBeenCalledOnce();
      expect(mocks.getGameComments).toHaveBeenCalledOnce();
      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'Your comment was rejected. Your draft has been kept. Please try again.',
        'error',
      );
    },
  );

  it.each([
    ['timeout', new ApiError(408)],
    ['server failure', new ApiError(500)],
    ['lost connection', new TypeError('Connection lost')],
    ['invalid response', new Error('Invalid comment submission response')],
  ])('reports an unknown result after %s without resubmitting', async (_label, error) => {
    const { form, textarea, button } = await createFixture();

    mocks.createGameComment.mockRejectedValueOnce(error);

    enterText(textarea, 'Keep my draft');
    submitForm(form);

    await waitUntilIdle(form);

    expect(textarea.value).toBe('Keep my draft');
    expect(textarea.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(mocks.getGameComments).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Could not confirm whether your comment was sent. Your draft has been kept.',
      'error',
    );
  });

  it('allows a manual retry after a definitive rejection', async () => {
    const { form, textarea, button } = await createFixture();

    mocks.createGameComment.mockRejectedValueOnce(new ApiError(422));

    enterText(textarea, 'My comment');
    submitForm(form);
    await waitUntilIdle(form);

    expect(textarea.value).toBe('My comment');

    button.click();
    await waitUntilIdle(form);

    expect(mocks.createGameComment).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe('');
  });

  it('keeps a successful POST confirmed when refreshing the list fails', async () => {
    const { comments, form, textarea } = await createFixture();

    mocks.getGameComments.mockRejectedValueOnce(new TypeError('GET failed'));

    enterText(textarea, 'My comment');
    submitForm(form);

    await vi.waitFor(() => {
      expect(textarea.value).toBe('');
      expect(comments.element.querySelector('.feedback-state--error')).toBeTruthy();
    });

    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Comment posted successfully.', 'success');
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Failed to load comments.', 'error');

    mocks.getGameComments.mockResolvedValueOnce(createResponse([comment], 12));

    getRetryButton(comments.element).click();

    await vi.waitFor(() => {
      expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (12)');
    });

    expect(mocks.getGameComments).toHaveBeenCalledTimes(3);
    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(textarea.value).toBe('');
  });

  it('shows an empty state using the count from GET metadata', async () => {
    mocks.getGameComments.mockResolvedValueOnce(createResponse([], 0));

    const { comments } = await createFixture();

    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (0)');
    expect(comments.element.querySelector('.feedback-state--empty')?.textContent).toBe(
      'No comments yet.',
    );
  });

  it('aborts a pending POST on logout and ignores its late response', async () => {
    const { comments, form, textarea, store } = await createFixture();
    const pending = createDeferredComment();

    mocks.createGameComment.mockReturnValueOnce(pending.promise);

    enterText(textarea, 'My draft');
    submitForm(form);

    const signal = mocks.createGameComment.mock.calls[0]?.[2];

    store.setSession(undefined);

    expect(signal?.aborted).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(textarea.value).toBe('My draft');
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBeUndefined();

    pending.completion.resolve?.(comment);
    await pending.promise;
    await Promise.resolve();

    expect(textarea.value).toBe('My draft');
    expect(mocks.createGameComment).toHaveBeenCalledOnce();
    expect(mocks.getGameComments).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).not.toHaveBeenCalledWith('Comment posted successfully.', 'success');
    expect(comments.element.querySelector('h3')?.textContent).toBe('Comments (1)');
  });

  it('preserves the draft while loading comments for another user', async () => {
    const { comments, textarea, store } = await createFixture();

    enterText(textarea, 'My draft');

    store.setSession({
      ...session,
      displayName: 'Taylor',
      email: 'taylor@example.com',
    });

    await vi.waitFor(() => {
      expect(
        comments.element.querySelector('.game-comments__results')?.getAttribute('aria-busy'),
      ).toBe('false');
    });

    expect(textarea.value).toBe('My draft');
    expect(textarea.disabled).toBe(false);
    expect(comments.element.querySelector('.game-comments__avatar--user')?.textContent).toBe('T');
    expect(mocks.getGameComments.mock.calls[1]?.[2]).toBe('taylor@example.com');
    expect(mocks.createGameComment).not.toHaveBeenCalled();
  });
});

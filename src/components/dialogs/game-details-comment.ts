import './game-details-comment.scss';

import { ApiError, createGameComment, getGameComments } from '../../services/api';
import type { CreateGameCommentInput, GameComment } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import { formatRelativeTime } from '../../utils/relative-time';
import { createEmptyState, createErrorState, createSkeleton } from '../feedback/feedback';
import { showSnackbar } from '../snackbar/snackbar';
import { createGameCommentForm } from './game-comment-form';
import type { GameDetailsActions } from './game-details-info';
import { createCommentAvatarPalette } from '../../utils/comment-avatar';
import type { CommentAvatarTone } from '../../utils/comment-avatar';
import { getCommentAuthorInitial } from '../../utils/comment-validation';
import { createGameCommentLikeButton } from './game-comment-like';
import type { GameCommentLikeOptions } from './game-comment-like';
interface GameDetailsComments {
  readonly element: HTMLElement;
  load: (gameSlug: string) => Promise<void>;
  reset: () => void;
}

function createAvatar(letter: string, tone: string): HTMLSpanElement {
  const avatar = document.createElement('span');
  avatar.className = `game-comments__avatar game-comments__avatar--${tone}`;
  avatar.textContent = letter;
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function createCommentItem(
  comment: GameComment,
  tone: CommentAvatarTone,
  options: GameCommentLikeOptions,
  lifetimeSignal: AbortSignal,
): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'game-comments__item';
  item.dataset.commentId = comment.commentId;

  const header = document.createElement('div');
  header.className = 'game-comments__item-header';

  const authorBlock = document.createElement('div');
  authorBlock.className = 'game-comments__author-block';

  const avatar = createAvatar(getCommentAuthorInitial(comment.authorName), tone);

  const author = document.createElement('strong');
  author.className = 'game-comments__author';
  author.textContent = comment.authorName;

  authorBlock.append(avatar, author);

  const time = document.createElement('time');
  time.className = 'game-comments__time';
  time.dateTime = comment.createdAt;
  time.textContent = formatRelativeTime(comment.createdAt);

  header.append(authorBlock, time);

  const text = document.createElement('p');
  text.className = 'game-comments__text';
  text.textContent = comment.text;

  const likeButton = createGameCommentLikeButton(comment, options, lifetimeSignal);
  item.append(header, text, likeButton);

  return item;
}

function createLoadingComments(): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'game-comments__list';

  for (let index = 0; index < 3; index += 1) {
    const item = document.createElement('li');
    item.className = 'game-comments__item';
    item.append(createSkeleton(`Loading comment ${index + 1}`));
    list.append(item);
  }

  return list;
}

export function createGameDetailsComments(options: GameDetailsActions = {}): GameDetailsComments {
  const avatarPalette = createCommentAvatarPalette();
  const section = document.createElement('section');
  section.className = 'game-comments';
  section.setAttribute('aria-labelledby', 'game-comments-title');

  const heading = document.createElement('h3');
  heading.id = 'game-comments-title';
  heading.className = 'game-comments__title';
  heading.textContent = 'Comments';

  const results = document.createElement('div');
  results.className = 'game-comments__results';

  let commentActionsController: AbortController | undefined;

  let request: AbortController | undefined;
  let currentSlug: string | undefined;
  let displayedSession: AppSession | undefined;
  let unsubscribe: (() => void) | undefined;
  let hasFailed = false;

  function getActiveSession(): AppSession | undefined {
    return options.getActiveSession?.();
  }

  const form = createGameCommentForm({
    getActiveSession,
    requireSession: (trigger?: HTMLElement): AppSession | undefined =>
      options.requireSession?.(trigger),
    onSubmit: wasCommentSubmitted,
  });

  section.append(heading, form.element, results);

  async function wasCommentSubmitted(
    input: CreateGameCommentInput,
    session: AppSession,
    signal: AbortSignal,
  ): Promise<boolean> {
    const slug = currentSlug;

    if (!slug || signal.aborted || getActiveSession() !== session) {
      return false;
    }

    function canApplyResult(): boolean {
      return !signal.aborted && currentSlug === slug && getActiveSession() === session;
    }

    try {
      await createGameComment(slug, input, signal);
    } catch (error: unknown) {
      if (!canApplyResult()) {
        return false;
      }

      const isDefinitiveRejection =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408;

      showSnackbar(
        isDefinitiveRejection
          ? 'Your comment was rejected. Your draft has been kept. Please try again.'
          : 'Could not confirm whether your comment was sent. Your draft has been kept.',
        'error',
      );

      return false;
    }

    if (!canApplyResult()) {
      return false;
    }

    showSnackbar('Comment posted successfully.', 'success');

    void load(slug);

    return true;
  }

  function onSessionChange(session: AppSession | undefined): void {
    if (session === displayedSession) {
      return;
    }

    displayedSession = session;
    form.setSession(session);

    if (currentSlug) {
      void load(currentSlug);
    }
  }

  async function load(gameSlug: string): Promise<void> {
    if (currentSlug !== gameSlug) {
      hasFailed = false;
      form.reset();
    }

    currentSlug = gameSlug;

    const session = getActiveSession();
    displayedSession = session;
    form.setSession(session);

    if (!unsubscribe && options.sessionStore) {
      unsubscribe = options.sessionStore.subscribe(onSessionChange);
    }

    commentActionsController?.abort();
    commentActionsController = undefined;

    request?.abort();

    const controller = new AbortController();
    request = controller;

    function canApplyResult(): boolean {
      return (
        request === controller &&
        !controller.signal.aborted &&
        currentSlug === gameSlug &&
        getActiveSession() === session
      );
    }

    heading.textContent = 'Comments';
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren(createLoadingComments());

    try {
      const response = await getGameComments(gameSlug, controller.signal, session?.email);

      if (!canApplyResult()) {
        return;
      }

      heading.textContent = `Comments (${response.meta.totalComments})`;

      if (response.data.length === 0) {
        results.replaceChildren(createEmptyState('No comments yet.'));
      } else {
        const list = document.createElement('ul');
        list.className = 'game-comments__list';

        const actionsController = new AbortController();
        commentActionsController = actionsController;

        const likeOptions: GameCommentLikeOptions = {
          ...options,
          ...(session && { loadedSession: session }),
          onRefreshComments: (): void => {
            if (currentSlug !== gameSlug) {
              return;
            }

            hasFailed = true;
            void load(gameSlug);
          },
        };

        for (const comment of response.data) {
          list.append(
            createCommentItem(
              comment,
              avatarPalette.getTone(comment.authorName),
              likeOptions,
              actionsController.signal,
            ),
          );
        }

        results.replaceChildren(list);
      }

      if (hasFailed) {
        showSnackbar('Comments loaded successfully.', 'success');
        hasFailed = false;
      }
    } catch {
      if (!canApplyResult()) {
        return;
      }

      hasFailed = true;

      results.replaceChildren(
        createErrorState('Could not load comments. Please try again.', (): void => {
          if (currentSlug === gameSlug) {
            void load(gameSlug);
          }
        }),
      );

      showSnackbar('Failed to load comments.', 'error');
    } finally {
      if (request === controller) {
        request = undefined;
        results.setAttribute('aria-busy', 'false');
      }
    }
  }

  function reset(): void {
    request?.abort();
    request = undefined;
    avatarPalette.reset();

    unsubscribe?.();
    unsubscribe = undefined;

    currentSlug = undefined;
    displayedSession = undefined;
    hasFailed = false;

    form.setSession(undefined);
    form.reset();

    heading.textContent = 'Comments';
    results.setAttribute('aria-busy', 'false');
    results.replaceChildren();
    commentActionsController?.abort();
    commentActionsController = undefined;
  }

  return { element: section, load, reset };
}

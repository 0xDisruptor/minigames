import './game-details-comment.scss';

import { getGameComments } from '../../services/api';
import type { GameComment } from '../../services/api';
import { formatRelativeTime } from '../../utils/relative-time';
import { createEmptyState, createErrorState, createSkeleton } from '../feedback/feedback';
import { showSnackbar } from '../snackbar/snackbar';

interface GameDetailsComments {
  readonly element: HTMLElement;
  load: (gameSlug: string) => Promise<void>;
  reset: () => void;
}

const avatarTones = ['blue', 'yellow', 'lavender'] as const;

function createAvatar(letter: string, tone: string): HTMLSpanElement {
  const avatar = document.createElement('span');
  avatar.className = `game-comments__avatar game-comments__avatar--${tone}`;
  avatar.textContent = letter;
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function createSendIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M4 5L20 12L4 19V14L13 12L4 10V5Z');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');

  svg.append(path);
  return svg;
}

function createCommentItem(comment: GameComment, index: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'game-comments__item';
  item.dataset.commentId = comment.commentId;

  const header = document.createElement('div');
  header.className = 'game-comments__item-header';

  const authorBlock = document.createElement('div');
  authorBlock.className = 'game-comments__author-block';

  const tone = avatarTones[index % avatarTones.length] ?? 'blue';
  const avatar = createAvatar(comment.authorName.charAt(0), tone);

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

  const likeButton = document.createElement('button');
  likeButton.type = 'button';
  likeButton.className = 'game-comments__like';
  likeButton.disabled = true;
  likeButton.setAttribute('aria-pressed', String(comment.isLikedByCurrentUser));
  likeButton.setAttribute(
    'aria-label',
    `${comment.likesCount} likes on comment by ${comment.authorName}`,
  );

  const heart = document.createElement('span');
  heart.className = 'game-comments__heart';
  heart.textContent = comment.isLikedByCurrentUser ? '♥' : '♡';
  heart.setAttribute('aria-hidden', 'true');

  const likes = document.createElement('span');
  likes.className = 'game-comments__likes-count';
  likes.textContent = String(comment.likesCount);

  likeButton.append(heart, likes);
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

export function createGameDetailsComments(): GameDetailsComments {
  const section = document.createElement('section');
  section.className = 'game-comments';
  section.setAttribute('aria-labelledby', 'game-comments-title');

  const heading = document.createElement('h3');
  heading.id = 'game-comments-title';
  heading.className = 'game-comments__title';
  heading.textContent = 'Comments';

  const form = document.createElement('form');
  form.className = 'game-comments__form';

  const userAvatar = createAvatar('U', 'user');

  const textarea = document.createElement('textarea');
  textarea.className = 'game-comments__textarea';
  textarea.name = 'comment';
  textarea.placeholder = 'Write a comment...';
  textarea.rows = 1;
  textarea.disabled = true;
  textarea.setAttribute('aria-label', 'Write a comment');

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'game-comments__submit';
  submitButton.disabled = true;
  submitButton.setAttribute('aria-label', 'Submit comment');
  submitButton.append(createSendIcon());

  form.append(userAvatar, textarea, submitButton);

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
  });

  const results = document.createElement('div');
  results.className = 'game-comments__results';

  section.append(heading, form, results);

  let request: AbortController | undefined;
  let currentSlug: string | undefined;
  let hasFailed = false;

  async function load(gameSlug: string): Promise<void> {
    if (currentSlug !== gameSlug) {
      hasFailed = false;
    }

    currentSlug = gameSlug;
    request?.abort();

    const controller = new AbortController();
    request = controller;

    heading.textContent = 'Comments';
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren(createLoadingComments());

    try {
      const response = await getGameComments(gameSlug, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      heading.textContent = `Comments (${response.meta.totalComments})`;

      if (response.data.length === 0) {
        results.replaceChildren(createEmptyState('No comments yet.'));
      } else {
        const list = document.createElement('ul');
        list.className = 'game-comments__list';

        for (const [index, comment] of response.data.entries()) {
          list.append(createCommentItem(comment, index));
        }

        results.replaceChildren(list);
      }

      if (hasFailed) {
        showSnackbar('Comments loaded successfully.', 'success');
        hasFailed = false;
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }

      hasFailed = true;

      results.replaceChildren(
        createErrorState('Could not load comments. Please try again.', (): void => {
          void load(gameSlug);
        }),
      );

      showSnackbar('Failed to load comments.', 'error');
    } finally {
      if (request === controller) {
        results.setAttribute('aria-busy', 'false');
      }
    }
  }

  function reset(): void {
    request?.abort();
    request = undefined;
    currentSlug = undefined;
    hasFailed = false;
    heading.textContent = 'Comments';
    results.setAttribute('aria-busy', 'false');
    results.replaceChildren();
  }

  return { element: section, load, reset };
}

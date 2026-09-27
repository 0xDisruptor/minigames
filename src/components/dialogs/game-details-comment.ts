import './game-details-comment.scss';

interface CommentData {
  authorName: string;
  text: string;
  likesCount: number;
  createdAt: string;
  ago: string;
  avatarTone: 'blue' | 'yellow' | 'lavender';
  isLiked: boolean;
}
interface GameDetailsComments {
  element: HTMLElement;
  reset: () => void;
}

const comments: CommentData[] = [
  {
    authorName: 'ForestDweller',
    text: `The hand-drawn art is absolutely magical 🍄 Every location feels like a page from a children's storybook. The mushroom village made me cry happy tears!`,
    likesCount: 12,
    createdAt: '2026-08-30T07:00:00Z',
    ago: '3 hours ago',
    avatarTone: 'blue',
    isLiked: false,
  },
  {
    authorName: 'HerbalTeaLover',
    text: `Perfect cozy evening game — brew a cup of chamomile, wrap in a blanket and help the little Tukoni prepare for winter. The puzzles are gentle but satisfying.`,
    likesCount: 5,
    createdAt: '2026-08-29T15:30:00Z',
    ago: '1 day ago',
    avatarTone: 'yellow',
    isLiked: false,
  },
  {
    authorName: 'CottageCoreMia',
    text: `I want to live inside this game forever 🌿 The NPCs are so charming, the tea recipes are real, and the atmosphere is pure warmth and calm.`,
    likesCount: 8,
    createdAt: '2026-08-27T20:10:00Z',
    ago: '3 days ago',
    avatarTone: 'lavender',
    isLiked: true,
  },
];

function setupTextareaAutoGrow(textarea: HTMLTextAreaElement): () => void {
  const resize = (): void => {
    textarea.style.height = 'auto';

    const maxHeight = Number(getComputedStyle(textarea).maxHeight.replace('px', ''));
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  textarea.addEventListener('input', resize);
  resize();

  return resize;
}

function createAvatar(
  letter: string,
  tone: 'blue' | 'yellow' | 'lavender' | 'user',
): HTMLSpanElement {
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

function createCommentItem(comment: CommentData): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'game-comments__item';

  const header = document.createElement('div');
  header.className = 'game-comments__item-header';

  const authorBlock = document.createElement('div');
  authorBlock.className = 'game-comments__author-block';

  const avatar = createAvatar(comment.authorName.charAt(0), comment.avatarTone);

  const author = document.createElement('strong');
  author.className = 'game-comments__author';
  author.textContent = comment.authorName;

  authorBlock.append(avatar, author);

  const time = document.createElement('time');
  time.className = 'game-comments__time';
  time.dateTime = comment.createdAt;
  time.textContent = comment.ago;

  header.append(authorBlock, time);

  const text = document.createElement('p');
  text.className = 'game-comments__text';
  text.textContent = comment.text;

  const likeButton = document.createElement('button');
  likeButton.type = 'button';
  likeButton.className = 'game-comments__like';
  likeButton.setAttribute('aria-pressed', String(comment.isLiked));
  likeButton.setAttribute('aria-label', `Like comment by ${comment.authorName}`);

  const heart = document.createElement('span');
  heart.className = 'game-comments__heart';
  heart.textContent = '♡';
  heart.setAttribute('aria-hidden', 'true');

  const likes = document.createElement('span');
  likes.className = 'game-comments__likes-count';
  likes.textContent = String(comment.likesCount);

  likeButton.append(heart, likes);

  likeButton.addEventListener('click', (): void => {
    const isLiked = likeButton.getAttribute('aria-pressed') === 'true';

    likeButton.setAttribute('aria-pressed', String(!isLiked));
  });

  item.append(header, text, likeButton);

  return item;
}

export function createGameDetailsComments(): GameDetailsComments {
  const section = document.createElement('section');
  section.className = 'game-comments';
  section.setAttribute('aria-labelledby', 'game-comments-title');

  const heading = document.createElement('h3');
  heading.id = 'game-comments-title';
  heading.className = 'game-comments__title';
  heading.textContent = `Comments (${comments.length})`;

  const form = document.createElement('form');
  form.className = 'game-comments__form';

  const userAvatar = createAvatar('U', 'user');

  const textarea = document.createElement('textarea');
  textarea.className = 'game-comments__textarea';
  textarea.name = 'comment';
  textarea.placeholder = 'Write a comment...';
  textarea.rows = 1;
  textarea.setAttribute('aria-label', 'Write a comment');

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'game-comments__submit';
  submitButton.setAttribute('aria-label', 'Submit comment');
  submitButton.append(createSendIcon());

  form.append(userAvatar, textarea, submitButton);

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
  });

  const resizeTextarea = setupTextareaAutoGrow(textarea);

  const list = document.createElement('ul');
  list.className = 'game-comments__list';

  for (const comment of comments) {
    list.append(createCommentItem(comment));
  }

  section.append(heading, form, list);

  function reset(): void {
    textarea.value = '';
    textarea.style.height = '';
    textarea.style.overflowY = 'hidden';
    resizeTextarea();

    const likeButtons = [...list.querySelectorAll<HTMLButtonElement>('.game-comments__like')];

    for (const [index, comment] of comments.entries()) {
      const likeButton = likeButtons[index];

      if (likeButton) {
        likeButton.setAttribute('aria-pressed', String(comment.isLiked));
      }
    }
  }

  return {
    element: section,
    reset,
  };
}

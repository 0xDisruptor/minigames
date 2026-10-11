import type { AppSession } from '../state/app-session';

export const COMMENT_TEXT_MIN_LENGTH = 1;
export const COMMENT_TEXT_MAX_LENGTH = 500;

export const COMMENT_AUTHOR_NAME_MIN_LENGTH = 2;
export const COMMENT_AUTHOR_NAME_MAX_LENGTH = 30;

export function normalizeCommentText(value: string): string {
  return value.trim();
}

export function getCommentTextLength(value: string): number {
  return [...normalizeCommentText(value)].length;
}

export function isCommentTextValid(value: string): boolean {
  const length = getCommentTextLength(value);

  return length >= COMMENT_TEXT_MIN_LENGTH && length <= COMMENT_TEXT_MAX_LENGTH;
}

export function isCommentAuthorNameValid(value: string): boolean {
  const length = [...value.trim()].length;

  return length >= COMMENT_AUTHOR_NAME_MIN_LENGTH && length <= COMMENT_AUTHOR_NAME_MAX_LENGTH;
}

export function getCommentAuthorName(profile: Pick<AppSession, 'displayName' | 'email'>): string {
  const displayName = profile.displayName.trim();

  if (isCommentAuthorNameValid(displayName)) {
    return displayName;
  }

  const emailName = profile.email.trim().split('@', 1)[0]?.trim() ?? '';

  return isCommentAuthorNameValid(emailName) ? emailName : 'Player';
}

export function getCommentAuthorInitial(authorName: string): string {
  const firstCodePoint = authorName.trim().codePointAt(0);

  return firstCodePoint === undefined ? '?' : String.fromCodePoint(firstCodePoint).toUpperCase();
}

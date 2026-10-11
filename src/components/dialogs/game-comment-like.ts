import { ApiError, toggleCommentLike } from '../../services/api';
import type { GameComment } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import { showSnackbar } from '../snackbar/snackbar';
import type { GameDetailsActions } from './game-details-info';

export interface GameCommentLikeOptions extends GameDetailsActions {
  readonly loadedSession?: AppSession;
  readonly onRefreshComments?: () => void;
}

export function createGameCommentLikeButton(
  comment: GameComment,
  options: GameCommentLikeOptions = {},
  lifetimeSignal?: AbortSignal,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-comments__like';

  const heart = document.createElement('span');
  heart.className = 'game-comments__heart';
  heart.setAttribute('aria-hidden', 'true');

  const count = document.createElement('span');
  count.className = 'game-comments__likes-count';

  button.append(heart, count);

  const canToggle = Boolean(options.requireSession && options.getActiveSession);

  let isLiked = Boolean(options.loadedSession && comment.isLikedByCurrentUser);
  let likesCount = comment.likesCount;
  let isPending = false;
  let isDisposed = lifetimeSignal?.aborted ?? false;
  let hasUnknownResult = false;
  let request: AbortController | undefined;

  function render(): void {
    button.disabled =
      !canToggle || isPending || isDisposed || (hasUnknownResult && !options.onRefreshComments);

    button.setAttribute('aria-pressed', String(isLiked));
    button.setAttribute('aria-busy', String(isPending));

    let label = `${likesCount} likes on comment by ${comment.authorName}`;

    if (isPending) {
      label = `Updating like on comment by ${comment.authorName}`;
    } else if (hasUnknownResult) {
      label = `Reload comments to check like state for ${comment.authorName}`;
    }

    button.setAttribute('aria-label', label);
    button.title = label;

    heart.textContent = isLiked ? '♥' : '♡';
    count.textContent = isPending ? '…' : String(likesCount);
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    request?.abort();
    request = undefined;
    isPending = false;

    lifetimeSignal?.removeEventListener('abort', dispose);
    render();
  }

  async function toggleLike(): Promise<void> {
    if (isPending || isDisposed || !options.requireSession || !options.getActiveSession) {
      return;
    }

    const session = options.requireSession(button);

    if (!session) {
      return;
    }

    if (hasUnknownResult) {
      options.onRefreshComments?.();
      return;
    }

    const controller = new AbortController();
    request = controller;
    isPending = true;
    render();

    function canApplyResult(): boolean {
      return (
        !isDisposed &&
        !controller.signal.aborted &&
        request === controller &&
        options.getActiveSession?.() === session
      );
    }

    try {
      const result = await toggleCommentLike(comment.commentId, session.email, controller.signal);

      if (!canApplyResult()) {
        return;
      }

      isLiked = result.isLikedByCurrentUser;
      likesCount = result.likesCount;

      showSnackbar(isLiked ? 'Comment liked.' : 'Comment like removed.', 'success');
    } catch (error: unknown) {
      if (!canApplyResult()) {
        return;
      }

      const isDefinitiveRejection =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 408;

      hasUnknownResult = !isDefinitiveRejection;

      showSnackbar(
        isDefinitiveRejection
          ? 'Could not update the comment like. Please try again.'
          : 'The like result is unknown. Reload comments to check its state before trying again.',
        'error',
      );
    } finally {
      if (request === controller) {
        request = undefined;
        isPending = false;
        render();
      }
    }
  }

  button.addEventListener('click', (): void => {
    void toggleLike();
  });

  render();

  if (!isDisposed) {
    lifetimeSignal?.addEventListener('abort', dispose, { once: true });
  }

  return button;
}

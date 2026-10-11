import './game-details-comment.scss';

import type { ProtectedActionGuard } from '../../app/protected-action-guard';
import type { CreateGameCommentInput } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import {
  COMMENT_TEXT_MAX_LENGTH,
  getCommentAuthorInitial,
  getCommentAuthorName,
  getCommentTextLength,
  isCommentTextValid,
  normalizeCommentText,
} from '../../utils/comment-validation';
import { showSnackbar } from '../snackbar/snackbar';

interface GameCommentFormOptions {
  readonly getActiveSession: () => AppSession | undefined;
  readonly requireSession: ProtectedActionGuard;
  readonly onSubmit: (
    input: CreateGameCommentInput,
    session: AppSession,
    signal: AbortSignal,
  ) => Promise<boolean>;
}

interface GameCommentForm {
  readonly element: HTMLFormElement;
  readonly setSession: (session: AppSession | undefined) => void;
  readonly reset: () => void;
  readonly resize: () => void;
}

function createSendIcon(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(namespace, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M4 5L20 12L4 19V14L13 12L4 10V5Z');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');

  icon.append(path);
  return icon;
}

export function createGameCommentForm(options: GameCommentFormOptions): GameCommentForm {
  const form = document.createElement('form');
  form.className = 'game-comments__form';
  form.noValidate = true;
  form.setAttribute('aria-label', 'Post a comment');

  const avatar = document.createElement('span');
  avatar.className = 'game-comments__avatar game-comments__avatar--user';
  avatar.setAttribute('aria-hidden', 'true');

  const textarea = document.createElement('textarea');
  textarea.className = 'game-comments__textarea';
  textarea.name = 'comment';
  textarea.rows = 1;
  textarea.required = true;
  textarea.placeholder = 'Write a comment...';
  textarea.setAttribute('aria-label', 'Write a comment');
  textarea.setAttribute('aria-describedby', 'game-comment-form-feedback');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'game-comments__submit';
  submit.setAttribute('aria-label', 'Submit comment');
  submit.append(createSendIcon());

  const feedback = document.createElement('span');
  feedback.id = 'game-comment-form-feedback';
  feedback.className = 'game-comments__form-feedback';
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;

  form.append(avatar, textarea, submit, feedback);

  let currentSession: AppSession | undefined;
  let request: AbortController | undefined;
  let isPending = false;

  function resize(): void {
    textarea.style.height = 'auto';
    textarea.style.overflowY = 'hidden';

    const borderHeight = textarea.offsetHeight - textarea.clientHeight;

    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > textarea.clientHeight ? 'auto' : 'hidden';
  }

  function render(): void {
    const isAuthenticated = Boolean(currentSession);
    const isTooLong = getCommentTextLength(textarea.value) > COMMENT_TEXT_MAX_LENGTH;

    textarea.disabled = !isAuthenticated || isPending;
    textarea.placeholder = isAuthenticated ? 'Write a comment...' : 'Sign in to write a comment';
    textarea.setAttribute('aria-invalid', String(isTooLong));

    submit.disabled = !isAuthenticated || isPending || !isCommentTextValid(textarea.value);
    submit.setAttribute('aria-label', isPending ? 'Sending comment' : 'Submit comment');

    form.setAttribute('aria-busy', String(isPending));

    feedback.hidden = !isTooLong;
    feedback.textContent = isTooLong
      ? `Use no more than ${COMMENT_TEXT_MAX_LENGTH} characters.`
      : '';

    avatar.textContent = currentSession
      ? getCommentAuthorInitial(
          currentSession.displayName.trim() || getCommentAuthorName(currentSession),
        )
      : '?';
  }

  function cancelRequest(): void {
    request?.abort();
    request = undefined;
    isPending = false;
  }

  function setSession(session: AppSession | undefined): void {
    if (session === currentSession) {
      return;
    }

    cancelRequest();
    currentSession = session;
    render();
  }

  function reset(): void {
    cancelRequest();
    textarea.value = '';
    textarea.style.removeProperty('height');
    textarea.style.removeProperty('overflow-y');
    render();
  }

  async function submitComment(): Promise<void> {
    if (isPending || !isCommentTextValid(textarea.value)) {
      return;
    }

    const session = options.requireSession(submit);

    if (!session) {
      return;
    }

    setSession(session);

    const input: CreateGameCommentInput = {
      userEmail: session.email,
      authorName: getCommentAuthorName(session),
      text: normalizeCommentText(textarea.value),
    };

    const controller = new AbortController();
    request = controller;
    isPending = true;
    render();

    function canApplyResult(): boolean {
      return (
        request === controller &&
        !controller.signal.aborted &&
        options.getActiveSession() === session
      );
    }

    try {
      const wasSubmitted = await options.onSubmit(input, session, controller.signal);

      if (wasSubmitted && canApplyResult()) {
        textarea.value = '';
        textarea.style.removeProperty('height');
        textarea.style.removeProperty('overflow-y');
      }
    } catch {
      if (canApplyResult()) {
        showSnackbar(
          'Could not confirm whether your comment was sent. Your draft has been kept.',
          'error',
        );
      }
    } finally {
      if (request === controller) {
        request = undefined;
        isPending = false;
        render();
      }
    }
  }

  textarea.addEventListener('input', (): void => {
    resize();
    render();
  });

  textarea.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.isComposing ||
      textarea.disabled
    ) {
      return;
    }

    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener('submit', (event: SubmitEvent): void => {
    const shouldSkipSubmit = event.defaultPrevented || isPending;
    event.preventDefault();

    if (!shouldSkipSubmit) {
      void submitComment();
    }
  });

  render();
  setSession(options.getActiveSession());

  return { element: form, setSession, reset, resize };
}

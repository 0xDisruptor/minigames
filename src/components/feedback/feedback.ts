import './feedback.scss';

export function createSkeleton(label: string): HTMLElement {
  const skeleton = document.createElement('div');
  skeleton.className = 'feedback-skeleton';
  skeleton.setAttribute('role', 'status');
  skeleton.setAttribute('aria-label', label);

  return skeleton;
}

export function createEmptyState(message: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'feedback-state feedback-state--empty';
  empty.setAttribute('role', 'status');
  empty.textContent = message;

  return empty;
}

export function createErrorState(message: string, onRetry: () => void): HTMLElement {
  const error = document.createElement('div');
  error.className = 'feedback-state feedback-state--error';
  error.setAttribute('role', 'alert');

  const text = document.createElement('p');
  text.textContent = message;

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'feedback-state__retry';
  retry.textContent = 'Retry';
  retry.addEventListener('click', onRetry);

  error.append(text, retry);

  return error;
}

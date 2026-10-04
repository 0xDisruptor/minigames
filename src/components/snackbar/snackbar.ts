import './snackbar.scss';

type SnackbarVariant = 'success' | 'error';

const DISMISS_DELAY = 5000;
const state: { container?: HTMLDivElement; timerId?: number } = {};

export function dismissSnackbar(): void {
  clearTimeout(state.timerId);
  state.timerId = undefined;
  state.container?.replaceChildren();
}

export function showSnackbar(message: string, variant: SnackbarVariant): void {
  if (!state.container) {
    state.container = document.createElement('div');
    state.container.className = 'snackbar-container';
    state.container.setAttribute('aria-live', 'polite');
    state.container.setAttribute('aria-atomic', 'true');
    document.body.append(state.container);
  }

  const host = document.querySelector<HTMLDialogElement>('dialog[open]') ?? document.body;

  host.append(state.container);

  dismissSnackbar();

  const notification = document.createElement('div');
  notification.className = `snackbar snackbar--${variant}`;

  const text = document.createElement('span');
  text.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'snackbar__close';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.textContent = '×';
  close.addEventListener('click', dismissSnackbar);

  notification.append(text, close);
  state.container.append(notification);
  state.timerId = setTimeout(dismissSnackbar, DISMISS_DELAY);
}

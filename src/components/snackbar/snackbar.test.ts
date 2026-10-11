// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissSnackbar, showSnackbar } from './snackbar';

function getNotification(): HTMLDivElement {
  const notification = document.querySelector<HTMLDivElement>('.snackbar');

  if (!notification) {
    throw new Error('Snackbar was not found.');
  }

  return notification;
}

describe('snackbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dismissSnackbar();
    document.body.replaceChildren();
  });

  afterEach(() => {
    dismissSnackbar();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it.each(['success', 'error', 'info', 'warning'] as const)('renders the %s variant', (variant) => {
    showSnackbar('Notification message', variant);

    const notification = getNotification();

    expect(notification.classList.contains(`snackbar--${variant}`)).toBe(true);
    expect(notification.querySelector('span')?.textContent).toBe('Notification message');

    const container = notification.parentElement;

    expect(container?.getAttribute('aria-live')).toBe('polite');
    expect(container?.getAttribute('aria-atomic')).toBe('true');
    expect(container?.parentElement).toBe(document.body);
  });

  it('renders the message as text', () => {
    const message = '<img src="invalid" onerror="alert(1)">';

    showSnackbar(message, 'info');

    const notification = getNotification();

    expect(notification.querySelector('span')?.textContent).toBe(message);
    expect(notification.querySelector('img')).toBeNull();
  });

  it('dismisses the notification with the close button', () => {
    showSnackbar('Dismiss me', 'warning');

    const button = getNotification().querySelector<HTMLButtonElement>('button');

    expect(button?.getAttribute('aria-label')).toBe('Dismiss notification');

    button?.click();

    expect(document.querySelector('.snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dismisses the notification after five seconds', () => {
    showSnackbar('Temporary message', 'info');

    vi.advanceTimersByTime(4999);

    expect(document.querySelector('.snackbar')).toBeTruthy();

    vi.advanceTimersByTime(1);

    expect(document.querySelector('.snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the previous message and restarts the timer', () => {
    showSnackbar('First message', 'error');

    vi.advanceTimersByTime(4000);

    showSnackbar('Second message', 'success');

    expect(document.querySelectorAll('.snackbar')).toHaveLength(1);
    expect(getNotification().querySelector('span')?.textContent).toBe('Second message');
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(4000);

    expect(document.querySelector('.snackbar')).toBeTruthy();

    vi.advanceTimersByTime(1000);

    expect(document.querySelector('.snackbar')).toBeNull();
  });

  it('places the notification inside an open dialog', () => {
    const dialog = document.createElement('dialog');

    dialog.open = true;
    document.body.append(dialog);

    showSnackbar('Dialog message', 'warning');

    expect(getNotification().parentElement?.parentElement).toBe(dialog);

    dialog.open = false;

    showSnackbar('Page message', 'info');

    expect(getNotification().parentElement?.parentElement).toBe(document.body);
    expect(dialog.querySelector('.snackbar-container')).toBeNull();
  });

  it('allows repeated dismissal', () => {
    showSnackbar('Message', 'info');

    dismissSnackbar();
    dismissSnackbar();

    expect(document.querySelector('.snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

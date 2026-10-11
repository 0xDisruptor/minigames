// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateGameCommentInput } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import { showSnackbar } from '../snackbar/snackbar';
import { createGameCommentForm } from './game-comment-form';

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: vi.fn(),
}));

const session: AppSession = {
  displayName: 'Alex',
  email: 'alex@example.com',
  authenticatedAt: 1000,
};

function createDeferredSubmission() {
  const callbacks: {
    resolve?: (wasSubmitted: boolean) => void;
    reject?: (reason: unknown) => void;
  } = {};

  const promise = new Promise<boolean>((resolve, reject) => {
    callbacks.resolve = resolve;
    callbacks.reject = reject;
  });

  return { promise, callbacks };
}

function createFixture(isGuest = false) {
  const state: { session: AppSession | undefined } = {
    session: isGuest ? undefined : session,
  };

  const getActiveSession = vi.fn(() => state.session);
  const requireSession = vi.fn(() => state.session);

  const onSubmit = vi
    .fn<
      (
        input: CreateGameCommentInput,
        activeSession: AppSession,
        signal: AbortSignal,
      ) => Promise<boolean>
    >()
    .mockResolvedValue(true);

  const form = createGameCommentForm({
    getActiveSession,
    requireSession,
    onSubmit,
  });

  document.body.append(form.element);

  const textarea = form.element.querySelector<HTMLTextAreaElement>('textarea');
  const button = form.element.querySelector<HTMLButtonElement>('button');

  if (!textarea || !button) {
    throw new Error('Comment form controls are missing.');
  }

  return {
    form,
    textarea,
    button,
    state,
    getActiveSession,
    requireSession,
    onSubmit,
  };
}

function enterText(textarea: HTMLTextAreaElement, value: string): void {
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

async function waitUntilIdle(form: HTMLFormElement): Promise<void> {
  await vi.waitFor(() => {
    expect(form.getAttribute('aria-busy')).toBe('false');
  });
}

describe('createGameCommentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('starts with an empty authenticated form and a username initial', () => {
    const { form, textarea, button } = createFixture();

    expect(textarea.value).toBe('');
    expect(textarea.disabled).toBe(false);
    expect(button.disabled).toBe(true);
    expect(form.element.getAttribute('aria-busy')).toBe('false');
    expect(form.element.querySelector('.game-comments__avatar')?.textContent).toBe('A');
  });

  it('disables the comment controls for a guest', () => {
    const { textarea, button, onSubmit } = createFixture(true);

    expect(textarea.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(textarea.placeholder).toBe('Sign in to write a comment');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('updates the form when a guest signs in', () => {
    const { form, state, textarea } = createFixture(true);

    state.session = {
      ...session,
      displayName: '  ёжик  ',
    };
    form.setSession(state.session);

    expect(textarea.disabled).toBe(false);
    expect(form.element.querySelector('.game-comments__avatar')?.textContent).toBe('Ё');
  });

  it.each([
    ['empty text', ''],
    ['whitespace', ' \t\n '],
    ['overlong text', 'a'.repeat(501)],
    ['overlong Unicode text', '😀'.repeat(501)],
  ])('rejects %s without submitting', (_label, value) => {
    const { form, textarea, button, requireSession, onSubmit } = createFixture();

    enterText(textarea, value);
    submitForm(form.element);

    expect(button.disabled).toBe(true);
    expect(requireSession).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation feedback for overlong text', () => {
    const { form, textarea } = createFixture();
    const feedback = form.element.querySelector<HTMLSpanElement>('.game-comments__form-feedback');

    enterText(textarea, 'a'.repeat(501));

    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(feedback?.hidden).toBe(false);
    expect(feedback?.textContent).toContain('500');

    enterText(textarea, 'Valid comment');

    expect(textarea.getAttribute('aria-invalid')).toBe('false');
    expect(feedback?.hidden).toBe(true);
  });

  it('accepts 500 Unicode characters', async () => {
    const { form, textarea, button, onSubmit } = createFixture();
    const text = '😀'.repeat(500);

    enterText(textarea, text);

    expect(button.disabled).toBe(false);

    submitForm(form.element);
    await waitUntilIdle(form.element);

    expect(onSubmit.mock.calls[0]?.[0].text).toBe(text);
  });

  it('submits trimmed text and identity from the active session', async () => {
    const { form, textarea, button, requireSession, onSubmit } = createFixture();

    enterText(textarea, '  First line.\nSecond line.  ');
    button.click();

    expect(requireSession).toHaveBeenCalledWith(button);
    expect(onSubmit).toHaveBeenCalledWith(
      {
        userEmail: session.email,
        authorName: 'Alex',
        text: 'First line.\nSecond line.',
      },
      session,
      expect.any(AbortSignal),
    );

    await waitUntilIdle(form.element);
    expect(textarea.value).toBe('');
  });

  it('uses a valid author fallback when the display name is too short', async () => {
    const { form, state, textarea, onSubmit } = createFixture();

    state.session = {
      ...session,
      displayName: 'A',
    };
    form.setSession(state.session);

    enterText(textarea, 'Hello');
    submitForm(form.element);
    await waitUntilIdle(form.element);

    expect(onSubmit.mock.calls[0]?.[0].authorName).toBe('alex');
  });

  it('checks the session again before sending', () => {
    const { form, textarea, state, requireSession, onSubmit } = createFixture();

    enterText(textarea, 'My comment');
    state.session = undefined;

    submitForm(form.element);

    expect(requireSession).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('My comment');
  });

  it('submits with Enter and prevents a newline', async () => {
    const { form, textarea, onSubmit } = createFixture();

    enterText(textarea, 'Hello');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    textarea.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();

    await waitUntilIdle(form.element);
  });

  it.each([
    ['Shift+Enter', { shiftKey: true }],
    ['IME composition', { isComposing: true }],
  ])('does not submit with %s', (_label, keyboardOptions) => {
    const { textarea, onSubmit } = createFixture();

    enterText(textarea, 'Hello');

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      ...keyboardOptions,
    });

    textarea.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks both controls and prevents duplicate submissions', async () => {
    const { form, textarea, button, onSubmit } = createFixture();
    const submission = createDeferredSubmission();

    onSubmit.mockReturnValueOnce(submission.promise);
    enterText(textarea, 'Hello');
    submitForm(form.element);

    expect(textarea.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(form.element.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Sending comment');

    submitForm(form.element);
    button.click();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onSubmit).toHaveBeenCalledOnce();

    submission.callbacks.resolve?.(true);
    await submission.promise;

    expect(textarea.disabled).toBe(false);
    expect(textarea.value).toBe('');
    expect(button.disabled).toBe(true);
    expect(form.element.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps the draft after rejection and allows a manual retry', async () => {
    const { form, textarea, button, onSubmit } = createFixture();

    onSubmit.mockResolvedValueOnce(false);
    enterText(textarea, '  Keep this draft  ');
    submitForm(form.element);

    await waitUntilIdle(form.element);

    expect(textarea.value).toBe('  Keep this draft  ');
    expect(textarea.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(onSubmit).toHaveBeenCalledOnce();

    submitForm(form.element);
    await waitUntilIdle(form.element);

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe('');
  });

  it('keeps the draft and reports an unknown outcome on an unexpected failure', async () => {
    const { form, textarea, button, onSubmit } = createFixture();

    onSubmit.mockRejectedValueOnce(new TypeError('Connection lost'));
    enterText(textarea, 'Keep this draft');
    submitForm(form.element);

    await waitUntilIdle(form.element);

    expect(textarea.value).toBe('Keep this draft');
    expect(textarea.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(showSnackbar).toHaveBeenCalledWith(
      'Could not confirm whether your comment was sent. Your draft has been kept.',
      'error',
    );
  });

  it('aborts a pending submission when the session changes', async () => {
    const { form, state, textarea, onSubmit } = createFixture();
    const submission = createDeferredSubmission();

    onSubmit.mockReturnValueOnce(submission.promise);
    enterText(textarea, 'My draft');
    submitForm(form.element);

    const signal = onSubmit.mock.calls[0]?.[2];

    state.session = undefined;
    form.setSession(state.session);

    expect(signal?.aborted).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(textarea.value).toBe('My draft');
    expect(form.element.getAttribute('aria-busy')).toBe('false');

    submission.callbacks.resolve?.(true);
    await submission.promise;

    expect(textarea.value).toBe('My draft');
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('ignores a successful result if the captured session is no longer active', async () => {
    const { form, state, textarea, onSubmit } = createFixture();
    const submission = createDeferredSubmission();

    onSubmit.mockReturnValueOnce(submission.promise);
    enterText(textarea, 'My draft');
    submitForm(form.element);

    state.session = {
      ...session,
      authenticatedAt: session.authenticatedAt + 1,
    };

    submission.callbacks.resolve?.(true);
    await submission.promise;

    expect(textarea.value).toBe('My draft');
    expect(form.element.getAttribute('aria-busy')).toBe('false');
  });

  it('resets the draft and aborts the pending request', async () => {
    const { form, textarea, onSubmit } = createFixture();
    const submission = createDeferredSubmission();

    onSubmit.mockReturnValueOnce(submission.promise);
    enterText(textarea, 'Old draft');
    submitForm(form.element);

    const signal = onSubmit.mock.calls[0]?.[2];

    form.reset();

    expect(signal?.aborted).toBe(true);
    expect(textarea.value).toBe('');
    expect(textarea.style.height).toBe('');
    expect(textarea.style.overflowY).toBe('');
    expect(form.element.getAttribute('aria-busy')).toBe('false');

    enterText(textarea, 'New draft');
    submission.callbacks.resolve?.(true);
    await submission.promise;

    expect(textarea.value).toBe('New draft');
  });

  it('does not let an old request unlock or clear a newer submission', async () => {
    const { form, textarea, onSubmit } = createFixture();
    const firstSubmission = createDeferredSubmission();
    const secondSubmission = createDeferredSubmission();

    onSubmit
      .mockReturnValueOnce(firstSubmission.promise)
      .mockReturnValueOnce(secondSubmission.promise);

    enterText(textarea, 'First comment');
    submitForm(form.element);

    form.reset();

    enterText(textarea, 'Second comment');
    submitForm(form.element);

    firstSubmission.callbacks.resolve?.(true);
    await firstSubmission.promise;

    expect(textarea.value).toBe('Second comment');
    expect(textarea.disabled).toBe(true);
    expect(form.element.getAttribute('aria-busy')).toBe('true');

    secondSubmission.callbacks.resolve?.(true);
    await secondSubmission.promise;

    expect(textarea.value).toBe('');
    expect(textarea.disabled).toBe(false);
    expect(form.element.getAttribute('aria-busy')).toBe('false');
  });

  it('expands, enables scrolling at the height limit, and shrinks again', () => {
    const { textarea } = createFixture();

    const scrollHeight = vi.spyOn(textarea, 'scrollHeight', 'get').mockReturnValue(36);
    const clientHeight = vi.spyOn(textarea, 'clientHeight', 'get').mockReturnValue(38);
    const offsetHeight = vi.spyOn(textarea, 'offsetHeight', 'get').mockReturnValue(40);

    enterText(textarea, 'Short comment');

    expect(textarea.style.height).toBe('38px');
    expect(textarea.style.overflowY).toBe('hidden');

    scrollHeight.mockReturnValue(200);
    clientHeight.mockReturnValue(118);
    offsetHeight.mockReturnValue(120);

    enterText(textarea, 'Long comment\n'.repeat(20));

    expect(textarea.style.height).toBe('202px');
    expect(textarea.style.overflowY).toBe('auto');

    scrollHeight.mockReturnValue(36);
    clientHeight.mockReturnValue(38);
    offsetHeight.mockReturnValue(40);

    enterText(textarea, 'Short again');

    expect(textarea.style.height).toBe('38px');
    expect(textarea.style.overflowY).toBe('hidden');
  });
});

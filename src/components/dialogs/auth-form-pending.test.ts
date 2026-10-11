// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { validateEmail, validateLoginPassword } from '../../utils/auth-validation';
import { bindAuthFormValidation } from './auth-form-validation';
import { createAuthFormPending } from './auth-form-pending';

function createFixture() {
  const form = document.createElement('form');

  form.innerHTML = `
    <input id="email" type="email" value="alex@minigames.com">
    <p id="email-error" hidden></p>

    <input id="password" type="password" value="Ab1!xy">
    <p id="password-error" hidden></p>

    <button type="submit">Login</button>
    <button id="google" type="button">Continue with Google</button>
    <button id="unavailable" type="button" disabled>Unavailable</button>
  `;

  const email = form.querySelector<HTMLInputElement>('#email') as HTMLInputElement;

  const password = form.querySelector<HTMLInputElement>('#password') as HTMLInputElement;

  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  ) as HTMLButtonElement;

  const google = form.querySelector<HTMLButtonElement>('#google') as HTMLButtonElement;

  const unavailable = form.querySelector<HTMLButtonElement>('#unavailable') as HTMLButtonElement;

  const isFormValid = bindAuthFormValidation(form, [
    { id: 'email', validate: validateEmail },
    { id: 'password', validate: validateLoginPassword },
  ]);

  const pending = createAuthFormPending(form, isFormValid);

  return {
    form,
    email,
    password,
    submit,
    google,
    unavailable,
    isFormValid,
    pending,
  };
}

describe('createAuthFormPending', () => {
  it('starts idle without changing the existing control states', () => {
    const fixture = createFixture();

    expect(fixture.pending.isPending()).toBe(false);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.email.disabled).toBe(false);
    expect(fixture.password.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.unavailable.disabled).toBe(true);
  });

  it('disables every input and button while pending', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);

    expect(fixture.pending.isPending()).toBe(true);
    expect(fixture.form.getAttribute('aria-busy')).toBe('true');

    const controls = fixture.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    );

    for (const control of controls) {
      expect(control.disabled).toBe(true);
    }
  });

  it('restores controls while preserving previously disabled buttons', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);
    fixture.pending.setPending(false);

    expect(fixture.pending.isPending()).toBe(false);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.email.disabled).toBe(false);
    expect(fixture.password.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.unavailable.disabled).toBe(true);
  });

  it('preserves the original states after repeated pending calls', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);
    fixture.pending.setPending(true);
    fixture.pending.setPending(false);
    fixture.pending.setPending(false);

    expect(fixture.email.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.unavailable.disabled).toBe(true);
  });

  it('revalidates the form when the request finishes', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);
    fixture.email.value = '';
    fixture.pending.setPending(false);

    expect(fixture.email.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.google.disabled).toBe(false);
  });

  it('keeps submit disabled when input events trigger validation', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);

    fixture.email.value = '';
    fixture.email.dispatchEvent(new Event('input'));

    fixture.email.value = 'alex@minigames.com';
    fixture.email.dispatchEvent(new Event('input'));

    expect(fixture.submit.disabled).toBe(true);

    fixture.pending.setPending(false);

    expect(fixture.submit.disabled).toBe(false);
  });

  it('keeps submit disabled when validation is called directly', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);

    expect(fixture.isFormValid()).toBe(true);
    expect(fixture.submit.disabled).toBe(true);
  });

  it('blocks submit while pending and allows it after completion', () => {
    const fixture = createFixture();

    fixture.pending.setPending(true);

    const pendingSubmit = new Event('submit', { cancelable: true });
    fixture.form.dispatchEvent(pendingSubmit);

    expect(pendingSubmit.defaultPrevented).toBe(true);

    fixture.pending.setPending(false);

    const validSubmit = new Event('submit', { cancelable: true });
    fixture.form.dispatchEvent(validSubmit);

    expect(validSubmit.defaultPrevented).toBe(false);
  });
});

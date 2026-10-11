// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { bindAuthFormValidation } from './auth-form-validation';
import {
  validateConfirmPassword,
  validateEmail,
  validateLoginPassword,
} from '../../utils/auth-validation';

function createFixture() {
  const form = document.createElement('form');

  form.innerHTML = `
    <input id="email" type="email">
    <p id="email-error" hidden></p>

    <input id="password" type="password">
    <p id="password-error" hidden></p>

    <input id="confirmation" type="password">
    <p id="confirmation-error" hidden></p>

    <button type="submit">Submit</button>
  `;

  document.body.append(form);

  const email = form.querySelector('#email') as HTMLInputElement;
  const emailError = form.querySelector('#email-error') as HTMLParagraphElement;
  const password = form.querySelector('#password') as HTMLInputElement;
  const confirmation = form.querySelector('#confirmation') as HTMLInputElement;
  const confirmationError = form.querySelector('#confirmation-error') as HTMLParagraphElement;
  const submit = form.querySelector('button') as HTMLButtonElement;

  const isFormValid = bindAuthFormValidation(form, [
    { id: 'email', validate: validateEmail },
    { id: 'password', validate: validateLoginPassword },
    {
      id: 'confirmation',
      validate: (value: string) => validateConfirmPassword(value, password.value),
    },
  ]);

  return {
    form,
    email,
    emailError,
    password,
    confirmation,
    confirmationError,
    submit,
    isFormValid,
  };
}

function updateInput(input: HTMLInputElement, value: string, eventName = 'input'): void {
  input.value = value;
  input.dispatchEvent(new Event(eventName));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('bindAuthFormValidation', () => {
  it('initially disables submit without showing errors', () => {
    const { email, emailError, confirmationError, submit } = createFixture();

    expect(submit.disabled).toBe(true);
    expect(emailError.hidden).toBe(true);
    expect(emailError.textContent).toBe('');
    expect(confirmationError.hidden).toBe(true);
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });

  it.each(['input', 'change', 'blur'])('shows an inline error after %s', (eventName) => {
    const { email, emailError, submit } = createFixture();

    updateInput(email, 'invalid', eventName);

    expect(emailError.hidden).toBe(false);
    expect(emailError.textContent).toBe('Enter a valid email address.');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(submit.disabled).toBe(true);
  });

  it('clears the error when the field becomes valid', () => {
    const { email, emailError } = createFixture();

    updateInput(email, 'invalid');
    expect(emailError.hidden).toBe(false);

    updateInput(email, 'alex@minigames.com');

    expect(emailError.hidden).toBe(true);
    expect(emailError.textContent).toBe('');
    expect(email.getAttribute('aria-invalid')).toBe('false');
  });

  it('enables submit only when every field is valid', () => {
    const { email, password, confirmation, submit } = createFixture();

    updateInput(email, 'alex@minigames.com');
    expect(submit.disabled).toBe(true);

    updateInput(password, '123456');
    expect(submit.disabled).toBe(true);

    updateInput(confirmation, '123456');
    expect(submit.disabled).toBe(false);

    updateInput(email, 'invalid');
    expect(submit.disabled).toBe(true);
  });

  it('revalidates confirmation when the password changes', () => {
    const { email, password, confirmation, confirmationError, submit } = createFixture();

    updateInput(email, 'alex@minigames.com');
    updateInput(password, '123456');
    updateInput(confirmation, '123456');

    expect(submit.disabled).toBe(false);

    updateInput(password, '1234567');

    expect(confirmationError.hidden).toBe(false);
    expect(confirmationError.textContent).toBe('Passwords must match.');
    expect(submit.disabled).toBe(true);

    updateInput(confirmation, '1234567');

    expect(confirmationError.hidden).toBe(true);
    expect(submit.disabled).toBe(false);
  });

  it('blocks invalid submission and reveals required-field errors', () => {
    const { form, emailError, submit } = createFixture();
    const event = new Event('submit', { cancelable: true });

    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(emailError.hidden).toBe(false);
    expect(emailError.textContent).toBe('Email is required.');
    expect(submit.disabled).toBe(true);
  });

  it('allows valid submission', () => {
    const { form, email, password, confirmation } = createFixture();

    updateInput(email, 'alex@minigames.com');
    updateInput(password, '123456');
    updateInput(confirmation, '123456');

    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('returns validity when checked directly', () => {
    const { email, password, confirmation, submit, isFormValid } = createFixture();

    expect(isFormValid()).toBe(false);

    email.value = 'alex@minigames.com';
    password.value = '123456';
    confirmation.value = '123456';

    expect(isFormValid()).toBe(true);
    expect(submit.disabled).toBe(false);
  });

  it('clears errors and disables submit after reset', async () => {
    const { form, email, emailError, password, confirmation, submit } = createFixture();

    updateInput(email, 'invalid');
    updateInput(password, '123456');
    updateInput(confirmation, '123456');

    expect(emailError.hidden).toBe(false);

    form.reset();
    await Promise.resolve();

    expect(email.value).toBe('');
    expect(password.value).toBe('');
    expect(confirmation.value).toBe('');
    expect(emailError.hidden).toBe(true);
    expect(emailError.textContent).toBe('');
    expect(email.getAttribute('aria-invalid')).toBe('false');
    expect(submit.disabled).toBe(true);
  });

  it('reports a missing submit button', () => {
    const form = document.createElement('form');

    expect(() => bindAuthFormValidation(form, [])).toThrow('Auth form submit button is missing.');
  });

  it.each(['input', 'error'])('reports missing field markup: %s', (missingElement) => {
    const { form, email, emailError } = createFixture();

    if (missingElement === 'input') {
      email.remove();
    } else {
      emailError.remove();
    }

    expect(() => bindAuthFormValidation(form, [{ id: 'email', validate: validateEmail }])).toThrow(
      'Auth field markup is missing: email',
    );
  });
});

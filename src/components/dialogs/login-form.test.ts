// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { createLoginForm } from './login-form';

const authMocks = vi.hoisted(() => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/auth', () => ({
  loginWithEmail: authMocks.loginWithEmail,
  registerWithEmail: authMocks.registerWithEmail,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: authMocks.showSnackbar,
}));

const mockUser = {
  uid: 'test-user',
  email: 'alex@minigames.com',
  displayName: 'Alex',
} as User;

function createFixture(shouldUseCallbacks = true) {
  const onRegister = vi.fn();
  const onAuthenticated = vi.fn();
  const onPendingChange = vi.fn();

  const form = shouldUseCallbacks
    ? createLoginForm(onRegister, {
        onAuthenticated,
        onPendingChange,
      })
    : createLoginForm(onRegister);

  document.body.append(form);

  const email = form.querySelector<HTMLInputElement>('#login-email') as HTMLInputElement;

  const password = form.querySelector<HTMLInputElement>('#login-password') as HTMLInputElement;

  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  ) as HTMLButtonElement;

  const google = form.querySelector<HTMLButtonElement>(
    '.auth-form__button--google',
  ) as HTMLButtonElement;

  function fill(emailValue = 'alex@minigames.com', passwordValue = 'Ab1!xy'): void {
    email.value = emailValue;
    password.value = passwordValue;

    email.dispatchEvent(new Event('input'));
    password.dispatchEvent(new Event('input'));
  }

  return {
    form,
    email,
    password,
    submit,
    google,
    fill,
    onRegister,
    onAuthenticated,
    onPendingChange,
  };
}

function submitForm(form: HTMLFormElement): Event {
  const event = new Event('submit', { cancelable: true });
  form.dispatchEvent(event);

  return event;
}

beforeEach(() => {
  vi.resetAllMocks();
  authMocks.loginWithEmail.mockResolvedValue(mockUser);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('createLoginForm', () => {
  it.each([
    ['', ''],
    ['invalid-email', 'Ab1!xy'],
    ['alex@minigames.com', '123'],
  ])('does not send invalid credentials: %s / %s', (emailValue, passwordValue) => {
    const fixture = createFixture();
    fixture.fill(emailValue, passwordValue);

    const event = submitForm(fixture.form);

    expect(event.defaultPrevented).toBe(true);
    expect(authMocks.loginWithEmail).not.toHaveBeenCalled();
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.onPendingChange).not.toHaveBeenCalled();
    expect(fixture.form.querySelector('[aria-invalid="true"]')).toBeTruthy();
  });

  it('sends credentials and resets the form after successful login', async () => {
    const fixture = createFixture();
    fixture.fill('alex@minigames.com', ' Ab1!xy ');

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.loginWithEmail).toHaveBeenCalledExactlyOnceWith({
      email: 'alex@minigames.com',
      password: ' Ab1!xy ',
    });

    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.email.value).toBe('');
    expect(fixture.password.value).toBe('');
    expect(fixture.submit.textContent).toBe('Login');
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.google.disabled).toBe(false);

    expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
      'Signed in successfully.',
      'success',
    );
  });

  it('locks controls and prevents a second request while pending', async () => {
    const request: { resolve?: (user: User) => void } = {};

    authMocks.loginWithEmail.mockReturnValueOnce(
      new Promise<User>((resolve) => {
        request.resolve = resolve;
      }),
    );

    const fixture = createFixture();
    fixture.fill();

    submitForm(fixture.form);

    expect(fixture.form.getAttribute('aria-busy')).toBe('true');
    expect(fixture.submit.textContent).toBe('Signing in…');
    expect(fixture.onPendingChange).toHaveBeenCalledExactlyOnceWith(true);

    const controls = fixture.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    );

    for (const control of controls) {
      expect(control.disabled).toBe(true);
    }

    fixture.email.dispatchEvent(new Event('input'));

    const secondSubmit = submitForm(fixture.form);

    expect(secondSubmit.defaultPrevented).toBe(true);
    expect(fixture.submit.disabled).toBe(true);
    expect(authMocks.loginWithEmail).toHaveBeenCalledTimes(1);
    expect(fixture.onAuthenticated).not.toHaveBeenCalled();

    request.resolve?.(mockUser);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(fixture.email.disabled).toBe(false);
    expect(fixture.password.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
  });

  it('preserves credentials after failure and allows another attempt', async () => {
    authMocks.loginWithEmail.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    });

    const fixture = createFixture();
    fixture.fill();

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Incorrect email or password.',
        'error',
      );
    });

    expect(fixture.onAuthenticated).not.toHaveBeenCalled();
    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.email.value).toBe('alex@minigames.com');
    expect(fixture.password.value).toBe('Ab1!xy');
    expect(fixture.email.disabled).toBe(false);
    expect(fixture.password.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.submit.textContent).toBe('Login');

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.loginWithEmail).toHaveBeenCalledTimes(2);
    expect(authMocks.showSnackbar).toHaveBeenLastCalledWith('Signed in successfully.', 'success');
  });

  it('supports successful login without optional callbacks', async () => {
    const fixture = createFixture(false);
    fixture.fill();

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Signed in successfully.',
        'success',
      );
    });

    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.email.value).toBe('');
    expect(fixture.password.value).toBe('');
  });

  it('respects a submit event cancelled by another handler', () => {
    const fixture = createFixture();
    fixture.fill();

    fixture.form.addEventListener(
      'submit',
      (event: Event): void => {
        event.preventDefault();
      },
      { capture: true },
    );

    submitForm(fixture.form);

    expect(authMocks.loginWithEmail).not.toHaveBeenCalled();
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
  });

  it('requests registration when the Register button is clicked', () => {
    const fixture = createFixture();

    const register = fixture.form.querySelector<HTMLButtonElement>(
      ':scope .auth-form__footer button',
    ) as HTMLButtonElement;

    register.click();

    expect(fixture.onRegister).toHaveBeenCalledTimes(1);
  });

  it('toggles password visibility and restores it on reset', async () => {
    const fixture = createFixture();

    const toggle = fixture.form.querySelector<HTMLButtonElement>(
      '.auth-form__password-toggle',
    ) as HTMLButtonElement;

    toggle.click();

    expect(fixture.password.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');

    toggle.click();

    expect(fixture.password.type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.form.reset();
    await Promise.resolve();

    expect(fixture.password.type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
  });
});

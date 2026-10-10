// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { createRegisterForm } from './register-form';

const authMocks = vi.hoisted(() => ({
  registerWithEmail: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/auth', () => ({
  registerWithEmail: authMocks.registerWithEmail,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: authMocks.showSnackbar,
}));

const mockUser = {
  uid: 'new-user',
  email: 'alex@minigames.com',
  displayName: 'Alex',
} as User;

interface FormValues {
  readonly username?: string;
  readonly email?: string;
  readonly password?: string;
  readonly confirmation?: string;
}

function createFixture(shouldUseCallbacks = true) {
  const onLogin = vi.fn();
  const onAuthenticated = vi.fn();
  const onPendingChange = vi.fn();

  const form = shouldUseCallbacks
    ? createRegisterForm(onLogin, {
        onAuthenticated,
        onPendingChange,
      })
    : createRegisterForm(onLogin);

  document.body.append(form);

  const username = form.querySelector<HTMLInputElement>('#register-username') as HTMLInputElement;

  const email = form.querySelector<HTMLInputElement>('#register-email') as HTMLInputElement;

  const password = form.querySelector<HTMLInputElement>('#register-password') as HTMLInputElement;

  const confirmation = form.querySelector<HTMLInputElement>(
    '#register-confirm-password',
  ) as HTMLInputElement;

  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  ) as HTMLButtonElement;

  const google = form.querySelector<HTMLButtonElement>(
    '.auth-form__button--google',
  ) as HTMLButtonElement;

  function fill(values: FormValues = {}): void {
    username.value = values.username ?? 'Alex';
    email.value = values.email ?? 'alex@minigames.com';
    password.value = values.password ?? 'Ab1!xy';
    confirmation.value = values.confirmation ?? password.value;

    for (const input of [username, email, password, confirmation]) {
      input.dispatchEvent(new Event('input'));
    }
  }

  return {
    form,
    username,
    email,
    password,
    confirmation,
    submit,
    google,
    fill,
    onLogin,
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
  authMocks.registerWithEmail.mockResolvedValue(mockUser);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('createRegisterForm', () => {
  it('does not send an empty form', () => {
    const fixture = createFixture();

    const event = submitForm(fixture.form);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.submit.disabled).toBe(true);
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
    expect(fixture.onPendingChange).not.toHaveBeenCalled();
  });

  it.each([
    { username: 'alex' },
    { username: 'A' },
    { email: 'invalid-email' },
    { password: 'abcdef' },
    { confirmation: 'Different1!' },
  ])('does not send invalid form values: %j', (values) => {
    const fixture = createFixture();
    fixture.fill(values);

    submitForm(fixture.form);

    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.form.querySelector('[aria-invalid="true"]')).toBeTruthy();
  });

  it('sends registration credentials and resets the form on success', async () => {
    const fixture = createFixture();
    fixture.fill();

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.registerWithEmail).toHaveBeenCalledExactlyOnceWith({
      username: 'Alex',
      email: 'alex@minigames.com',
      password: 'Ab1!xy',
    });

    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');

    for (const input of [fixture.username, fixture.email, fixture.password, fixture.confirmation]) {
      expect(input.value).toBe('');
      expect(input.disabled).toBe(false);
    }

    expect(fixture.submit.textContent).toBe('Create Account');
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.google.disabled).toBe(false);

    expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
      'Account created successfully.',
      'success',
    );
  });

  it('locks controls and prevents duplicate registration while pending', async () => {
    const request: { resolve?: (user: User) => void } = {};

    authMocks.registerWithEmail.mockReturnValueOnce(
      new Promise<User>((resolve) => {
        request.resolve = resolve;
      }),
    );

    const fixture = createFixture();
    fixture.fill();

    submitForm(fixture.form);

    expect(fixture.form.getAttribute('aria-busy')).toBe('true');
    expect(fixture.submit.textContent).toBe('Creating account…');
    expect(fixture.onPendingChange).toHaveBeenCalledExactlyOnceWith(true);

    const controls = fixture.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    );

    for (const control of controls) {
      expect(control.disabled).toBe(true);
    }

    fixture.confirmation.dispatchEvent(new Event('input'));

    const secondSubmit = submitForm(fixture.form);

    expect(secondSubmit.defaultPrevented).toBe(true);
    expect(fixture.submit.disabled).toBe(true);
    expect(authMocks.registerWithEmail).toHaveBeenCalledTimes(1);
    expect(fixture.onAuthenticated).not.toHaveBeenCalled();

    request.resolve?.(mockUser);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(fixture.confirmation.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);
  });

  it('preserves all fields after failure and allows another attempt', async () => {
    authMocks.registerWithEmail.mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
    });

    const fixture = createFixture();
    fixture.fill();

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'This email is already registered. Please log in.',
        'error',
      );
    });

    expect(fixture.onAuthenticated).not.toHaveBeenCalled();
    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.username.value).toBe('Alex');
    expect(fixture.email.value).toBe('alex@minigames.com');
    expect(fixture.password.value).toBe('Ab1!xy');
    expect(fixture.confirmation.value).toBe('Ab1!xy');
    expect(fixture.submit.textContent).toBe('Create Account');
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.google.disabled).toBe(false);

    for (const input of [fixture.username, fixture.email, fixture.password, fixture.confirmation]) {
      expect(input.disabled).toBe(false);
    }

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.registerWithEmail).toHaveBeenCalledTimes(2);
    expect(authMocks.showSnackbar).toHaveBeenLastCalledWith(
      'Account created successfully.',
      'success',
    );
  });

  it('supports registration without optional callbacks', async () => {
    const fixture = createFixture(false);
    fixture.fill();

    submitForm(fixture.form);

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Account created successfully.',
        'success',
      );
    });

    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.username.value).toBe('');
    expect(fixture.email.value).toBe('');
    expect(fixture.password.value).toBe('');
    expect(fixture.confirmation.value).toBe('');
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

    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
  });

  it('requests login when the Login button is clicked', () => {
    const fixture = createFixture();

    const login = fixture.form.querySelector<HTMLButtonElement>(
      ':scope .auth-form__footer button',
    ) as HTMLButtonElement;

    login.click();

    expect(fixture.onLogin).toHaveBeenCalledTimes(1);
  });
});

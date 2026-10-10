// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { createLoginForm } from './login-form';
import { createRegisterForm } from './register-form';

const authMocks = vi.hoisted(() => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/auth', () => ({
  loginWithEmail: authMocks.loginWithEmail,
  registerWithEmail: authMocks.registerWithEmail,
  loginWithGoogle: authMocks.loginWithGoogle,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: authMocks.showSnackbar,
}));

const mockUser = {
  uid: 'google-user',
  email: 'alex@minigames.com',
  displayName: 'Alex',
} as User;

const validValues = new Map<string, string>([
  ['login-email', 'alex@minigames.com'],
  ['login-password', 'Ab1!xy'],
  ['register-username', 'Alex'],
  ['register-email', 'alex@minigames.com'],
  ['register-password', 'Ab1!xy'],
  ['register-confirm-password', 'Ab1!xy'],
]);

function createFixture(createForm: typeof createLoginForm, shouldUseCallbacks = true) {
  const onAuthenticated = vi.fn();
  const onPendingChange = vi.fn();

  const form = shouldUseCallbacks
    ? createForm(vi.fn(), {
        onAuthenticated,
        onPendingChange,
      })
    : createForm(vi.fn());

  document.body.append(form);

  const google = form.querySelector<HTMLButtonElement>(
    '.auth-form__button--google',
  ) as HTMLButtonElement;

  const label = google.querySelector<HTMLSpanElement>('span') as HTMLSpanElement;

  const submit = form.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  ) as HTMLButtonElement;

  const inputs = [...form.querySelectorAll<HTMLInputElement>('input')];

  function fill(): void {
    for (const input of inputs) {
      input.value = validValues.get(input.id) ?? '';
      input.dispatchEvent(new Event('input'));
    }
  }

  return {
    form,
    google,
    label,
    submit,
    inputs,
    fill,
    onAuthenticated,
    onPendingChange,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  authMocks.loginWithEmail.mockResolvedValue(mockUser);
  authMocks.registerWithEmail.mockResolvedValue(mockUser);
  authMocks.loginWithGoogle.mockResolvedValue(mockUser);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe.each([
  {
    mode: 'login',
    createForm: createLoginForm,
    originalLabel: 'Continue with Google',
  },
  {
    mode: 'register',
    createForm: createRegisterForm,
    originalLabel: 'Sign up with Google',
  },
])('$mode Google sign-in', ({ createForm, originalLabel }) => {
  it('allows Google sign-in with empty form fields', async () => {
    const fixture = createFixture(createForm);
    const icon = fixture.google.querySelector('img');

    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.google.disabled).toBe(false);

    fixture.google.click();

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.loginWithGoogle).toHaveBeenCalledExactlyOnceWith();
    expect(authMocks.loginWithEmail).not.toHaveBeenCalled();
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(true);
    expect(fixture.label.textContent).toBe(originalLabel);
    expect(fixture.google.querySelector('img')).toBe(icon);

    expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
      'Signed in successfully.',
      'success',
    );
  });

  it('locks controls and blocks other authentication requests', async () => {
    const request: { resolve?: (user: User) => void } = {};

    authMocks.loginWithGoogle.mockReturnValueOnce(
      new Promise<User>((resolve) => {
        request.resolve = resolve;
      }),
    );

    const fixture = createFixture(createForm);
    fixture.fill();
    fixture.google.click();

    expect(fixture.form.getAttribute('aria-busy')).toBe('true');
    expect(fixture.label.textContent).toBe('Connecting to Google…');
    expect(fixture.onPendingChange).toHaveBeenCalledExactlyOnceWith(true);

    const controls = fixture.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    );

    for (const control of controls) {
      expect(control.disabled).toBe(true);
    }

    for (const input of fixture.inputs) {
      input.dispatchEvent(new Event('input'));
    }

    fixture.google.dispatchEvent(new MouseEvent('click'));

    const submitEvent = new Event('submit', { cancelable: true });
    fixture.form.dispatchEvent(submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(fixture.submit.disabled).toBe(true);
    expect(authMocks.loginWithGoogle).toHaveBeenCalledTimes(1);
    expect(authMocks.loginWithEmail).not.toHaveBeenCalled();
    expect(authMocks.registerWithEmail).not.toHaveBeenCalled();
    expect(fixture.onAuthenticated).not.toHaveBeenCalled();

    request.resolve?.(mockUser);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(fixture.google.disabled).toBe(false);
    expect(fixture.label.textContent).toBe(originalLabel);

    for (const input of fixture.inputs) {
      expect(input.disabled).toBe(false);
      expect(input.value).toBe('');
    }
  });

  it.each([
    {
      code: 'auth/popup-closed-by-user',
      message: 'Google sign-in was cancelled. You can try again.',
    },
    {
      code: 'auth/popup-blocked',
      message: 'Allow pop-ups in your browser and try Google sign-in again.',
    },
  ])('preserves fields and permits retry after $code', async ({ code, message }) => {
    authMocks.loginWithGoogle.mockRejectedValueOnce({ code });

    const fixture = createFixture(createForm);
    fixture.fill();

    const originalValues = fixture.inputs.map((input) => input.value);

    fixture.google.click();

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(message, 'error');
    });

    expect(fixture.onAuthenticated).not.toHaveBeenCalled();
    expect(fixture.onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.submit.disabled).toBe(false);
    expect(fixture.label.textContent).toBe(originalLabel);
    expect(fixture.inputs.map((input) => input.value)).toEqual(originalValues);

    for (const input of fixture.inputs) {
      expect(input.disabled).toBe(false);
    }

    fixture.google.click();

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(authMocks.loginWithGoogle).toHaveBeenCalledTimes(2);
    expect(authMocks.showSnackbar).toHaveBeenLastCalledWith('Signed in successfully.', 'success');
  });

  it('does not start Google sign-in while an email request is pending', async () => {
    const emailOperation =
      createForm === createLoginForm ? authMocks.loginWithEmail : authMocks.registerWithEmail;

    const request: { resolve?: (user: User) => void } = {};

    emailOperation.mockReturnValueOnce(
      new Promise<User>((resolve) => {
        request.resolve = resolve;
      }),
    );

    const fixture = createFixture(createForm);
    fixture.fill();

    fixture.form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(emailOperation).toHaveBeenCalledTimes(1);
    expect(fixture.form.getAttribute('aria-busy')).toBe('true');

    fixture.google.dispatchEvent(new MouseEvent('click'));

    expect(authMocks.loginWithGoogle).not.toHaveBeenCalled();

    request.resolve?.(mockUser);

    await vi.waitFor(() => {
      expect(fixture.onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(fixture.google.disabled).toBe(false);
  });

  it('supports Google sign-in without optional callbacks', async () => {
    const fixture = createFixture(createForm, false);

    fixture.google.click();

    await vi.waitFor(() => {
      expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Signed in successfully.',
        'success',
      );
    });

    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(fixture.google.disabled).toBe(false);
    expect(fixture.label.textContent).toBe(originalLabel);
  });
});

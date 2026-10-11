// @vitest-environment jsdom

import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLoginForm } from './login-form';
import type { LoginFormCallbacks } from './login-form';
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
  uid: 'user-1',
  email: 'alex@minigames.com',
  displayName: 'Alex',
} as User;

interface AuthFlow {
  readonly name: string;
  readonly createForm: typeof createLoginForm;
  readonly kind: 'email' | 'google';
  readonly operation: typeof authMocks.loginWithEmail;
  readonly successMessage: string;
}

const flows: readonly AuthFlow[] = [
  {
    name: 'email login',
    createForm: createLoginForm,
    kind: 'email',
    operation: authMocks.loginWithEmail,
    successMessage: 'Signed in successfully.',
  },
  {
    name: 'email registration',
    createForm: createRegisterForm,
    kind: 'email',
    operation: authMocks.registerWithEmail,
    successMessage: 'Account created successfully.',
  },
  {
    name: 'Google from login',
    createForm: createLoginForm,
    kind: 'google',
    operation: authMocks.loginWithGoogle,
    successMessage: 'Signed in successfully.',
  },
  {
    name: 'Google from registration',
    createForm: createRegisterForm,
    kind: 'google',
    operation: authMocks.loginWithGoogle,
    successMessage: 'Signed in successfully.',
  },
];

const inputValues = new Map([
  ['login-email', 'alex@minigames.com'],
  ['login-password', 'Ab1!xy'],
  ['register-username', 'Alex'],
  ['register-email', 'alex@minigames.com'],
  ['register-password', 'Ab1!xy'],
  ['register-confirm-password', 'Ab1!xy'],
]);

function createDeferred() {
  const completion: { resolve?: () => void } = {};

  const promise = new Promise<void>((resolve) => {
    completion.resolve = resolve;
  });

  return {
    promise,
    resolve(): void {
      completion.resolve?.();
    },
  };
}

function createFixture(flow: AuthFlow, callbacks: LoginFormCallbacks) {
  const form = flow.createForm(vi.fn(), callbacks);
  document.body.append(form);

  const inputs = [...form.querySelectorAll<HTMLInputElement>('input')];

  for (const input of inputs) {
    input.value = inputValues.get(input.id) ?? '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const originalValues = inputs.map((input) => input.value);

  return { form, inputs, originalValues };
}

function startAuthentication(flow: AuthFlow, form: HTMLFormElement): void {
  if (flow.kind === 'google') {
    const google = form.querySelector<HTMLButtonElement>('.auth-form__button--google');

    if (!google) {
      throw new Error('Google button is missing.');
    }

    google.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return;
  }

  form.dispatchEvent(new Event('submit', { cancelable: true }));
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

describe.each(flows)('$name session callbacks', (flow) => {
  it('waits for preparation before starting Firebase authentication', async () => {
    const preparation = createDeferred();
    const onBeforeAuthenticate = vi.fn(() => preparation.promise);
    const onAuthenticated = vi.fn();
    const onAuthenticationComplete = vi.fn();

    const fixture = createFixture(flow, {
      onBeforeAuthenticate,
      onAuthenticated,
      onAuthenticationComplete,
    });

    startAuthentication(flow, fixture.form);

    expect(fixture.form.getAttribute('aria-busy')).toBe('true');
    expect(flow.operation).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(authMocks.showSnackbar).not.toHaveBeenCalled();

    startAuthentication(flow, fixture.form);

    expect(onBeforeAuthenticate).toHaveBeenCalledTimes(1);

    preparation.resolve();

    await vi.waitFor(() => {
      expect(onAuthenticationComplete).toHaveBeenCalledTimes(1);
    });

    expect(flow.operation).toHaveBeenCalledTimes(1);
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(flow.successMessage, 'success');
  });

  it('stays pending until session activation finishes', async () => {
    const activation = createDeferred();
    const onAuthenticated = vi.fn(() => activation.promise);
    const onAuthenticationComplete = vi.fn();
    const onPendingChange = vi.fn();

    const fixture = createFixture(flow, {
      onAuthenticated,
      onAuthenticationComplete,
      onPendingChange,
    });

    onAuthenticationComplete.mockImplementation(() => {
      expect(fixture.form.getAttribute('aria-busy')).toBe('false');
    });

    startAuthentication(flow, fixture.form);

    await vi.waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(mockUser);
    });

    expect(fixture.form.getAttribute('aria-busy')).toBe('true');
    expect(onPendingChange.mock.calls).toEqual([[true]]);
    expect(onAuthenticationComplete).not.toHaveBeenCalled();
    expect(authMocks.showSnackbar).not.toHaveBeenCalled();
    expect(fixture.inputs.map((input) => input.value)).toEqual(fixture.originalValues);

    const controls = fixture.form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input, button',
    );

    for (const control of controls) {
      expect(control.disabled).toBe(true);
    }

    startAuthentication(flow, fixture.form);

    expect(flow.operation).toHaveBeenCalledTimes(1);

    activation.resolve();

    await vi.waitFor(() => {
      expect(onAuthenticationComplete).toHaveBeenCalledTimes(1);
    });

    expect(onPendingChange.mock.calls).toEqual([[true], [false]]);
    expect(fixture.inputs.every((input) => input.value === '')).toBe(true);
    expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(flow.successMessage, 'success');
  });

  it.each(['preparation', 'activation'] as const)(
    'preserves fields after a %s failure and allows retry',
    async (stage) => {
      const error = new Error('Session operation failed');
      const onBeforeAuthenticate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const onAuthenticated = vi.fn<(user: User) => Promise<void>>().mockResolvedValue(undefined);
      const onAuthenticationComplete = vi.fn();

      if (stage === 'preparation') {
        onBeforeAuthenticate.mockRejectedValueOnce(error);
      } else {
        onAuthenticated.mockRejectedValueOnce(error);
      }

      const fixture = createFixture(flow, {
        onBeforeAuthenticate,
        onAuthenticated,
        onAuthenticationComplete,
      });

      startAuthentication(flow, fixture.form);

      await vi.waitFor(() => {
        expect(authMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
          'Authentication could not be completed. Please try again.',
          'error',
        );
        expect(fixture.form.getAttribute('aria-busy')).toBe('false');
      });

      expect(onAuthenticationComplete).not.toHaveBeenCalled();
      expect(fixture.inputs.map((input) => input.value)).toEqual(fixture.originalValues);
      expect(flow.operation).toHaveBeenCalledTimes(stage === 'preparation' ? 0 : 1);

      for (const input of fixture.inputs) {
        expect(input.disabled).toBe(false);
      }

      startAuthentication(flow, fixture.form);

      await vi.waitFor(() => {
        expect(onAuthenticationComplete).toHaveBeenCalledTimes(1);
      });

      expect(flow.operation).toHaveBeenCalledTimes(stage === 'preparation' ? 1 : 2);
      expect(fixture.form.getAttribute('aria-busy')).toBe('false');
      expect(authMocks.showSnackbar).toHaveBeenCalledTimes(2);
      expect(authMocks.showSnackbar).toHaveBeenLastCalledWith(flow.successMessage, 'success');
    },
  );
});

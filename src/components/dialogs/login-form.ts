import './auth-form.scss';
import { createAuthField } from './register-form';
import { bindAuthFormValidation } from './auth-form-validation';
import { validateEmail, validateLoginPassword } from '../../utils/auth-validation';
import type { User } from 'firebase/auth';
import { loginWithEmail } from '../../services/auth';
import { getAuthErrorMessage } from '../../utils/auth-error-message';
import { showSnackbar } from '../snackbar/snackbar';
import { createAuthFormPending } from './auth-form-pending';
import { bindGoogleAuth } from './auth-form-google';

import emailIconUrl from '../../assets/icons/auth-email.svg';
import lockIconUrl from '../../assets/icons/auth-lock.svg';
import eyeIconUrl from '../../assets/icons/auth-eye.svg';
import googleIconUrl from '../../assets/icons/google.svg';

export interface LoginFormCallbacks {
  readonly onAuthenticated?: (user: User) => void;
  readonly onPendingChange?: (isPending: boolean) => void;
}

export function createLoginForm(
  onRegister: () => void,
  callbacks: LoginFormCallbacks = {},
): HTMLFormElement {
  const form: HTMLFormElement = document.createElement('form');
  form.className = 'auth-form';
  form.noValidate = true;
  form.setAttribute('aria-labelledby', 'login-title');

  const header: HTMLDivElement = document.createElement('div');
  header.className = 'auth-form__header';

  const title: HTMLHeadingElement = document.createElement('h2');
  title.id = 'login-title';
  title.className = 'auth-form__title';
  title.textContent = 'Welcome Back!';

  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'auth-form__description';
  description.textContent = 'Sign in to resume your games and progress.';

  header.append(title, description);

  const fields: HTMLDivElement = document.createElement('div');
  fields.className = 'auth-form__fields';

  const email: HTMLDivElement = createAuthField({
    id: 'login-email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'e.g. alex@minigames.com',
    autocomplete: 'username',
    iconUrl: emailIconUrl,
  });

  const password: HTMLDivElement = createAuthField({
    id: 'login-password',
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
    autocomplete: 'current-password',
    iconUrl: lockIconUrl,
  });

  const passwordInput: HTMLInputElement | null = password.querySelector('input');
  const passwordControl: HTMLDivElement | null = password.querySelector('.auth-form__control');

  if (passwordInput && passwordControl) {
    passwordInput.classList.add('auth-form__input--password');

    const toggle: HTMLButtonElement = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'auth-form__password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-controls', passwordInput.id);

    const eye: HTMLImageElement = document.createElement('img');
    eye.src = eyeIconUrl;
    eye.alt = '';
    eye.width = 24;
    eye.height = 24;

    toggle.append(eye);

    toggle.addEventListener('click', (): void => {
      const isVisible: boolean = passwordInput.type === 'password';
      passwordInput.type = isVisible ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(isVisible));
      toggle.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    });

    form.addEventListener('reset', (): void => {
      passwordInput.type = 'password';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Show password');
    });

    passwordControl.append(toggle);
  }

  fields.append(email, password);

  const recovery: HTMLDivElement = document.createElement('div');
  recovery.className = 'auth-form__recovery';

  const forgot: HTMLButtonElement = document.createElement('button');
  forgot.type = 'button';
  forgot.className = 'auth-form__switch';
  forgot.textContent = 'Forgot Password?';
  recovery.append(forgot);

  const submit: HTMLButtonElement = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'auth-form__button auth-form__button--primary';
  submit.textContent = 'Login';

  const divider: HTMLDivElement = document.createElement('div');
  divider.className = 'auth-form__divider';
  divider.textContent = 'OR';
  divider.setAttribute('aria-hidden', 'true');

  const google: HTMLButtonElement = document.createElement('button');
  google.type = 'button';
  google.className = 'auth-form__button auth-form__button--google';

  const googleIcon: HTMLImageElement = document.createElement('img');
  googleIcon.className = 'auth-form__google-icon';
  googleIcon.src = googleIconUrl;
  googleIcon.alt = '';
  googleIcon.width = 24;
  googleIcon.height = 24;

  const googleText: HTMLSpanElement = document.createElement('span');
  googleText.textContent = 'Continue with Google';

  google.append(googleIcon, googleText);

  const footer: HTMLParagraphElement = document.createElement('p');
  footer.className = 'auth-form__footer';

  const register: HTMLButtonElement = document.createElement('button');
  register.type = 'button';
  register.className = 'auth-form__switch';
  register.textContent = 'Register';
  register.addEventListener('click', onRegister);

  footer.append("Don't have an account? ", register);

  form.append(header, fields, recovery, submit, divider, google, footer);

  const isFormValid = bindAuthFormValidation(form, [
    {
      id: 'login-email',
      validate: validateEmail,
    },
    {
      id: 'login-password',
      validate: validateLoginPassword,
    },
  ]);

  const pending = createAuthFormPending(form, isFormValid);
  bindGoogleAuth({
    form,
    button: google,
    label: googleText,
    pending,
    callbacks,
  });

  async function submitLogin(): Promise<void> {
    const formData = new FormData(form);

    const credentials = {
      email: String(formData.get('login-email') ?? ''),
      password: String(formData.get('login-password') ?? ''),
    };

    pending.setPending(true);
    submit.textContent = 'Signing in…';

    let user: User;

    try {
      callbacks.onPendingChange?.(true);
      user = await loginWithEmail(credentials);
    } catch (error: unknown) {
      showSnackbar(getAuthErrorMessage(error), 'error');
      return;
    } finally {
      pending.setPending(false);
      submit.textContent = 'Login';
      callbacks.onPendingChange?.(false);
    }

    form.reset();
    callbacks.onAuthenticated?.(user);
    showSnackbar('Signed in successfully.', 'success');
  }

  form.addEventListener('submit', (event: SubmitEvent): void => {
    const shouldSkipSubmit = event.defaultPrevented || pending.isPending();

    event.preventDefault();

    if (shouldSkipSubmit || !isFormValid()) {
      return;
    }

    void submitLogin();
  });

  return form;
}

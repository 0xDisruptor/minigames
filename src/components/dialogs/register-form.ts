import './auth-form.scss';
import { bindAuthFormValidation } from './auth-form-validation';
import {
  validateConfirmPassword,
  validateEmail,
  validateRegisterPassword,
  validateUsername,
} from '../../utils/auth-validation';
import type { User } from 'firebase/auth';
import { registerWithEmail } from '../../services/auth';
import { getAuthErrorMessage } from '../../utils/auth-error-message';
import { showSnackbar } from '../snackbar/snackbar';
import { createAuthFormPending } from './auth-form-pending';

import userIconUrl from '../../assets/icons/auth-user.svg';
import emailIconUrl from '../../assets/icons/auth-email.svg';
import lockIconUrl from '../../assets/icons/auth-lock.svg';
import googleIconUrl from '../../assets/icons/google.svg';

interface AuthFieldOptions {
  readonly id: string;
  readonly label: string;
  readonly type: 'text' | 'email' | 'password';
  readonly placeholder: string;
  readonly autocomplete: string;
  readonly iconUrl: string;
}

export function createAuthField(options: AuthFieldOptions): HTMLDivElement {
  const field: HTMLDivElement = document.createElement('div');
  field.className = 'auth-form__field';

  const label: HTMLLabelElement = document.createElement('label');
  label.className = 'auth-form__label';
  label.htmlFor = options.id;
  label.textContent = options.label;

  const control: HTMLDivElement = document.createElement('div');
  control.className = 'auth-form__control';

  const icon: HTMLImageElement = document.createElement('img');
  icon.className = 'auth-form__field-icon';
  icon.src = options.iconUrl;
  icon.alt = '';
  icon.width = 16;
  icon.height = 16;

  const input: HTMLInputElement = document.createElement('input');
  input.className = 'auth-form__input';
  input.id = options.id;
  input.name = options.id;
  input.type = options.type;
  input.placeholder = options.placeholder;
  input.setAttribute('autocomplete', options.autocomplete);
  input.required = true;
  input.setAttribute('aria-invalid', 'false');

  const error: HTMLParagraphElement = document.createElement('p');
  error.id = `${options.id}-error`;
  error.className = 'auth-form__error';
  error.setAttribute('aria-live', 'polite');
  error.hidden = true;

  input.setAttribute('aria-describedby', error.id);

  if (options.type === 'email') {
    input.inputMode = 'email';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'none');
  }

  control.append(icon, input);
  field.append(label, control, error);

  return field;
}

export interface RegistrationFormCallbacks {
  readonly onAuthenticated?: (user: User) => void;
  readonly onPendingChange?: (isPending: boolean) => void;
}

export function createRegisterForm(
  onLogin: () => void,
  callbacks: RegistrationFormCallbacks = {},
): HTMLFormElement {
  const form: HTMLFormElement = document.createElement('form');
  form.className = 'auth-form';
  form.noValidate = true;
  form.setAttribute('aria-labelledby', 'register-title');

  const header: HTMLDivElement = document.createElement('div');
  header.className = 'auth-form__header';

  const title: HTMLHeadingElement = document.createElement('h2');
  title.id = 'register-title';
  title.className = 'auth-form__title';
  title.textContent = 'Create Account';

  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'auth-form__description';
  description.textContent = 'Join MiniGames to track your score & streak.';

  header.append(title, description);

  const fields: HTMLDivElement = document.createElement('div');
  fields.className = 'auth-form__fields';

  const fieldOptions: readonly AuthFieldOptions[] = [
    {
      id: 'register-username',
      label: 'Username',
      type: 'text',
      placeholder: 'e.g. CozyGamer99',
      autocomplete: 'username',
      iconUrl: userIconUrl,
    },
    {
      id: 'register-email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'your.email@domain.com',
      autocomplete: 'email',
      iconUrl: emailIconUrl,
    },
    {
      id: 'register-password',
      label: 'Password',
      type: 'password',
      placeholder: 'Min. 6 characters',
      autocomplete: 'new-password',
      iconUrl: lockIconUrl,
    },
    {
      id: 'register-confirm-password',
      label: 'Confirm Password',
      type: 'password',
      placeholder: 'Repeat your password',
      autocomplete: 'new-password',
      iconUrl: lockIconUrl,
    },
  ];

  for (const options of fieldOptions) {
    fields.append(createAuthField(options));
  }

  const submit: HTMLButtonElement = document.createElement('button');
  submit.className = 'auth-form__button auth-form__button--primary';
  submit.type = 'submit';
  submit.textContent = 'Create Account';

  const divider: HTMLDivElement = document.createElement('div');
  divider.className = 'auth-form__divider';
  divider.textContent = 'OR';
  divider.setAttribute('aria-hidden', 'true');

  const google: HTMLButtonElement = document.createElement('button');
  google.className = 'auth-form__button auth-form__button--google';
  google.type = 'button';

  const googleIcon: HTMLImageElement = document.createElement('img');
  googleIcon.className = 'auth-form__google-icon';
  googleIcon.src = googleIconUrl;
  googleIcon.alt = '';
  googleIcon.width = 24;
  googleIcon.height = 24;

  const googleText: HTMLSpanElement = document.createElement('span');
  googleText.textContent = 'Sign up with Google';

  google.append(googleIcon, googleText);

  const footer: HTMLParagraphElement = document.createElement('p');
  footer.className = 'auth-form__footer';

  const login: HTMLButtonElement = document.createElement('button');
  login.className = 'auth-form__switch';
  login.type = 'button';
  login.textContent = 'Login';
  login.addEventListener('click', onLogin);

  footer.append('Already have an account? ', login);

  form.append(header, fields, submit, divider, google, footer);

  const passwordElement = form.querySelector<HTMLInputElement>('#register-password');

  if (!passwordElement) {
    throw new Error('Registration password input is missing.');
  }

  const passwordInput: HTMLInputElement = passwordElement;

  const isFormValid = bindAuthFormValidation(form, [
    {
      id: 'register-username',
      validate: validateUsername,
    },
    {
      id: 'register-email',
      validate: validateEmail,
    },
    {
      id: 'register-password',
      validate: validateRegisterPassword,
    },
    {
      id: 'register-confirm-password',
      validate: (value: string) => validateConfirmPassword(value, passwordInput.value),
    },
  ]);

  const pending = createAuthFormPending(form, isFormValid);

  async function submitRegistration(): Promise<void> {
    const formData = new FormData(form);

    const credentials = {
      username: String(formData.get('register-username') ?? ''),
      email: String(formData.get('register-email') ?? ''),
      password: String(formData.get('register-password') ?? ''),
    };

    pending.setPending(true);
    submit.textContent = 'Creating account…';

    let user: User;

    try {
      callbacks.onPendingChange?.(true);
      user = await registerWithEmail(credentials);
    } catch (error: unknown) {
      showSnackbar(getAuthErrorMessage(error), 'error');
      return;
    } finally {
      pending.setPending(false);
      submit.textContent = 'Create Account';
      callbacks.onPendingChange?.(false);
    }

    form.reset();
    callbacks.onAuthenticated?.(user);
    showSnackbar('Account created successfully.', 'success');
  }

  form.addEventListener('submit', (event: SubmitEvent): void => {
    const shouldSkipSubmit = event.defaultPrevented || pending.isPending();

    event.preventDefault();

    if (shouldSkipSubmit || !isFormValid()) {
      return;
    }

    void submitRegistration();
  });

  return form;
}

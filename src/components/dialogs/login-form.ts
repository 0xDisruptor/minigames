import './auth-form.scss';
import { createAuthField } from './register-form';

import emailIconUrl from '../../assets/icons/auth-email.svg';
import lockIconUrl from '../../assets/icons/auth-lock.svg';
import eyeIconUrl from '../../assets/icons/auth-eye.svg';
import googleIconUrl from '../../assets/icons/google.svg';

export function createLoginForm(onRegister: () => void): HTMLFormElement {
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

  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
  });

  return form;
}

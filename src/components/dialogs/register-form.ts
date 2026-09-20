import './auth-form.scss';

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

  if (options.type === 'email') {
    input.inputMode = 'email';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'none');
  }

  control.append(icon, input);
  field.append(label, control);

  return field;
}

export function createRegisterForm(onLogin: () => void): HTMLFormElement {
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
      placeholder: 'e.g. CozyGamer_99',
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
      placeholder: 'Min. 8 characters',
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

  // Story 1 implements the form UI without submitting credentials.
  form.addEventListener('submit', (event: SubmitEvent): void => {
    event.preventDefault();
  });

  return form;
}

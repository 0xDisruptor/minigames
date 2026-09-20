import './header.scss';
import logoUrl from '../../assets/images/logo.svg';
import menuUrl from '../../assets/icons/menu.svg';
import { createMobileMenu } from './mobile-menu';
import type { OpenAuth } from '../dialogs/auth-dialog';

function createButton(label: string, className: string): HTMLButtonElement {
  const button: HTMLButtonElement = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;

  return button;
}

export function createHeader(onAuth: OpenAuth): HTMLElement {
  const header: HTMLElement = document.createElement('header');
  header.className = 'header';

  const container: HTMLDivElement = document.createElement('div');
  container.className = 'header__container';

  const logo: HTMLAnchorElement = document.createElement('a');
  logo.className = 'header__logo';
  logo.href = '#/';
  logo.setAttribute('aria-label', 'MiniGames home');

  const logoImage: HTMLImageElement = document.createElement('img');
  logoImage.src = logoUrl;
  logoImage.alt = '';
  logoImage.width = 32;
  logoImage.height = 32;

  const logoText: HTMLSpanElement = document.createElement('span');
  logoText.textContent = 'MiniGames';

  logo.append(logoImage, logoText);

  const navigation: HTMLElement = document.createElement('nav');
  navigation.className = 'header__nav';
  navigation.setAttribute('aria-label', 'Main navigation');

  const list: HTMLUListElement = document.createElement('ul');
  list.className = 'header__list';

  const navigationLabels: string[] = ['Home', 'Library', 'Tournaments', 'Community'];

  for (const label of navigationLabels) {
    const item: HTMLLIElement = document.createElement('li');
    const link: HTMLAnchorElement = document.createElement('a');

    link.className = 'header__link';
    link.href = '#/';
    link.textContent = label;

    if (label === 'Home') {
      link.setAttribute('aria-current', 'page');
    }

    item.append(link);
    list.append(item);
  }

  navigation.append(list);

  const actions: HTMLDivElement = document.createElement('div');
  actions.className = 'header__actions';

  const loginButton: HTMLButtonElement = createButton(
    'Log In',
    'header__button header__button--login',
  );

  const signupButton: HTMLButtonElement = createButton(
    'Sign Up',
    'header__button header__button--signup',
  );

  const menuButton: HTMLButtonElement = createButton('', 'header__menu-button');
  menuButton.setAttribute('aria-label', 'Open navigation menu');
  menuButton.setAttribute('aria-expanded', 'false');

  const menuImage: HTMLImageElement = document.createElement('img');
  menuImage.src = menuUrl;
  menuImage.alt = '';
  menuImage.width = 32;
  menuImage.height = 32;

  loginButton.addEventListener('click', (): void => {
    onAuth('login', loginButton);
  });

  signupButton.addEventListener('click', (): void => {
    onAuth('register', signupButton);
  });

  menuButton.append(menuImage);
  actions.append(loginButton, signupButton, menuButton);
  container.append(logo, navigation, actions);
  const mobileMenu: HTMLDialogElement = createMobileMenu(menuButton, onAuth);
  header.append(container, mobileMenu);

  return header;
}

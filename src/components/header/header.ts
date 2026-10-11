import './header.scss';

import logoUrl from '../../assets/images/logo.svg';
import menuUrl from '../../assets/icons/menu.svg';
import { getPageUrl } from '../../app/navigation';
import { appSessionStore } from '../../state/store';
import type { AppSessionStore } from '../../state/store';
import type { AppSession } from '../../state/app-session';
import { createMobileMenu } from './mobile-menu';
import { createUserProfile } from './user-profile';
import { showSnackbar } from '../snackbar/snackbar';
import type { OpenAuth } from '../dialogs/auth-dialog';

function createButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = className;
  button.textContent = label;

  return button;
}

export function createHeader(
  onAuth: OpenAuth,
  onLogout: () => Promise<void>,
  store: AppSessionStore = appSessionStore,
): HTMLElement {
  const header = document.createElement('header');
  header.className = 'header';

  const container = document.createElement('div');
  container.className = 'header__container';

  const logo = document.createElement('a');
  logo.className = 'header__logo';
  logo.href = getPageUrl('/');
  logo.setAttribute('aria-label', 'MiniGames home');

  const logoImage = document.createElement('img');
  logoImage.src = logoUrl;
  logoImage.alt = '';
  logoImage.width = 32;
  logoImage.height = 32;

  const logoText = document.createElement('span');
  logoText.textContent = 'MiniGames';

  logo.append(logoImage, logoText);

  const navigation = document.createElement('nav');
  navigation.className = 'header__nav';
  navigation.setAttribute('aria-label', 'Main navigation');

  const list = document.createElement('ul');
  list.className = 'header__list';

  const navigationLabels = ['Home', 'Library', 'Tournaments', 'Community'];

  for (const label of navigationLabels) {
    const item = document.createElement('li');
    const link = document.createElement('a');

    link.className = 'header__link';
    link.href = getPageUrl(label === 'Library' ? '/library' : '/');
    link.textContent = label;

    if (label === 'Home' || label === 'Library') {
      link.dataset.navPage = label.toLowerCase();
    }

    item.append(link);
    list.append(item);
  }

  navigation.append(list);

  const actions = document.createElement('div');
  actions.className = 'header__actions';

  const loginButton = createButton('Log In', 'header__button header__button--login');

  const signupButton = createButton('Sign Up', 'header__button header__button--signup');

  const profileContainer = document.createElement('div');
  profileContainer.className = 'header__profile';

  const logoutButton = createButton('Log Out', 'header__button header__button--logout');

  const menuButton = createButton('', 'header__menu-button');
  menuButton.setAttribute('aria-label', 'Open navigation menu');
  menuButton.setAttribute('aria-expanded', 'false');

  const menuImage = document.createElement('img');
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

  let isLoggingOut = false;

  async function requestLogout(): Promise<void> {
    if (isLoggingOut || !store.getSession()) {
      return;
    }

    isLoggingOut = true;
    logoutButton.disabled = true;

    try {
      await onLogout();
    } catch {
      showSnackbar('Unable to sign out. Please try again.', 'error');
    } finally {
      isLoggingOut = false;
      logoutButton.disabled = false;
    }
  }

  logoutButton.addEventListener('click', (): void => {
    void requestLogout();
  });

  menuButton.append(menuImage);
  actions.append(loginButton, signupButton, profileContainer, logoutButton, menuButton);
  container.append(logo, navigation, actions);

  const mobileMenu = createMobileMenu(menuButton, onAuth, onLogout, store);
  header.append(container, mobileMenu);

  function renderSession(session: AppSession | undefined): void {
    const isAuthenticated = !!session;

    loginButton.hidden = isAuthenticated;
    signupButton.hidden = isAuthenticated;
    profileContainer.hidden = !isAuthenticated;
    logoutButton.hidden = !isAuthenticated;

    profileContainer.replaceChildren();

    if (session) {
      profileContainer.append(createUserProfile(session));
    }
  }

  const unsubscribe = store.subscribe(renderSession);

  header.addEventListener(
    'header-dispose',
    (): void => {
      unsubscribe();
      mobileMenu.dispatchEvent(new Event('menu-dispose'));
    },
    { once: true },
  );

  return header;
}

import './mobile-menu.scss';

import logoUrl from '../../assets/images/logo.svg';
import closeUrl from '../../assets/icons/close.svg';
import type { OpenAuth } from '../dialogs/auth-dialog';
import { getPageUrl } from '../../app/navigation';
import { appSessionStore } from '../../state/store';
import type { AppSessionStore } from '../../state/store';
import type { AppSession } from '../../state/app-session';
import { createUserProfile } from './user-profile';
import { showSnackbar } from '../snackbar/snackbar';

export function createMobileMenu(
  trigger: HTMLButtonElement,
  onAuth: OpenAuth,
  onLogout: () => Promise<void>,
  store: AppSessionStore = appSessionStore,
): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.id = 'mobile-menu';
  dialog.className = 'mobile-menu';
  dialog.setAttribute('aria-label', 'Main menu');

  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-haspopup', 'dialog');

  const top = document.createElement('div');
  top.className = 'mobile-menu__top';

  const logo = document.createElement('a');
  logo.className = 'mobile-menu__logo';
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

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'mobile-menu__close';
  closeButton.autofocus = true;
  closeButton.setAttribute('aria-label', 'Close navigation menu');

  const closeImage = document.createElement('img');
  closeImage.src = closeUrl;
  closeImage.alt = '';
  closeImage.width = 32;
  closeImage.height = 32;

  closeButton.append(closeImage);
  top.append(logo, closeButton);

  const navigation = document.createElement('nav');
  navigation.className = 'mobile-menu__nav';
  navigation.setAttribute('aria-label', 'Mobile navigation');

  const list = document.createElement('ul');
  list.className = 'mobile-menu__list';

  const navigationLabels = ['Home', 'Library', 'Tournaments', 'Community'];

  for (const label of navigationLabels) {
    const item = document.createElement('li');
    const link = document.createElement('a');

    link.className = 'mobile-menu__link';
    link.href = getPageUrl(label === 'Library' ? '/library' : '/');
    link.textContent = label;

    if (label === 'Home' || label === 'Library') {
      link.dataset.navPage = label.toLowerCase();
    }

    link.addEventListener('click', (): void => {
      dialog.close();
    });

    item.append(link);
    list.append(item);
  }

  navigation.append(list);

  const actions = document.createElement('div');
  actions.className = 'mobile-menu__actions';

  const profileContainer = document.createElement('div');
  profileContainer.className = 'mobile-menu__profile';

  const loginButton = document.createElement('button');
  loginButton.type = 'button';
  loginButton.className = 'mobile-menu__button mobile-menu__button--login';
  loginButton.textContent = 'Log In';

  const signupButton = document.createElement('button');
  signupButton.type = 'button';
  signupButton.className = 'mobile-menu__button mobile-menu__button--signup';
  signupButton.textContent = 'Sign Up';

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className = 'mobile-menu__button mobile-menu__button--logout';
  logoutButton.textContent = 'Log Out';

  actions.append(profileContainer, loginButton, signupButton, logoutButton);
  dialog.append(top, navigation, actions);

  trigger.addEventListener('click', (): void => {
    if (dialog.open) {
      return;
    }

    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('has-open-menu');
  });

  closeButton.addEventListener('click', (): void => {
    dialog.close();
  });

  logo.addEventListener('click', (): void => {
    dialog.close();
  });

  dialog.addEventListener('close', (): void => {
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('has-open-menu');
  });

  loginButton.addEventListener('click', (): void => {
    dialog.close();
    onAuth('login', trigger);
  });

  signupButton.addEventListener('click', (): void => {
    dialog.close();
    onAuth('register', trigger);
  });

  let isLoggingOut = false;

  async function requestLogout(): Promise<void> {
    if (isLoggingOut || !store.getSession()) {
      return;
    }

    isLoggingOut = true;
    logoutButton.disabled = true;

    try {
      dialog.close();
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

  function renderSession(session: AppSession | undefined): void {
    const isAuthenticated = !!session;

    loginButton.hidden = isAuthenticated;
    signupButton.hidden = isAuthenticated;
    logoutButton.hidden = !isAuthenticated;
    profileContainer.hidden = !isAuthenticated;

    profileContainer.replaceChildren();

    if (session) {
      profileContainer.append(createUserProfile(session));
    }
  }

  const unsubscribe = store.subscribe(renderSession);

  dialog.addEventListener(
    'menu-dispose',
    (): void => {
      unsubscribe();

      if (dialog.open) {
        dialog.close();
      }
    },
    { once: true },
  );

  return dialog;
}

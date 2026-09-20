import './mobile-menu.scss';
import logoUrl from '../../assets/images/logo.svg';
import closeUrl from '../../assets/icons/close.svg';

export function createMobileMenu(trigger: HTMLButtonElement): HTMLDialogElement {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  dialog.id = 'mobile-menu';
  dialog.className = 'mobile-menu';
  dialog.setAttribute('aria-label', 'Main menu');

  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-haspopup', 'dialog');

  const top: HTMLDivElement = document.createElement('div');
  top.className = 'mobile-menu__top';

  const logo: HTMLAnchorElement = document.createElement('a');
  logo.className = 'mobile-menu__logo';
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

  const closeButton: HTMLButtonElement = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'mobile-menu__close';
  closeButton.autofocus = true;
  closeButton.setAttribute('aria-label', 'Close navigation menu');

  const closeImage: HTMLImageElement = document.createElement('img');
  closeImage.src = closeUrl;
  closeImage.alt = '';
  closeImage.width = 32;
  closeImage.height = 32;

  closeButton.append(closeImage);
  top.append(logo, closeButton);
  const navigation: HTMLElement = document.createElement('nav');
  navigation.className = 'mobile-menu__nav';
  navigation.setAttribute('aria-label', 'Mobile navigation');

  const list: HTMLUListElement = document.createElement('ul');
  list.className = 'mobile-menu__list';

  const navigationLabels: string[] = ['Home', 'Library', 'Tournaments', 'Community'];

  for (const label of navigationLabels) {
    const item: HTMLLIElement = document.createElement('li');
    const link: HTMLAnchorElement = document.createElement('a');

    link.className = 'mobile-menu__link';
    link.href = '#/';
    link.textContent = label;

    if (label === 'Home') {
      link.setAttribute('aria-current', 'page');
    }

    link.addEventListener('click', (): void => {
      dialog.close();
    });

    item.append(link);
    list.append(item);
  }

  navigation.append(list);

  const actions: HTMLDivElement = document.createElement('div');
  actions.className = 'mobile-menu__actions';

  const loginButton: HTMLButtonElement = document.createElement('button');
  loginButton.type = 'button';
  loginButton.className = 'mobile-menu__button mobile-menu__button--login';
  loginButton.textContent = 'Log In';

  const signupButton: HTMLButtonElement = document.createElement('button');
  signupButton.type = 'button';
  signupButton.className = 'mobile-menu__button mobile-menu__button--signup';
  signupButton.textContent = 'Sign Up';

  actions.append(loginButton, signupButton);
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

  return dialog;
}

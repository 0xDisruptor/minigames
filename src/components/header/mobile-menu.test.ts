// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSession } from '../../state/app-session';
import { createAppSessionStore } from '../../state/store';
import { createMobileMenu } from './mobile-menu';

const menuMocks = vi.hoisted(() => ({
  showSnackbar: vi.fn(),
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: menuMocks.showSnackbar,
}));

const session: AppSession = {
  displayName: 'Alex Morgan',
  email: 'alex@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const menus: HTMLDialogElement[] = [];

function createFixture(initialSession?: AppSession) {
  const store = createAppSessionStore();

  if (initialSession) {
    store.setSession(initialSession);
  }

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');

  const onAuth = vi.fn();
  const onLogout = vi.fn(() => {
    store.setSession(undefined);
    return Promise.resolve();
  });

  const dialog = createMobileMenu(trigger, onAuth, onLogout, store);

  dialog.showModal = vi.fn((): void => {
    dialog.open = true;
  });

  dialog.close = vi.fn((): void => {
    if (!dialog.open) {
      return;
    }

    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  });

  menus.push(dialog);
  document.body.append(trigger, dialog);

  const loginButton = dialog.querySelector<HTMLButtonElement>('.mobile-menu__button--login');
  const signupButton = dialog.querySelector<HTMLButtonElement>('.mobile-menu__button--signup');
  const logoutButton = dialog.querySelector<HTMLButtonElement>('.mobile-menu__button--logout');
  const profile = dialog.querySelector<HTMLDivElement>('.mobile-menu__profile');

  if (!loginButton || !signupButton || !logoutButton || !profile) {
    throw new Error('Mobile menu elements are missing.');
  }

  return {
    trigger,
    dialog,
    store,
    onAuth,
    onLogout,
    loginButton,
    signupButton,
    logoutButton,
    profile,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BASE_URL', '/minigames/');
});

afterEach(() => {
  for (const menu of menus) {
    menu.dispatchEvent(new Event('menu-dispose'));
  }

  menus.length = 0;
  vi.unstubAllEnvs();
  document.body.replaceChildren();
  document.documentElement.classList.remove('has-open-menu');
});

describe('createMobileMenu', () => {
  it('shows guest controls and opens the menu only once', () => {
    const fixture = createFixture();

    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.signupButton.hidden).toBe(false);
    expect(fixture.logoutButton.hidden).toBe(true);
    expect(fixture.profile.hidden).toBe(true);
    expect(fixture.trigger.getAttribute('aria-controls')).toBe('mobile-menu');
    expect(fixture.trigger.getAttribute('aria-haspopup')).toBe('dialog');

    fixture.trigger.click();
    fixture.trigger.click();

    expect(fixture.dialog.showModal).toHaveBeenCalledTimes(1);
    expect(fixture.dialog.open).toBe(true);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.classList.contains('has-open-menu')).toBe(true);
  });

  it('uses the application base URL for navigation', () => {
    const { dialog } = createFixture();
    const logo = dialog.querySelector<HTMLAnchorElement>('.mobile-menu__logo');
    const links = dialog.querySelectorAll<HTMLAnchorElement>('.mobile-menu__link');

    expect(logo?.getAttribute('href')).toBe('/minigames/');
    expect(links).toHaveLength(4);
    expect(links[0]?.getAttribute('href')).toBe('/minigames/');
    expect(links[1]?.getAttribute('href')).toBe('/minigames/library');
    expect(links[0]?.dataset.navPage).toBe('home');
    expect(links[1]?.dataset.navPage).toBe('library');
  });

  it.each(['.mobile-menu__close', '.mobile-menu__logo', '.mobile-menu__link'])(
    'closes when %s is clicked',
    (selector) => {
      const fixture = createFixture();
      fixture.trigger.click();

      const control = fixture.dialog.querySelector<HTMLElement>(selector);

      if (!control) {
        throw new Error('Menu control is missing.');
      }

      control.addEventListener(
        'click',
        (event): void => {
          event.preventDefault();
        },
        { once: true },
      );

      control.click();

      expect(fixture.dialog.open).toBe(false);
      expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.documentElement.classList.contains('has-open-menu')).toBe(false);
    },
  );

  it.each([
    { mode: 'login', selector: '.mobile-menu__button--login' },
    { mode: 'register', selector: '.mobile-menu__button--signup' },
  ])('closes before requesting $mode', ({ mode, selector }) => {
    const fixture = createFixture();
    fixture.trigger.click();

    const button = fixture.dialog.querySelector<HTMLButtonElement>(selector);

    if (!button) {
      throw new Error('Auth button is missing.');
    }

    fixture.onAuth.mockImplementation(() => {
      expect(fixture.dialog.open).toBe(false);
    });

    button.click();

    expect(fixture.onAuth).toHaveBeenCalledExactlyOnceWith(mode, fixture.trigger);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('immediately renders an existing session', () => {
    const fixture = createFixture(session);

    expect(fixture.loginButton.hidden).toBe(true);
    expect(fixture.signupButton.hidden).toBe(true);
    expect(fixture.logoutButton.hidden).toBe(false);
    expect(fixture.profile.hidden).toBe(false);
    expect(fixture.profile.querySelector('.user-profile__name')?.textContent).toBe('Alex Morgan');
    expect(fixture.profile.querySelector('.user-profile__initials')?.textContent).toBe('AM');
  });

  it('updates the profile and returns to Guest when the session is cleared', () => {
    const fixture = createFixture();
    fixture.trigger.click();

    fixture.store.setSession({
      ...session,
      displayName: 'Sam Rivera',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(fixture.profile.hidden).toBe(false);
    expect(fixture.loginButton.hidden).toBe(true);
    expect(fixture.profile.querySelector('.user-profile__name')?.textContent).toBe('Sam Rivera');
    expect(fixture.profile.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/avatar.png',
    );

    fixture.store.setSession(undefined);

    expect(fixture.profile.hidden).toBe(true);
    expect(fixture.profile.childElementCount).toBe(0);
    expect(fixture.logoutButton.hidden).toBe(true);
    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.signupButton.hidden).toBe(false);
    expect(fixture.dialog.open).toBe(true);
  });

  it('ignores a programmatic logout attempt while Guest', () => {
    const fixture = createFixture();

    fixture.logoutButton.dispatchEvent(new MouseEvent('click'));

    expect(fixture.onLogout).not.toHaveBeenCalled();
    expect(fixture.logoutButton.disabled).toBe(false);
  });

  it('closes the menu and switches to Guest on logout', async () => {
    const fixture = createFixture(session);
    fixture.trigger.click();

    fixture.onLogout.mockImplementationOnce(() => {
      expect(fixture.dialog.open).toBe(false);
      fixture.store.setSession(undefined);
      return Promise.resolve();
    });

    fixture.logoutButton.click();

    expect(fixture.store.getSession()).toBeUndefined();
    expect(fixture.dialog.open).toBe(false);
    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.profile.hidden).toBe(true);

    await vi.waitFor(() => {
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(fixture.onLogout).toHaveBeenCalledTimes(1);
    expect(menuMocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('blocks duplicate logout requests while pending', async () => {
    const fixture = createFixture(session);
    const completion: { resolve?: () => void } = {};

    fixture.onLogout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completion.resolve = resolve;
        }),
    );

    fixture.trigger.click();
    fixture.logoutButton.click();

    expect(fixture.dialog.open).toBe(false);
    expect(fixture.logoutButton.disabled).toBe(true);

    fixture.logoutButton.dispatchEvent(new MouseEvent('click'));

    expect(fixture.onLogout).toHaveBeenCalledTimes(1);

    completion.resolve?.();

    await vi.waitFor(() => {
      expect(fixture.logoutButton.disabled).toBe(false);
    });
  });

  it('reports a callback error and allows retry after reopening', async () => {
    const fixture = createFixture(session);
    fixture.onLogout.mockRejectedValueOnce(new Error('Logout failed'));

    fixture.trigger.click();
    fixture.logoutButton.click();

    await vi.waitFor(() => {
      expect(menuMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Unable to sign out. Please try again.',
        'error',
      );
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    fixture.trigger.click();
    fixture.logoutButton.click();

    await vi.waitFor(() => {
      expect(fixture.onLogout).toHaveBeenCalledTimes(2);
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(fixture.store.getSession()).toBeUndefined();
    expect(fixture.dialog.open).toBe(false);
  });

  it('closes and unsubscribes on disposal', () => {
    const fixture = createFixture(session);
    fixture.trigger.click();

    fixture.dialog.dispatchEvent(new Event('menu-dispose'));

    expect(fixture.dialog.open).toBe(false);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');

    fixture.dialog.remove();
    fixture.store.setSession(undefined);

    expect(fixture.profile.hidden).toBe(false);
    expect(fixture.profile.querySelector('.user-profile__name')?.textContent).toBe('Alex Morgan');
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSession } from '../../state/app-session';
import { createAppSessionStore } from '../../state/store';
import { createHeader } from './header';

const headerMocks = vi.hoisted(() => ({
  createMobileMenu: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('./mobile-menu', () => ({
  createMobileMenu: headerMocks.createMobileMenu,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: headerMocks.showSnackbar,
}));

const session: AppSession = {
  displayName: 'Alex Morgan',
  email: 'alex@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const headers: HTMLElement[] = [];

function createFixture(initialSession?: AppSession) {
  const store = createAppSessionStore();

  if (initialSession) {
    store.setSession(initialSession);
  }

  const onAuth = vi.fn();
  const onLogout = vi.fn(() => {
    store.setSession(undefined);
    return Promise.resolve();
  });

  const header = createHeader(onAuth, onLogout, store);
  headers.push(header);
  document.body.append(header);

  const loginButton = header.querySelector<HTMLButtonElement>('.header__button--login');
  const signupButton = header.querySelector<HTMLButtonElement>('.header__button--signup');
  const logoutButton = header.querySelector<HTMLButtonElement>('.header__button--logout');
  const profile = header.querySelector<HTMLDivElement>('.header__profile');
  const menuButton = header.querySelector<HTMLButtonElement>('.header__menu-button');

  if (!loginButton || !signupButton || !logoutButton || !profile || !menuButton) {
    throw new Error('Header elements are missing.');
  }

  return {
    header,
    store,
    onAuth,
    onLogout,
    loginButton,
    signupButton,
    logoutButton,
    profile,
    menuButton,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BASE_URL', '/minigames/');
  headerMocks.createMobileMenu.mockImplementation(() => document.createElement('dialog'));
});

afterEach(() => {
  for (const header of headers) {
    header.dispatchEvent(new Event('header-dispose'));
  }

  headers.length = 0;
  vi.unstubAllEnvs();
  document.body.replaceChildren();
});

describe('createHeader', () => {
  it('shows guest controls and hides the authenticated profile', () => {
    const fixture = createFixture();

    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.signupButton.hidden).toBe(false);
    expect(fixture.logoutButton.hidden).toBe(true);
    expect(fixture.profile.hidden).toBe(true);
    expect(fixture.profile.childElementCount).toBe(0);
    expect(fixture.menuButton.getAttribute('aria-expanded')).toBe('false');

    expect(headerMocks.createMobileMenu).toHaveBeenCalledExactlyOnceWith(
      fixture.menuButton,
      fixture.onAuth,
      fixture.onLogout,
      fixture.store,
    );
  });

  it('uses the application base URL for navigation', () => {
    const { header } = createFixture();
    const logo = header.querySelector<HTMLAnchorElement>('.header__logo');
    const links = header.querySelectorAll<HTMLAnchorElement>('.header__link');

    expect(logo?.getAttribute('href')).toBe('/minigames/');
    expect(links).toHaveLength(4);
    expect(links[0]?.getAttribute('href')).toBe('/minigames/');
    expect(links[1]?.getAttribute('href')).toBe('/minigames/library');
    expect(links[0]?.dataset.navPage).toBe('home');
    expect(links[1]?.dataset.navPage).toBe('library');
  });

  it('requests the selected auth mode with the triggering button', () => {
    const fixture = createFixture();

    fixture.loginButton.click();
    fixture.signupButton.click();

    expect(fixture.onAuth.mock.calls).toEqual([
      ['login', fixture.loginButton],
      ['register', fixture.signupButton],
    ]);
    expect(fixture.onLogout).not.toHaveBeenCalled();
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

  it('updates the profile after login and subsequent session changes', () => {
    const fixture = createFixture();

    fixture.store.setSession(session);

    expect(fixture.profile.hidden).toBe(false);
    expect(fixture.loginButton.hidden).toBe(true);

    fixture.store.setSession({
      ...session,
      displayName: 'Sam Rivera',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(fixture.profile.querySelector('.user-profile__name')?.textContent).toBe('Sam Rivera');
    expect(fixture.profile.querySelector('.user-profile__initials')?.textContent).toBe('SR');
    expect(fixture.profile.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/avatar.png',
    );
    expect(fixture.profile.textContent).not.toContain('Alex Morgan');
  });

  it('returns to guest controls when the session is cleared', () => {
    const fixture = createFixture(session);

    fixture.store.setSession(undefined);

    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.signupButton.hidden).toBe(false);
    expect(fixture.logoutButton.hidden).toBe(true);
    expect(fixture.profile.hidden).toBe(true);
    expect(fixture.profile.childElementCount).toBe(0);
  });

  it('ignores a programmatic logout attempt while Guest', () => {
    const fixture = createFixture();

    fixture.logoutButton.dispatchEvent(new MouseEvent('click'));

    expect(fixture.onLogout).not.toHaveBeenCalled();
    expect(fixture.logoutButton.disabled).toBe(false);
  });

  it('switches to Guest through the supplied logout callback', async () => {
    const fixture = createFixture(session);

    fixture.logoutButton.click();

    expect(fixture.onLogout).toHaveBeenCalledTimes(1);
    expect(fixture.store.getSession()).toBeUndefined();
    expect(fixture.loginButton.hidden).toBe(false);
    expect(fixture.profile.hidden).toBe(true);

    await vi.waitFor(() => {
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(headerMocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('blocks duplicate logout requests until completion', async () => {
    const fixture = createFixture(session);
    const completion: { resolve?: () => void } = {};

    fixture.onLogout.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completion.resolve = resolve;
        }),
    );

    fixture.logoutButton.click();

    expect(fixture.logoutButton.disabled).toBe(true);

    fixture.logoutButton.dispatchEvent(new MouseEvent('click'));

    expect(fixture.onLogout).toHaveBeenCalledTimes(1);

    completion.resolve?.();

    await vi.waitFor(() => {
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    fixture.logoutButton.click();

    await vi.waitFor(() => {
      expect(fixture.onLogout).toHaveBeenCalledTimes(2);
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(fixture.store.getSession()).toBeUndefined();
  });

  it('reports a callback error and allows another logout attempt', async () => {
    const fixture = createFixture(session);

    fixture.onLogout.mockRejectedValueOnce(new Error('Logout failed'));
    fixture.logoutButton.click();

    await vi.waitFor(() => {
      expect(headerMocks.showSnackbar).toHaveBeenCalledExactlyOnceWith(
        'Unable to sign out. Please try again.',
        'error',
      );
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(fixture.store.getSession()).toEqual(session);

    fixture.logoutButton.click();

    await vi.waitFor(() => {
      expect(fixture.onLogout).toHaveBeenCalledTimes(2);
      expect(fixture.logoutButton.disabled).toBe(false);
    });

    expect(fixture.store.getSession()).toBeUndefined();
  });

  it('unsubscribes from session updates on disposal', () => {
    const fixture = createFixture();

    fixture.header.dispatchEvent(new Event('header-dispose'));
    fixture.header.remove();
    fixture.store.setSession(session);

    expect(fixture.profile.hidden).toBe(true);
    expect(fixture.profile.childElementCount).toBe(0);
  });
});

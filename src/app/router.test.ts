// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_SESSION_LIFETIME_MS, APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { createAppSessionStore } from '../state/store';
import { createAppSessionController } from '../services/app-session-controller';
import { saveAppSession } from '../services/app-session-storage';
import { canOpenAuthDialog } from './auth-dialog-guard';
import { navigate } from './navigation';
import { initRouter } from './router';

const mocks = vi.hoisted(() => ({
  createHomePage: vi.fn(),
  createLibraryPage: vi.fn(),
  createNotFoundPage: vi.fn(),
  logoutFromFirebase: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../pages/home/home-page', () => ({
  createHomePage: mocks.createHomePage,
}));

vi.mock('../pages/library/library-page', () => ({
  createLibraryPage: mocks.createLibraryPage,
}));

vi.mock('../pages/not-found/not-found-page', () => ({
  createNotFoundPage: mocks.createNotFoundPage,
}));

vi.mock('../services/auth', () => ({
  logoutFromFirebase: mocks.logoutFromFirebase,
}));

vi.mock('../components/snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const disposers: Array<() => void> = [];

function createPageContent(name: string): HTMLElement {
  const element = document.createElement('section');
  element.dataset.page = name;
  return element;
}

function createSession(): AppSession {
  return {
    displayName: 'Alex Morgan',
    email: 'alex@example.com',
    authenticatedAt: Date.now(),
  };
}

async function createFixture(url = '/minigames/library?game=chess#details', session?: AppSession) {
  history.replaceState({}, '', url);

  const store = createAppSessionStore();
  const onExpired = vi.fn();

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
  });

  if (session) {
    saveAppSession(session);
  }

  await controller.initialize();

  const root = document.createElement('div');
  const outlet = document.createElement('div');

  const homeLink = document.createElement('a');
  homeLink.href = '/minigames/';
  homeLink.dataset.navPage = 'home';
  homeLink.textContent = 'Home';

  const libraryLink = document.createElement('a');
  libraryLink.href = '/minigames/library';
  libraryLink.dataset.navPage = 'library';
  libraryLink.textContent = 'Library';

  const auth = {
    element: document.createElement('dialog'),
    open: vi.fn(),
    close: vi.fn(),
  };

  const game = {
    element: document.createElement('dialog'),
    open: vi.fn(),
    openBySlug: vi.fn(),
    close: vi.fn(),
    suspend: vi.fn(),
  };

  const checkSession = vi.fn((): void => {
    controller.getActiveSession();
  });

  const canOpenAuth = vi.fn((): boolean => {
    return canOpenAuthDialog(controller);
  });

  root.append(homeLink, libraryLink, outlet, auth.element, game.element);
  document.body.append(root);

  const addListener = vi.spyOn(globalThis, 'addEventListener');

  try {
    initRouter(root, outlet, {
      auth,
      game,
      checkSession,
      canOpenAuth,
      takeTrigger: vi.fn<() => HTMLElement | undefined>(),
    });
  } finally {
    for (const [type, listener, options] of addListener.mock.calls) {
      disposers.push((): void => {
        removeEventListener(type, listener, options);
      });
    }

    addListener.mockRestore();
  }

  return {
    controller,
    store,
    onExpired,
    outlet,
    libraryLink,
    auth,
    game,
    checkSession,
  };
}

describe('router auth guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BASE_URL', '/minigames/');
    vi.stubGlobal('scrollTo', vi.fn());
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);

    mocks.logoutFromFirebase.mockResolvedValue(undefined);
    mocks.createHomePage.mockImplementation(() => createPageContent('home'));
    mocks.createLibraryPage.mockImplementation(() => createPageContent('library'));
    mocks.createNotFoundPage.mockImplementation(() => createPageContent('not-found'));

    localStorage.clear();
    document.body.replaceChildren();
  });

  afterEach(() => {
    for (const dispose of disposers) {
      dispose();
    }

    disposers.length = 0;

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    localStorage.clear();
    document.body.replaceChildren();
  });

  it.each(['login', 'register'])('opens %s from a direct URL for a guest', async (mode) => {
    const fixture = await createFixture(`/minigames/library?game=chess&auth=${mode}#details`);

    expect(fixture.auth.open).toHaveBeenCalledWith(mode, undefined);
    expect(fixture.game.openBySlug).not.toHaveBeenCalled();
    expect(new URL(location.href).searchParams.get('game')).toBe('chess');
    expect(location.hash).toBe('#details');
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it.each(['login', 'register'])(
    'blocks a direct %s URL for an authenticated user',
    async (mode) => {
      const fixture = await createFixture(
        `/minigames/library?game=chess&category=puzzle&auth=${mode}#details`,
        createSession(),
      );

      const url = new URL(location.href);

      expect(fixture.auth.open).not.toHaveBeenCalled();
      expect(fixture.game.openBySlug).toHaveBeenCalledWith('chess', undefined);
      expect(url.pathname).toBe('/minigames/library');
      expect(url.searchParams.has('auth')).toBe(false);
      expect(url.searchParams.get('game')).toBe('chess');
      expect(url.searchParams.get('category')).toBe('puzzle');
      expect(url.hash).toBe('#details');

      expect(mocks.createLibraryPage).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith('You are already signed in.', 'info');
    },
  );

  it('restores the game route after auth closes without recreating the page', async () => {
    const fixture = await createFixture();
    const page = fixture.outlet.firstElementChild;

    navigate('/minigames/library?game=chess&auth=login#details');

    expect(fixture.auth.open).toHaveBeenCalledWith('login', undefined);
    expect(fixture.outlet.firstElementChild).toBe(page);

    fixture.game.openBySlug.mockClear();

    navigate('/minigames/library?game=chess#details');

    expect(fixture.game.openBySlug).toHaveBeenCalledWith('chess', undefined);
    expect(fixture.outlet.firstElementChild).toBe(page);
    expect(mocks.createLibraryPage).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe('#details');
  });

  it('restores game and auth routes with Back and Forward for a guest', async () => {
    const fixture = await createFixture();

    navigate('/minigames/library?game=chess&auth=login#details');

    expect(fixture.auth.open).toHaveBeenCalledWith('login', undefined);

    fixture.auth.open.mockClear();
    fixture.game.openBySlug.mockClear();

    history.back();

    await vi.waitFor(() => {
      expect(new URL(location.href).searchParams.has('auth')).toBe(false);
      expect(fixture.game.openBySlug).toHaveBeenCalledWith('chess', undefined);
    });

    expect(fixture.auth.open).not.toHaveBeenCalled();

    history.forward();

    await vi.waitFor(() => {
      expect(new URL(location.href).searchParams.get('auth')).toBe('login');
      expect(fixture.auth.open).toHaveBeenCalledWith('login', undefined);
    });

    expect(mocks.createLibraryPage).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('cleans a historical auth entry after login and preserves Forward navigation', async () => {
    const fixture = await createFixture();

    navigate('/minigames/library?game=chess&auth=login#details');
    navigate('/minigames/library?game=chess#details');

    await fixture.controller.activate(createSession());

    fixture.auth.open.mockClear();
    fixture.game.openBySlug.mockClear();

    const historyLength = history.length;

    history.back();

    await vi.waitFor(() => {
      expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
      expect(new URL(location.href).searchParams.has('auth')).toBe(false);
    });

    expect(fixture.auth.open).not.toHaveBeenCalled();
    expect(fixture.game.openBySlug).toHaveBeenCalledWith('chess', undefined);
    expect(location.hash).toBe('#details');
    expect(history.length).toBe(historyLength);

    const checkCount = fixture.checkSession.mock.calls.length;

    history.forward();

    await vi.waitFor(() => {
      expect(fixture.checkSession.mock.calls.length).toBeGreaterThan(checkCount);
    });

    expect(fixture.auth.open).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(new URL(location.href).searchParams.get('game')).toBe('chess');
  });

  it('recovers an expired session before creating the next page', async () => {
    const session = createSession();

    const fixture = await createFixture('/minigames/', session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    mocks.createLibraryPage.mockImplementation(() => {
      expect(fixture.store.getSession()).toBeUndefined();
      return createPageContent('library');
    });

    fixture.libraryLink.click();

    expect(location.pathname).toBe('/minigames/library');
    expect(mocks.createLibraryPage).toHaveBeenCalledTimes(1);
    expect(fixture.store.getSession()).toBeUndefined();
    expect(fixture.onExpired).toHaveBeenCalledTimes(1);

    await fixture.controller.whenReady();
  });

  it('allows an auth history entry after the session expires', async () => {
    const session = createSession();
    const fixture = await createFixture();

    navigate('/minigames/library?game=chess&auth=register#details');
    navigate('/minigames/library?game=chess#details');

    await fixture.controller.activate(session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    fixture.auth.open.mockClear();

    history.back();

    await vi.waitFor(() => {
      expect(fixture.auth.open).toHaveBeenCalledWith('register', undefined);
    });

    expect(fixture.store.getSession()).toBeUndefined();
    expect(fixture.onExpired).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(new URL(location.href).searchParams.get('game')).toBe('chess');

    await fixture.controller.whenReady();
  });

  it('opens auth after recovering a malformed stored session', async () => {
    localStorage.setItem(APP_SESSION_STORAGE_KEY, '{invalid');

    const fixture = await createFixture('/minigames/library?auth=login');

    expect(fixture.store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(fixture.auth.open).toHaveBeenCalledWith('login', undefined);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_SESSION_LIFETIME_MS, APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { createAppSessionStore } from '../state/store';
import { createAppSessionController } from '../services/app-session-controller';
import { saveAppSession } from '../services/app-session-storage';
import { canOpenAuthDialog } from './auth-dialog-guard';
import { NAVIGATION_EVENT } from './navigation';

const mocks = vi.hoisted(() => ({
  logoutFromFirebase: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../services/auth', () => ({
  logoutFromFirebase: mocks.logoutFromFirebase,
}));

vi.mock('../components/snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

function createFixture(session?: AppSession) {
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

  return { controller, store, onExpired };
}

function createSession(): AppSession {
  return {
    displayName: 'Alex Morgan',
    email: 'alex@example.com',
    authenticatedAt: Date.now(),
  };
}

describe('auth dialog guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));

    mocks.logoutFromFirebase.mockResolvedValue(undefined);

    localStorage.clear();

    history.replaceState(
      {},
      '',
      '/minigames/library?auth=login&game=chess&category=puzzle&page=2#details',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('allows a guest to open auth without changing the URL', async () => {
    const { controller } = createFixture();

    await controller.initialize();

    const originalUrl = location.href;
    const replaceState = vi.spyOn(history, 'replaceState');
    const pushState = vi.spyOn(history, 'pushState');

    expect(canOpenAuthDialog(controller)).toBe(true);
    expect(location.href).toBe(originalUrl);
    expect(replaceState).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it.each(['login', 'register'])(
    'blocks %s and removes only auth from the current history entry',
    async (mode) => {
      history.replaceState(
        {},
        '',
        `/minigames/library?auth=${mode}&game=chess&category=puzzle&page=2#details`,
      );

      const session = createSession();
      const { controller, store } = createFixture(session);

      await controller.initialize();

      const storedSession = localStorage.getItem(APP_SESSION_STORAGE_KEY);
      const historyLength = history.length;
      const replaceState = vi.spyOn(history, 'replaceState');
      const pushState = vi.spyOn(history, 'pushState');
      const onNavigate = vi.fn();

      addEventListener(NAVIGATION_EVENT, onNavigate);

      try {
        expect(canOpenAuthDialog(controller)).toBe(false);

        const url = new URL(location.href);

        expect(url.pathname).toBe('/minigames/library');
        expect(url.searchParams.has('auth')).toBe(false);
        expect(url.searchParams.get('game')).toBe('chess');
        expect(url.searchParams.get('category')).toBe('puzzle');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.hash).toBe('#details');

        expect(replaceState).toHaveBeenCalledTimes(1);
        expect(pushState).not.toHaveBeenCalled();
        expect(history.length).toBe(historyLength);
        expect(onNavigate).toHaveBeenCalledTimes(1);

        expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
        expect(mocks.showSnackbar).toHaveBeenCalledWith('You are already signed in.', 'info');

        expect(store.getSession()).toEqual(session);
        expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(storedSession);
        expect(mocks.logoutFromFirebase).not.toHaveBeenCalled();
      } finally {
        removeEventListener(NAVIGATION_EVENT, onNavigate);
      }
    },
  );

  it('blocks a UI request without creating a history entry', async () => {
    history.replaceState({}, '', '/minigames/library?game=chess#details');

    const { controller } = createFixture(createSession());

    await controller.initialize();

    const originalUrl = location.href;
    const replaceState = vi.spyOn(history, 'replaceState');
    const pushState = vi.spyOn(history, 'pushState');

    expect(canOpenAuthDialog(controller)).toBe(false);
    expect(location.href).toBe(originalUrl);
    expect(replaceState).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('You are already signed in.', 'info');
  });

  it('recovers an expired active session and allows auth', async () => {
    const session = createSession();
    const { controller, store, onExpired } = createFixture(session);

    await controller.initialize();

    vi.setSystemTime(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    const originalUrl = location.href;

    expect(canOpenAuthDialog(controller)).toBe(true);
    expect(location.href).toBe(originalUrl);
    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();

    await controller.whenReady();

    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('allows auth after recovering an expired stored session', async () => {
    const session = {
      ...createSession(),
      authenticatedAt: Date.now() - APP_SESSION_LIFETIME_MS,
    };

    const { controller, store, onExpired } = createFixture(session);

    await controller.initialize();

    const originalUrl = location.href;

    expect(canOpenAuthDialog(controller)).toBe(true);
    expect(location.href).toBe(originalUrl);
    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it.each(['{invalid', 'null', '[]', '{}'])(
    'allows auth after recovering an invalid stored session: %s',
    async (storedValue) => {
      localStorage.setItem(APP_SESSION_STORAGE_KEY, storedValue);
      localStorage.setItem('unrelated-setting', 'keep');

      const { controller, store } = createFixture();

      await controller.initialize();

      const originalUrl = location.href;

      expect(canOpenAuthDialog(controller)).toBe(true);
      expect(location.href).toBe(originalUrl);
      expect(store.getSession()).toBeUndefined();
      expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('unrelated-setting')).toBe('keep');
      expect(mocks.showSnackbar).not.toHaveBeenCalled();
      expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
    },
  );
});

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { createAppSessionStore } from '../state/store';
import { createAppSessionController } from './app-session-controller';
import { saveAppSession } from './app-session-storage';
import { logoutFromFirebase } from './auth';

vi.mock('./auth', () => ({
  logoutFromFirebase: vi.fn(),
}));

const now = 1_700_000_000_000;

const session: AppSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: now - 60_000,
};

const unrelatedKey = 'another-app:settings';

function createFixture() {
  const store = createAppSessionStore();
  const onExpired = vi.fn();
  const onError = vi.fn();

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
    onError,
  });

  return { store, controller, onExpired, onError };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(logoutFromFirebase).mockReset();
  vi.mocked(logoutFromFirebase).mockResolvedValue(undefined);
  vi.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('initialize', () => {
  it('restores a valid session without renewing its timestamp', async () => {
    saveAppSession(session);
    const rawSession = localStorage.getItem(APP_SESSION_STORAGE_KEY);
    const { controller, store, onExpired } = createFixture();

    await controller.initialize();

    expect(store.getSession()).toEqual(session);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(rawSession);
    expect(logoutFromFirebase).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('switches to Guest and signs out when no session is stored', async () => {
    const { controller, store, onExpired } = createFixture();
    store.setSession(session);

    const initialization = controller.initialize();

    expect(store.getSession()).toBeUndefined();

    await initialization;

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('removes corrupted data without touching unrelated keys', async () => {
    localStorage.setItem(APP_SESSION_STORAGE_KEY, 'broken JSON');
    localStorage.setItem(unrelatedKey, 'keep');
    const { controller, store, onExpired } = createFixture();

    await controller.initialize();

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('removes an expired session and reports expiration once', async () => {
    saveAppSession({
      ...session,
      authenticatedAt: now - 300_000,
    });
    const { controller, store, onExpired } = createFixture();

    await controller.initialize();
    await controller.initialize();
    controller.getActiveSession();

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('initializes only once', async () => {
    saveAppSession(session);
    const { controller } = createFixture();
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');

    const firstInitialization = controller.initialize();
    const secondInitialization = controller.initialize();

    expect(secondInitialization).toBe(firstInitialization);

    await firstInitialization;

    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('stays Guest and signs out after a storage read error', async () => {
    const error = new Error('Storage is unavailable');
    const { controller, store, onError } = createFixture();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw error;
    });

    await controller.initialize();

    expect(store.getSession()).toBeUndefined();
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  });
});

describe('activate', () => {
  it('saves and activates the supplied session', async () => {
    const { controller, store, onExpired } = createFixture();

    await controller.activate(session);

    expect(store.getSession()).toEqual(session);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(JSON.stringify(session));
    expect(logoutFromFirebase).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'invalid',
      value: { ...session, email: '' },
    },
    {
      name: 'expired',
      value: { ...session, authenticatedAt: now - 300_000 },
    },
  ])('rejects an $name session and switches to Guest', async ({ value }) => {
    saveAppSession(session);
    const { controller, store } = createFixture();
    store.setSession(session);

    await expect(controller.activate(value)).rejects.toThrow(
      'Cannot activate an invalid or expired app session.',
    );

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('clears state and signs out when saving fails', async () => {
    saveAppSession(session);
    const { controller, store } = createFixture();
    store.setSession(session);
    const error = new Error('Storage quota exceeded');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw error;
    });

    await expect(controller.activate(session)).rejects.toThrow(error);

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('waits for pending Firebase logout before activating a session', async () => {
    const completion: { resolve?: () => void } = {};

    vi.mocked(logoutFromFirebase).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completion.resolve = resolve;
        }),
    );

    const { controller, store } = createFixture();
    const logout = controller.logout();
    const readiness = controller.whenReady();
    const activation = controller.activate(session);

    expect(readiness).toBe(logout);

    await vi.waitFor(() => {
      expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    });

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();

    completion.resolve?.();

    await readiness;
    await activation;

    expect(store.getSession()).toEqual(session);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(JSON.stringify(session));
  });
});

describe('getActiveSession', () => {
  it('returns Guest without starting another logout', () => {
    const { controller, onExpired } = createFixture();

    expect(controller.getActiveSession()).toBeUndefined();
    expect(logoutFromFirebase).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('returns an active session without renewing it', async () => {
    const { controller } = createFixture();
    await controller.activate(session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + 299_999);

    expect(controller.getActiveSession()).toEqual(session);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(JSON.stringify(session));
    expect(logoutFromFirebase).not.toHaveBeenCalled();
  });

  it('expires immediately at five minutes and reports it only once', async () => {
    const { controller, store, onExpired } = createFixture();
    await controller.activate(session);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + 300_000);

    expect(controller.getActiveSession()).toBeUndefined();
    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();

    expect(controller.getActiveSession()).toBeUndefined();

    await controller.whenReady();

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});

describe('logout', () => {
  it('clears state and storage immediately while preserving unrelated keys', async () => {
    const { controller, store, onExpired } = createFixture();
    await controller.activate(session);
    localStorage.setItem(unrelatedKey, 'keep');

    const logout = controller.logout();

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');

    await logout;

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('stays Guest even when Firebase logout fails', async () => {
    const { controller, store, onError } = createFixture();
    await controller.activate(session);
    const error = new Error('Firebase logout failed');
    vi.mocked(logoutFromFirebase).mockRejectedValueOnce(error);

    await controller.logout();

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('continues Firebase logout when removing storage fails', async () => {
    const { controller, store, onError } = createFixture();
    await controller.activate(session);
    const error = new Error('Storage is unavailable');

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw error;
    });

    await controller.logout();

    expect(store.getSession()).toBeUndefined();
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
  });
});

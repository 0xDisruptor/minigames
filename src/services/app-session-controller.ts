import { isAppSession, isAppSessionExpired } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { appSessionStore } from '../state/store';
import type { AppSessionStore } from '../state/store';
import { readAppSession, removeAppSession, saveAppSession } from './app-session-storage';
import { logoutFromFirebase } from './auth';

interface AppSessionControllerOptions {
  readonly store?: AppSessionStore;
  readonly storage?: Storage;
  readonly onExpired?: () => void;
  readonly onError?: (error: unknown) => void;
}

export interface AppSessionController {
  readonly initialize: () => Promise<void>;
  readonly activate: (session: AppSession) => Promise<void>;
  readonly getActiveSession: () => AppSession | undefined;
  readonly logout: () => Promise<void>;
  readonly whenReady: () => Promise<void>;
}

export function createAppSessionController(
  options: AppSessionControllerOptions = {},
): AppSessionController {
  const store = options.store ?? appSessionStore;
  const storage = options.storage ?? localStorage;

  let pendingLogout: Promise<void> = Promise.resolve();
  let initialization: Promise<void> | undefined;

  async function finishFirebaseLogout(previousLogout: Promise<void>): Promise<void> {
    await previousLogout;

    try {
      await logoutFromFirebase();
    } catch (error: unknown) {
      options.onError?.(error);
    }
  }

  function clearSession(): Promise<void> {
    store.setSession(undefined);

    try {
      removeAppSession(storage);
    } catch (error: unknown) {
      options.onError?.(error);
    }

    pendingLogout = finishFirebaseLogout(pendingLogout);

    return pendingLogout;
  }

  async function restoreSession(): Promise<void> {
    let storedSession: AppSession | undefined;

    try {
      storedSession = readAppSession(storage);
    } catch (error: unknown) {
      options.onError?.(error);
      await clearSession();
      return;
    }

    if (!storedSession) {
      await clearSession();
      return;
    }

    if (isAppSessionExpired(storedSession)) {
      const cleanup = clearSession();
      options.onExpired?.();
      await cleanup;
      return;
    }

    store.setSession(storedSession);
  }

  function initialize(): Promise<void> {
    initialization ??= restoreSession();
    return initialization;
  }

  async function activate(session: AppSession): Promise<void> {
    await pendingLogout;

    if (!isAppSession(session) || isAppSessionExpired(session)) {
      await clearSession();
      throw new Error('Cannot activate an invalid or expired app session.');
    }

    try {
      saveAppSession(session, storage);
      store.setSession(session);
    } catch (error: unknown) {
      await clearSession();
      throw error;
    }
  }

  function getActiveSession(): AppSession | undefined {
    const session = store.getSession();

    if (!session) {
      return undefined;
    }

    if (isAppSessionExpired(session)) {
      void clearSession();
      options.onExpired?.();
      return undefined;
    }

    return session;
  }

  function logout(): Promise<void> {
    return clearSession();
  }

  function whenReady(): Promise<void> {
    return pendingLogout;
  }

  return {
    initialize,
    activate,
    getActiveSession,
    logout,
    whenReady,
  };
}

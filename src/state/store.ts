import { isAppSession } from './app-session';
import type { AppSession } from './app-session';

export type AppSessionListener = (
  session: AppSession | undefined,
) => void;

export interface AppSessionStore {
  readonly getSession: () => AppSession | undefined;
  readonly setSession: (session: AppSession | undefined) => void;
  readonly subscribe: (listener: AppSessionListener) => () => void;
}

export function createAppSessionStore(): AppSessionStore {
  let currentSession: AppSession | undefined;
  const listeners = new Set<AppSessionListener>();

  function getSession(): AppSession | undefined {
    return currentSession;
  }

  function setSession(session: AppSession | undefined): void {
    if (session && !isAppSession(session)) {
      throw new Error('Cannot activate an invalid app session.');
    }

    if (!currentSession && !session) {
      return;
    }

    currentSession =
      session &&
      Object.freeze({
        displayName: session.displayName,
        email: session.email,
        authenticatedAt: session.authenticatedAt,
        ...(session.avatarUrl && { avatarUrl: session.avatarUrl }),
      });

    for (const listener of listeners) {
  listener(currentSession);
}
  }

  function subscribe(listener: AppSessionListener): () => void {
    listeners.add(listener);
    listener(currentSession);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    getSession,
    setSession,
    subscribe,
  };
}

export const appSessionStore = createAppSessionStore();
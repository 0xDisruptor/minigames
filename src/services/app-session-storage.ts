import { APP_SESSION_STORAGE_KEY, isAppSession } from '../state/app-session';
import type { AppSession } from '../state/app-session';

export function readAppSession(storage: Storage = localStorage): AppSession | undefined {
  const rawSession = storage.getItem(APP_SESSION_STORAGE_KEY);

  if (typeof rawSession !== 'string') {
    return undefined;
  }

  let parsedSession: unknown;

  try {
    parsedSession = JSON.parse(rawSession);
  } catch {
    storage.removeItem(APP_SESSION_STORAGE_KEY);
    return undefined;
  }

  if (!isAppSession(parsedSession)) {
    storage.removeItem(APP_SESSION_STORAGE_KEY);
    return undefined;
  }

  return parsedSession;
}

export function saveAppSession(session: AppSession, storage: Storage = localStorage): void {
  if (!isAppSession(session)) {
    throw new Error('Cannot store an invalid app session.');
  }

  const storedSession: AppSession = {
    displayName: session.displayName,
    email: session.email,
    authenticatedAt: session.authenticatedAt,
    ...(session.avatarUrl && { avatarUrl: session.avatarUrl }),
  };

  storage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
}

export function removeAppSession(storage: Storage = localStorage): void {
  storage.removeItem(APP_SESSION_STORAGE_KEY);
}

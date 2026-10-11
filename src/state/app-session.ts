export const APP_SESSION_STORAGE_KEY = 'minigames:0xdisruptor-minigames:app-session';

export const APP_SESSION_LIFETIME_MS = 5 * 60 * 1000;

export interface AppSession {
  readonly displayName: string;
  readonly email: string;
  readonly authenticatedAt: number;
  readonly avatarUrl?: string;
}

export function isAppSession(value: unknown): value is AppSession {
  return (
    typeof value === 'object' &&
    !!value &&
    !Array.isArray(value) &&
    'displayName' in value &&
    typeof value.displayName === 'string' &&
    'email' in value &&
    typeof value.email === 'string' &&
    value.email.trim().length > 0 &&
    'authenticatedAt' in value &&
    typeof value.authenticatedAt === 'number' &&
    Number.isSafeInteger(value.authenticatedAt) &&
    value.authenticatedAt >= 0 &&
    (!('avatarUrl' in value) ||
      (typeof value.avatarUrl === 'string' && value.avatarUrl.trim().length > 0))
  );
}

export function isAppSessionExpired(session: AppSession, now = Date.now()): boolean {
  return (
    !Number.isFinite(now) ||
    now < session.authenticatedAt ||
    now - session.authenticatedAt >= APP_SESSION_LIFETIME_MS
  );
}

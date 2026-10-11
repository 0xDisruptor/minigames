// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { readAppSession, removeAppSession, saveAppSession } from './app-session-storage';

const session: AppSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const unrelatedKey = 'another-app:settings';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('readAppSession', () => {
  it('returns undefined when the session is missing', () => {
    localStorage.setItem(unrelatedKey, 'keep');
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');

    expect(readAppSession()).toBeUndefined();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'without an avatar', value: session },
    {
      name: 'with an avatar',
      value: {
        ...session,
        avatarUrl: 'https://example.com/avatar.png',
      },
    },
  ])('reads a valid session $name', ({ value }) => {
    const rawSession = JSON.stringify(value);
    localStorage.setItem(APP_SESSION_STORAGE_KEY, rawSession);

    expect(readAppSession()).toEqual(value);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(rawSession);
  });

  it.each([
    { name: 'invalid JSON', value: 'not JSON' },
    { name: 'empty string', value: '' },
    { name: 'null', value: 'null' },
    { name: 'array', value: '[]' },
    { name: 'empty object', value: '{}' },
    {
      name: 'missing email',
      value: JSON.stringify({
        displayName: session.displayName,
        authenticatedAt: session.authenticatedAt,
      }),
    },
    {
      name: 'incorrect timestamp type',
      value: JSON.stringify({
        ...session,
        authenticatedAt: String(session.authenticatedAt),
      }),
    },
    {
      name: 'incorrect avatar type',
      value: JSON.stringify({ ...session, avatarUrl: 123 }),
    },
  ])('removes a session containing $name', ({ value }) => {
    localStorage.setItem(APP_SESSION_STORAGE_KEY, value);
    localStorage.setItem(unrelatedKey, 'keep');

    expect(readAppSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
  });

  it('propagates a storage read error', () => {
    const error = new Error('Storage is unavailable');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw error;
    });

    expect(() => readAppSession()).toThrow(error);
  });
});

describe('saveAppSession', () => {
  it('stores a session under the project key', () => {
    localStorage.setItem(unrelatedKey, 'keep');

    saveAppSession(session);

    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(JSON.stringify(session));
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
  });

  it('includes an available avatar', () => {
    const sessionWithAvatar: AppSession = {
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    };

    saveAppSession(sessionWithAvatar);

    expect(readAppSession()).toEqual(sessionWithAvatar);
  });

  it('stores only the allowed session fields', () => {
    const sessionWithExtraFields = {
      ...session,
      password: 'must-not-be-stored',
      accessToken: 'must-not-be-stored',
      refreshToken: 'must-not-be-stored',
      extra: 'must-not-be-stored',
    };

    saveAppSession(sessionWithExtraFields);

    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(JSON.stringify(session));
  });

  it('does not renew the authentication timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(session.authenticatedAt + 120_000);

    saveAppSession(session);
    saveAppSession(session);

    expect(readAppSession()).toEqual(session);
  });

  it('rejects invalid data without replacing the stored session', () => {
    saveAppSession(session);

    const invalidSession: AppSession = {
      ...session,
      email: '',
    };

    expect(() => saveAppSession(invalidSession)).toThrow('Cannot store an invalid app session.');
    expect(readAppSession()).toEqual(session);
  });

  it('propagates a storage write error', () => {
    const error = new Error('Storage quota exceeded');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw error;
    });

    expect(() => saveAppSession(session)).toThrow(error);
  });
});

describe('removeAppSession', () => {
  it('removes only the project session key', () => {
    saveAppSession(session);
    localStorage.setItem(unrelatedKey, 'keep');

    removeAppSession();

    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
  });

  it('can be called when the session is already missing', () => {
    localStorage.setItem(unrelatedKey, 'keep');

    expect(() => removeAppSession()).not.toThrow();
    expect(localStorage.getItem(unrelatedKey)).toBe('keep');
  });

  it('propagates a storage removal error', () => {
    const error = new Error('Storage is unavailable');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw error;
    });

    expect(() => removeAppSession()).toThrow(error);
  });
});

describe('custom storage', () => {
  it('uses the provided storage for reading, writing and removal', () => {
    saveAppSession(session);

    const anotherSession: AppSession = {
      ...session,
      email: 'another@example.com',
    };

    saveAppSession(anotherSession, sessionStorage);

    expect(readAppSession(sessionStorage)).toEqual(anotherSession);
    expect(readAppSession()).toEqual(session);

    removeAppSession(sessionStorage);

    expect(readAppSession(sessionStorage)).toBeUndefined();
    expect(readAppSession()).toEqual(session);
  });
});

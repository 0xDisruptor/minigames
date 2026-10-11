import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppSessionFromUser } from './app-session-user';

type SessionUser = Pick<User, 'displayName' | 'email' | 'photoURL'>;

const now = 1_700_000_000_000;

const user: SessionUser = {
  displayName: 'Player',
  email: 'player@example.com',
  photoURL: 'https://example.com/avatar.png',
};

const expectedSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: now,
  avatarUrl: 'https://example.com/avatar.png',
};

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAppSessionFromUser', () => {
  it('creates a session using the current time', () => {
    expect(createAppSessionFromUser(user)).toEqual(expectedSession);
  });

  it('preserves an explicitly supplied authentication timestamp', () => {
    const authenticatedAt = now - 60_000;

    expect(createAppSessionFromUser(user, authenticatedAt)).toEqual({
      ...expectedSession,
      authenticatedAt,
    });
  });

  it('trims the display name, email and avatar URL', () => {
    expect(
      createAppSessionFromUser({
        displayName: ' Player ',
        email: ' player@example.com ',
        photoURL: ' https://example.com/avatar.png ',
      }),
    ).toEqual(expectedSession);
  });

  it('handles absent Firebase display name and photo', () => {
    const userWithoutProfile: SessionUser = JSON.parse(
      '{"displayName":null,"email":"player@example.com","photoURL":null}',
    );

    expect(createAppSessionFromUser(userWithoutProfile)).toEqual({
      displayName: '',
      email: 'player@example.com',
      authenticatedAt: now,
    });
  });

  it.each(['', ' '.repeat(3)])('omits an empty or whitespace-only avatar (%j)', (photoURL) => {
    expect(createAppSessionFromUser({ ...user, photoURL })).toEqual({
      displayName: 'Player',
      email: 'player@example.com',
      authenticatedAt: now,
    });
  });

  it.each(['', ' '.repeat(3)])(
    'allows an empty display name for a later fallback (%j)',
    (displayName) => {
      expect(createAppSessionFromUser({ ...user, displayName })).toEqual({
        ...expectedSession,
        displayName: '',
      });
    },
  );

  it('rejects a Firebase user without an email', () => {
    const userWithoutEmail: SessionUser = JSON.parse(
      '{"displayName":"Player","email":null,"photoURL":null}',
    );

    expect(() => createAppSessionFromUser(userWithoutEmail)).toThrow(
      'Cannot create an app session from this user.',
    );
  });

  it.each(['', ' '.repeat(3)])('rejects an empty or whitespace-only email (%j)', (email) => {
    expect(() => createAppSessionFromUser({ ...user, email })).toThrow(
      'Cannot create an app session from this user.',
    );
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid authentication timestamp (%s)',
    (authenticatedAt) => {
      expect(() => createAppSessionFromUser(user, authenticatedAt)).toThrow(
        'Cannot create an app session from this user.',
      );
    },
  );

  it('does not copy Firebase identifiers, tokens or extra fields', () => {
    const userWithExtraFields = {
      ...user,
      uid: 'firebase-user-id',
      accessToken: 'must-not-be-stored',
      refreshToken: 'must-not-be-stored',
      extra: 'must-not-be-stored',
    };

    expect(createAppSessionFromUser(userWithExtraFields)).toEqual(expectedSession);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isAppSession, isAppSessionExpired } from './app-session';
import type { AppSession } from './app-session';

const session: AppSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: 1_700_000_000_000,
};

const parsedNull: unknown = JSON.parse('null');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isAppSession', () => {
  it('accepts a session without an avatar', () => {
    expect(isAppSession(session)).toBe(true);
  });

  it('accepts a session with an avatar', () => {
    expect(
      isAppSession({
        ...session,
        avatarUrl: 'https://example.com/avatar.png',
      }),
    ).toBe(true);
  });

  it('accepts an empty display name for a later fallback', () => {
    expect(isAppSession({ ...session, displayName: '' })).toBe(true);
  });

  it('accepts a zero timestamp', () => {
    expect(isAppSession({ ...session, authenticatedAt: 0 })).toBe(true);
  });

  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: parsedNull },
    { name: 'string', value: 'session' },
    { name: 'number', value: 123 },
    { name: 'boolean', value: true },
    { name: 'array', value: [] },
    { name: 'array containing a session', value: [session] },
    { name: 'empty object', value: {} },
  ])('rejects $name', ({ value }) => {
    expect(isAppSession(value)).toBe(false);
  });

  it.each([
    {
      name: 'displayName',
      value: {
        email: session.email,
        authenticatedAt: session.authenticatedAt,
      },
    },
    {
      name: 'email',
      value: {
        displayName: session.displayName,
        authenticatedAt: session.authenticatedAt,
      },
    },
    {
      name: 'authenticatedAt',
      value: {
        displayName: session.displayName,
        email: session.email,
      },
    },
  ])('rejects a session missing $name', ({ value }) => {
    expect(isAppSession(value)).toBe(false);
  });

  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: parsedNull },
    { name: 'number', value: 123 },
  ])('rejects a display name containing $name', ({ value }) => {
    expect(isAppSession({ ...session, displayName: value })).toBe(false);
  });

  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: parsedNull },
    { name: 'number', value: 123 },
    { name: 'empty string', value: '' },
    { name: 'whitespace', value: ' '.repeat(3) },
  ])('rejects an email containing $name', ({ value }) => {
    expect(isAppSession({ ...session, email: value })).toBe(false);
  });

  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: parsedNull },
    { name: 'string', value: String(session.authenticatedAt) },
    { name: 'negative number', value: -1 },
    { name: 'fraction', value: 1.5 },
    { name: 'NaN', value: NaN },
    { name: 'infinity', value: Infinity },
    { name: 'unsafe integer', value: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects a timestamp containing $name', ({ value }) => {
    expect(isAppSession({ ...session, authenticatedAt: value })).toBe(false);
  });

  it.each([
    { name: 'undefined', value: undefined },
    { name: 'null', value: parsedNull },
    { name: 'number', value: 123 },
    { name: 'empty string', value: '' },
    { name: 'whitespace', value: ' '.repeat(3) },
  ])('rejects a provided avatar containing $name', ({ value }) => {
    expect(isAppSession({ ...session, avatarUrl: value })).toBe(false);
  });
});

describe('isAppSessionExpired', () => {
  it.each([
    { elapsedMs: 0, isExpired: false },
    { elapsedMs: 299_999, isExpired: false },
    { elapsedMs: 300_000, isExpired: true },
    { elapsedMs: 300_001, isExpired: true },
    { elapsedMs: -1, isExpired: true },
  ])('returns $isExpired when elapsed time is $elapsedMs ms', ({ elapsedMs, isExpired }) => {
    expect(isAppSessionExpired(session, session.authenticatedAt + elapsedMs)).toBe(isExpired);
  });

  it.each([NaN, Infinity, -Infinity])('treats an invalid current time (%s) as expired', (now) => {
    expect(isAppSessionExpired(session, now)).toBe(true);
  });

  it('uses Date.now without renewing the authentication timestamp', () => {
    const frozenSession = Object.freeze({ ...session });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(session.authenticatedAt + 299_999);

    expect(isAppSessionExpired(frozenSession)).toBe(false);

    nowSpy.mockReturnValue(session.authenticatedAt + 300_000);

    expect(isAppSessionExpired(frozenSession)).toBe(true);
    expect(frozenSession.authenticatedAt).toBe(session.authenticatedAt);
  });
});

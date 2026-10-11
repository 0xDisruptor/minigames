import { describe, expect, it, vi } from 'vitest';

import type { AppSession } from './app-session';
import { createAppSessionStore } from './store';

const session: AppSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: 1_700_000_000_000,
};

describe('createAppSessionStore', () => {
  it('starts with Guest state', () => {
    const store = createAppSessionStore();

    expect(store.getSession()).toBeUndefined();
  });

  it('immediately informs a subscriber about Guest state', () => {
    const store = createAppSessionStore();
    const listener = vi.fn();

    store.subscribe(listener);

    expect(listener).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('immediately informs a subscriber about an active session', () => {
    const store = createAppSessionStore();
    store.setSession(session);
    const listener = vi.fn();

    store.subscribe(listener);

    expect(listener).toHaveBeenCalledExactlyOnceWith(session);
  });

  it('notifies all subscribers when a session becomes active', () => {
    const store = createAppSessionStore();
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    store.subscribe(firstListener);
    store.subscribe(secondListener);
    firstListener.mockClear();
    secondListener.mockClear();

    store.setSession(session);

    expect(store.getSession()).toEqual(session);
    expect(firstListener).toHaveBeenCalledExactlyOnceWith(session);
    expect(secondListener).toHaveBeenCalledExactlyOnceWith(session);
  });

  it('notifies subscribers when switching back to Guest', () => {
    const store = createAppSessionStore();
    store.setSession(session);
    const listener = vi.fn();
    store.subscribe(listener);
    listener.mockClear();

    store.setSession(undefined);

    expect(store.getSession()).toBeUndefined();
    expect(listener).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('does not repeat a Guest notification when already Guest', () => {
    const store = createAppSessionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    listener.mockClear();

    store.setSession(undefined);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifications after unsubscribing', () => {
    const store = createAppSessionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    listener.mockClear();

    unsubscribe();
    unsubscribe();
    store.setSession(session);
    store.setSession(undefined);

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps separate store instances independent', () => {
    const firstStore = createAppSessionStore();
    const secondStore = createAppSessionStore();
    const secondListener = vi.fn();

    secondStore.subscribe(secondListener);
    secondListener.mockClear();
    firstStore.setSession(session);

    expect(firstStore.getSession()).toEqual(session);
    expect(secondStore.getSession()).toBeUndefined();
    expect(secondListener).not.toHaveBeenCalled();
  });

  it('copies the session instead of retaining the source object', () => {
    const store = createAppSessionStore();
    const sourceSession = { ...session };

    store.setSession(sourceSession);

    sourceSession.email = 'changed@example.com';
    sourceSession.authenticatedAt += 60_000;

    expect(store.getSession()).toEqual(session);
  });

  it('protects the active session from external modification', () => {
    const store = createAppSessionStore();
    store.setSession(session);
    const activeSession = store.getSession();

    if (!activeSession) {
      throw new Error('Expected an active session.');
    }

    expect(() =>
      Object.assign(activeSession, {
        email: 'changed@example.com',
      }),
    ).toThrow(TypeError);

    expect(store.getSession()).toEqual(session);
  });

  it('keeps only the allowed session fields', () => {
    const store = createAppSessionStore();
    const sourceSession = {
      ...session,
      password: 'must-not-be-kept',
      accessToken: 'must-not-be-kept',
    };

    store.setSession(sourceSession);

    expect(store.getSession()).toEqual(session);
  });

  it('preserves the avatar and authentication timestamp', () => {
    const store = createAppSessionStore();
    const sessionWithAvatar: AppSession = {
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    };

    store.setSession(sessionWithAvatar);

    expect(store.getSession()).toEqual(sessionWithAvatar);
  });

  it('rejects invalid data without changing state or notifying listeners', () => {
    const store = createAppSessionStore();
    store.setSession(session);
    const listener = vi.fn();
    store.subscribe(listener);
    listener.mockClear();

    const invalidSession: AppSession = {
      ...session,
      email: '',
    };

    expect(() => store.setSession(invalidSession)).toThrow(
      'Cannot activate an invalid app session.',
    );

    expect(store.getSession()).toEqual(session);
    expect(listener).not.toHaveBeenCalled();
  });
});

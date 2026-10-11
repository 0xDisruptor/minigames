// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { createAppSessionStore } from '../state/store';
import { createAppSessionController } from './app-session-controller';
import { bindAppSessionLifecycle } from './app-session-lifecycle';
import { saveAppSession } from './app-session-storage';
import { logoutFromFirebase } from './auth';

vi.mock('./auth', () => ({
  logoutFromFirebase: vi.fn(),
}));

const now = 1_700_000_000_000;

const session: AppSession = {
  displayName: 'Player',
  email: 'player@example.com',
  authenticatedAt: now,
};

const disposers: (() => void)[] = [];

function createFixture(initialSession?: AppSession) {
  const store = createAppSessionStore();
  const onExpired = vi.fn();

  if (initialSession) {
    saveAppSession(initialSession);
    store.setSession(initialSession);
  }

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
  });

  const dispose = bindAppSessionLifecycle(controller, store);
  disposers.push(dispose);

  return { store, controller, onExpired, dispose };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(logoutFromFirebase).mockReset();
  vi.mocked(logoutFromFirebase).mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  for (const dispose of disposers) {
    dispose();
  }

  disposers.length = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('bindAppSessionLifecycle', () => {
  it('does not start a timer for Guest', () => {
    const { store, onExpired } = createFixture();

    dispatchEvent(new Event('focus'));

    expect(store.getSession()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    expect(logoutFromFirebase).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('expires an active session exactly after five minutes', async () => {
    const { store, controller, onExpired } = createFixture(session);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(299_999);

    expect(store.getSession()).toEqual(session);
    expect(onExpired).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeFalsy();
    expect(vi.getTimerCount()).toBe(0);

    await controller.whenReady();

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('uses the remaining lifetime of a restored session', async () => {
    const restoredSession: AppSession = {
      ...session,
      authenticatedAt: now - 120_000,
    };

    const { store, controller, onExpired } = createFixture(restoredSession);

    vi.advanceTimersByTime(179_999);

    expect(store.getSession()).toEqual(restoredSession);

    vi.advanceTimersByTime(1);

    expect(store.getSession()).toBeUndefined();

    await controller.whenReady();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('starts a timer when Guest becomes authenticated', async () => {
    const { store, controller } = createFixture();

    expect(vi.getTimerCount()).toBe(0);

    await controller.activate(session);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(300_000);

    expect(store.getSession()).toBeUndefined();

    await controller.whenReady();

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('replaces the timer when a new session is activated', async () => {
    const { store, controller, onExpired } = createFixture(session);

    vi.advanceTimersByTime(100_000);

    const newSession: AppSession = {
      ...session,
      email: 'another@example.com',
      authenticatedAt: Date.now(),
    };

    await controller.activate(newSession);

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(200_000);

    expect(store.getSession()).toEqual(newSession);
    expect(onExpired).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100_000);

    expect(store.getSession()).toBeUndefined();

    await controller.whenReady();

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer after manual logout', async () => {
    const { store, controller, onExpired } = createFixture(session);

    await controller.logout();

    expect(store.getSession()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(300_000);

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('checks expiration on window focus after a clock jump', async () => {
    const { store, controller, onExpired } = createFixture(session);

    vi.setSystemTime(now + 300_000);

    expect(store.getSession()).toEqual(session);

    dispatchEvent(new Event('focus'));

    expect(store.getSession()).toBeUndefined();

    dispatchEvent(new Event('focus'));

    await controller.whenReady();

    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('checks expiration when the document becomes visible', async () => {
    const { store, controller, onExpired } = createFixture(session);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.setSystemTime(now + 300_000);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(store.getSession()).toBeUndefined();

    await controller.whenReady();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('ignores visibility changes while the document is hidden', async () => {
    const { store, controller, onExpired } = createFixture(session);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    vi.setSystemTime(now + 300_000);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(store.getSession()).toEqual(session);
    expect(onExpired).not.toHaveBeenCalled();
    expect(logoutFromFirebase).not.toHaveBeenCalled();

    dispatchEvent(new Event('focus'));

    await controller.whenReady();

    expect(store.getSession()).toBeUndefined();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('does not extend the lifetime when focus returns before expiration', async () => {
    const { store, controller, onExpired } = createFixture(session);

    vi.setSystemTime(now + 100_000);
    dispatchEvent(new Event('focus'));

    expect(store.getSession()).toEqual(session);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(199_999);

    expect(store.getSession()).toEqual(session);

    vi.advanceTimersByTime(1);

    expect(store.getSession()).toBeUndefined();

    await controller.whenReady();

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('removes the timer, subscription and event handlers on disposal', () => {
    const { store, onExpired, dispose } = createFixture(session);

    dispose();
    dispose();

    expect(vi.getTimerCount()).toBe(0);

    const anotherSession: AppSession = {
      ...session,
      email: 'another@example.com',
    };

    store.setSession(anotherSession);

    expect(vi.getTimerCount()).toBe(0);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.setSystemTime(now + 300_000);

    dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(300_000);

    expect(store.getSession()).toEqual(anotherSession);
    expect(onExpired).not.toHaveBeenCalled();
    expect(logoutFromFirebase).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'expired',
      authenticatedAt: now - 300_000,
    },
    {
      name: 'future-dated',
      authenticatedAt: now + 1,
    },
  ])('clears an already $name session when binding', async ({ authenticatedAt }) => {
    const { store, controller, onExpired } = createFixture({
      ...session,
      authenticatedAt,
    });

    expect(store.getSession()).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    await controller.whenReady();

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(logoutFromFirebase).toHaveBeenCalledTimes(1);
  });
});

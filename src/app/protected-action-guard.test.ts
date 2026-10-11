// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppSessionController } from '../services/app-session-controller';
import { APP_SESSION_LIFETIME_MS, APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';
import { createAppSessionStore } from '../state/store';
import { createProtectedActionGuard } from './protected-action-guard';

const mocks = vi.hoisted(() => ({
  logoutFromFirebase: vi.fn(),
  showSnackbar: vi.fn(),
}));

vi.mock('../services/auth', () => ({
  logoutFromFirebase: mocks.logoutFromFirebase,
}));

vi.mock('../components/snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const now = 1_700_000_000_000;

const session: AppSession = {
  displayName: 'Alex Morgan',
  email: 'alex@example.com',
  authenticatedAt: now,
};

const warningMessage = 'Please sign in to use this feature.';

function createFixture() {
  const store = createAppSessionStore();
  const onExpired = vi.fn();
  const onRequireAuth = vi.fn<(trigger?: HTMLElement) => void>();

  const controller = createAppSessionController({
    store,
    storage: localStorage,
    onExpired,
  });

  const guard = createProtectedActionGuard(controller, onRequireAuth);

  return {
    store,
    controller,
    onExpired,
    onRequireAuth,
    guard,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  mocks.logoutFromFirebase.mockResolvedValue(undefined);
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('protected action guard', () => {
  it('returns an active session without extending its lifetime', async () => {
    const { controller, store, onRequireAuth, guard } = createFixture();

    await controller.activate(session);

    const storedSession = localStorage.getItem(APP_SESSION_STORAGE_KEY);

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS - 1);

    expect(guard()).toBe(store.getSession());
    expect(guard()?.authenticatedAt).toBe(session.authenticatedAt);
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBe(storedSession);
    expect(onRequireAuth).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(mocks.logoutFromFirebase).not.toHaveBeenCalled();
  });

  it('forwards the Guest trigger and shows a warning after requesting auth', () => {
    const { onRequireAuth, guard } = createFixture();
    const trigger = document.createElement('button');

    onRequireAuth.mockImplementation((receivedTrigger) => {
      expect(receivedTrigger).toBe(trigger);
      expect(mocks.showSnackbar).not.toHaveBeenCalled();
    });

    expect(guard(trigger)).toBeUndefined();

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(onRequireAuth).toHaveBeenCalledWith(trigger);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(warningMessage, 'warning');
    expect(mocks.logoutFromFirebase).not.toHaveBeenCalled();
  });

  it.each([APP_SESSION_LIFETIME_MS, APP_SESSION_LIFETIME_MS + 1])(
    'blocks an expired session after %i milliseconds',
    async (elapsed) => {
      const { controller, store, onExpired, onRequireAuth, guard } = createFixture();

      await controller.activate(session);
      localStorage.setItem('unrelated-setting', 'keep');

      vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + elapsed);

      onRequireAuth.mockImplementation(() => {
        expect(store.getSession()).toBeUndefined();
        expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
      });

      expect(guard()).toBeUndefined();

      expect(store.getSession()).toBeUndefined();
      expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem('unrelated-setting')).toBe('keep');
      expect(onExpired).toHaveBeenCalledTimes(1);
      expect(onRequireAuth).toHaveBeenCalledTimes(1);
      expect(mocks.showSnackbar).toHaveBeenCalledWith(warningMessage, 'warning');

      await controller.whenReady();

      expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
    },
  );

  it('checks the session again after a previously allowed action', async () => {
    const { controller, onExpired, onRequireAuth, guard } = createFixture();

    await controller.activate(session);

    expect(guard()).toEqual(session);
    expect(onRequireAuth).not.toHaveBeenCalled();

    vi.mocked(Date.now).mockReturnValue(session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    expect(guard()).toBeUndefined();
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);

    await controller.whenReady();

    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
  });

  it('uses the new session on the next explicit call after authentication', async () => {
    const { controller, onRequireAuth, guard } = createFixture();

    expect(guard()).toBeUndefined();

    const newSession: AppSession = {
      displayName: 'Taylor',
      email: 'taylor@example.com',
      authenticatedAt: now,
    };

    await controller.activate(newSession);

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);

    expect(guard()).toEqual(newSession);

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
  });
});

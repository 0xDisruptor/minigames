// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_SESSION_LIFETIME_MS, APP_SESSION_STORAGE_KEY } from '../state/app-session';
import type { AppSession } from '../state/app-session';

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

async function createFixture() {
  const session: AppSession = {
    displayName: 'Alex Morgan',
    email: 'alex@example.com',
    authenticatedAt: Date.now(),
  };

  localStorage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem('unrelated-setting', 'keep');

  const { sessionController } = await import('./session');
  const { appSessionStore } = await import('../state/store');

  await sessionController.initialize();

  return {
    controller: sessionController,
    store: appSessionStore,
    session,
  };
}

describe('app session feedback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    vi.spyOn(console, 'error').mockImplementation(vi.fn());

    mocks.logoutFromFirebase.mockResolvedValue(undefined);

    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows an error and keeps Guest Mode when Firebase sign-out fails', async () => {
    const fixture = await createFixture();
    const error = new Error('Firebase sign-out failed');

    mocks.logoutFromFirebase.mockRejectedValueOnce(error);

    const completion = fixture.controller.logout();

    expect(fixture.store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated-setting')).toBe('keep');

    await completion;

    expect(fixture.store.getSession()).toBeUndefined();
    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'A session error occurred. Please sign in again.',
      'error',
    );
    expect(console.error).toHaveBeenCalledWith('App session operation failed.', error);
  });

  it('completes successful logout without error feedback', async () => {
    const fixture = await createFixture();

    await fixture.controller.logout();

    expect(fixture.store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated-setting')).toBe('keep');
    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('shows one expiration notification and switches to Guest Mode', async () => {
    const fixture = await createFixture();

    vi.mocked(Date.now).mockReturnValue(fixture.session.authenticatedAt + APP_SESSION_LIFETIME_MS);

    expect(fixture.controller.getActiveSession()).toBeUndefined();
    expect(fixture.controller.getActiveSession()).toBeUndefined();

    await fixture.controller.whenReady();

    expect(fixture.store.getSession()).toBeUndefined();
    expect(localStorage.getItem(APP_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated-setting')).toBe('keep');
    expect(mocks.logoutFromFirebase).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Your session has expired. Please sign in again.',
      'error',
    );
    expect(console.error).not.toHaveBeenCalled();
  });
});

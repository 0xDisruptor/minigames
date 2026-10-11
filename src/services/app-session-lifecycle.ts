import { APP_SESSION_LIFETIME_MS } from '../state/app-session';
import { appSessionStore } from '../state/store';
import type { AppSessionStore } from '../state/store';
import type { AppSessionController } from './app-session-controller';

export function bindAppSessionLifecycle(
  controller: AppSessionController,
  store: AppSessionStore = appSessionStore,
): () => void {
  let expirationTimer: ReturnType<typeof setTimeout> | undefined;
  let isDisposed = false;

  function clearExpirationTimer(): void {
    if (expirationTimer === undefined) {
      return;
    }

    clearTimeout(expirationTimer);
    expirationTimer = undefined;
  }

  function checkSession(): void {
    if (isDisposed) {
      return;
    }

    clearExpirationTimer();

    const session = controller.getActiveSession();

    if (!session) {
      return;
    }

    const remainingMs = Math.max(
      0,
      APP_SESSION_LIFETIME_MS - (Date.now() - session.authenticatedAt),
    );

    expirationTimer = setTimeout(checkSession, remainingMs);
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      checkSession();
    }
  }

  const unsubscribe = store.subscribe(checkSession);

  window.addEventListener('focus', checkSession);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    isDisposed = true;
    unsubscribe();
    clearExpirationTimer();
    window.removeEventListener('focus', checkSession);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

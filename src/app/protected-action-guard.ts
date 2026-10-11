import { showSnackbar } from '../components/snackbar/snackbar';
import type { AppSessionController } from '../services/app-session-controller';
import type { AppSession } from '../state/app-session';

export type ProtectedActionGuard = (trigger?: HTMLElement) => AppSession | undefined;

export function createProtectedActionGuard(
  controller: Pick<AppSessionController, 'getActiveSession'>,
  onRequireAuth: (trigger?: HTMLElement) => void,
): ProtectedActionGuard {
  return (trigger): AppSession | undefined => {
    const session = controller.getActiveSession();

    if (!session) {
      onRequireAuth(trigger);
      showSnackbar('Please sign in to use this feature.', 'warning');
    }

    return session;
  };
}

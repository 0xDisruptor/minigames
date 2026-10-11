import type { AppSessionController } from '../services/app-session-controller';
import { showSnackbar } from '../components/snackbar/snackbar';
import { updateUrlQuery } from './navigation';

export function canOpenAuthDialog(
  controller: Pick<AppSessionController, 'getActiveSession'>,
): boolean {
  const session = controller.getActiveSession();

  if (!session) {
    return true;
  }

  updateUrlQuery({ auth: undefined }, true);

  showSnackbar('You are already signed in.', 'info');

  return false;
}

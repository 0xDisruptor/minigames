import { showSnackbar } from '../components/snackbar/snackbar';
import { createAppSessionController } from '../services/app-session-controller';

export const sessionController = createAppSessionController({
  onExpired: (): void => {
    showSnackbar('Your session has expired. Please sign in again.', 'error');
  },
  onError: (error: unknown): void => {
    console.error('App session operation failed.', error);

    showSnackbar('A session error occurred. Please sign in again.', 'error');
  },
});

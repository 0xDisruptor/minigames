import type { User } from 'firebase/auth';
import { loginWithGoogle } from '../../services/auth';
import { getAuthErrorMessage } from '../../utils/auth-error-message';
import { showSnackbar } from '../snackbar/snackbar';
import type { AuthFormPending } from './auth-form-pending';

interface GoogleAuthOptions {
  readonly form: HTMLFormElement;
  readonly button: HTMLButtonElement;
  readonly label: HTMLSpanElement;
  readonly pending: AuthFormPending;
  readonly callbacks: {
    readonly onAuthenticated?: (user: User) => void;
    readonly onPendingChange?: (isPending: boolean) => void;
  };
}

export function bindGoogleAuth({
  form,
  button,
  label,
  pending,
  callbacks,
}: GoogleAuthOptions): void {
  async function authenticateWithGoogle(): Promise<void> {
    if (pending.isPending()) {
      return;
    }

    const originalLabel = label.textContent ?? '';

    pending.setPending(true);
    label.textContent = 'Connecting to Google…';

    let user: User;

    try {
      callbacks.onPendingChange?.(true);
      user = await loginWithGoogle();
    } catch (error: unknown) {
      showSnackbar(getAuthErrorMessage(error), 'error');
      return;
    } finally {
      pending.setPending(false);
      label.textContent = originalLabel;
      callbacks.onPendingChange?.(false);
    }

    form.reset();
    callbacks.onAuthenticated?.(user);
    showSnackbar('Signed in successfully.', 'success');
  }

  button.addEventListener('click', (): void => {
    void authenticateWithGoogle();
  });
}

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
    readonly onBeforeAuthenticate?: () => void | Promise<void>;
    readonly onAuthenticated?: (user: User) => void | Promise<void>;
    readonly onAuthenticationComplete?: () => void;
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

    try {
      callbacks.onPendingChange?.(true);

      if (callbacks.onBeforeAuthenticate) {
        await callbacks.onBeforeAuthenticate();
      }

      const user = await loginWithGoogle();
      await callbacks.onAuthenticated?.(user);
    } catch (error: unknown) {
      showSnackbar(getAuthErrorMessage(error), 'error');
      return;
    } finally {
      pending.setPending(false);
      label.textContent = originalLabel;
      callbacks.onPendingChange?.(false);
    }

    form.reset();
    callbacks.onAuthenticationComplete?.();
    showSnackbar('Signed in successfully.', 'success');
  }

  button.addEventListener('click', (): void => {
    void authenticateWithGoogle();
  });
}

const defaultMessage = 'Authentication could not be completed. Please try again.';

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || !error || !('code' in error) || typeof error.code !== 'string') {
    return defaultMessage;
  }

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found': {
      return 'Incorrect email or password.';
    }

    case 'auth/invalid-email': {
      return 'Enter a valid email address.';
    }

    case 'auth/email-already-in-use': {
      return 'This email is already registered. Please log in.';
    }

    case 'auth/weak-password': {
      return 'Choose a stronger password.';
    }

    case 'auth/user-disabled': {
      return 'This account has been disabled.';
    }

    case 'auth/too-many-requests': {
      return 'Too many attempts. Please wait and try again.';
    }

    case 'auth/network-request-failed': {
      return 'Check your internet connection and try again.';
    }

    case 'auth/popup-blocked': {
      return 'Allow pop-ups in your browser and try Google sign-in again.';
    }

    case 'auth/popup-closed-by-user': {
      return 'Google sign-in was cancelled. You can try again.';
    }

    case 'auth/cancelled-popup-request': {
      return 'Another sign-in attempt interrupted this one. Please try again.';
    }

    case 'auth/account-exists-with-different-credential': {
      return 'This email uses another sign-in method. Please use your original method.';
    }

    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/operation-not-supported-in-this-environment': {
      return 'This sign-in method is currently unavailable.';
    }

    default: {
      return defaultMessage;
    }
  }
}

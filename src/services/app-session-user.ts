import type { User } from 'firebase/auth';

import { isAppSession } from '../state/app-session';
import type { AppSession } from '../state/app-session';

export function createAppSessionFromUser(
  user: Pick<User, 'displayName' | 'email' | 'photoURL'>,
  authenticatedAt: number = Date.now(),
): AppSession {
  const avatarUrl = user.photoURL?.trim() ?? '';

  const session: AppSession = {
    displayName: user.displayName?.trim() ?? '',
    email: user.email?.trim() ?? '',
    authenticatedAt,
    ...(avatarUrl && { avatarUrl }),
  };

  if (!isAppSession(session)) {
    throw new Error('Cannot create an app session from this user.');
  }

  return session;
}

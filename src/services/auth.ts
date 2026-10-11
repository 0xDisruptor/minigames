import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationCredentials extends LoginCredentials {
  readonly username: string;
}

export async function registerWithEmail(credentials: RegistrationCredentials): Promise<User> {
  const auth = getFirebaseAuth();

  const { user } = await createUserWithEmailAndPassword(
    auth,
    credentials.email.trim(),
    credentials.password,
  );

  await updateProfile(user, {
    displayName: credentials.username,
  });

  return user;
}

export async function loginWithEmail(credentials: LoginCredentials): Promise<User> {
  const auth = getFirebaseAuth();

  const { user } = await signInWithEmailAndPassword(
    auth,
    credentials.email.trim(),
    credentials.password,
  );

  return user;
}

export async function loginWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account',
  });

  const { user } = await signInWithPopup(auth, provider);

  return user;
}

export function logoutFromFirebase(): Promise<void> {
  return signOut(getFirebaseAuth());
}

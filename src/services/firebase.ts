import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

function getRequiredConfigValue(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing Firebase configuration: ${name}`);
  }

  return value.trim();
}

function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: getRequiredConfigValue(import.meta.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
    authDomain: getRequiredConfigValue(
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      'VITE_FIREBASE_AUTH_DOMAIN',
    ),
    projectId: getRequiredConfigValue(
      import.meta.env.VITE_FIREBASE_PROJECT_ID,
      'VITE_FIREBASE_PROJECT_ID',
    ),
    appId: getRequiredConfigValue(import.meta.env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  };
}

export function getFirebaseAuth(): Auth {
  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());

  return getAuth(app);
}

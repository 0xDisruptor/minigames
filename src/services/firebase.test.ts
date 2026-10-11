import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

const sdkMocks = vi.hoisted(() => ({
  getApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: sdkMocks.getApp,
  getApps: sdkMocks.getApps,
  initializeApp: sdkMocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  getAuth: sdkMocks.getAuth,
}));

const mockApp = { name: '[DEFAULT]' } as FirebaseApp;
const mockAuth = { app: mockApp } as Auth;

const firebaseConfig = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'test-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'test-project',
  VITE_FIREBASE_APP_ID: 'test-app-id',
};

const expectedOptions = {
  apiKey: firebaseConfig.VITE_FIREBASE_API_KEY,
  authDomain: firebaseConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseConfig.VITE_FIREBASE_PROJECT_ID,
  appId: firebaseConfig.VITE_FIREBASE_APP_ID,
};

beforeEach(() => {
  vi.resetAllMocks();

  sdkMocks.getApps.mockReturnValue([]);
  sdkMocks.getApp.mockReturnValue(mockApp);
  sdkMocks.initializeApp.mockReturnValue(mockApp);
  sdkMocks.getAuth.mockReturnValue(mockAuth);

  for (const [name, value] of Object.entries(firebaseConfig)) {
    vi.stubEnv(name, value);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getFirebaseAuth', () => {
  it('initializes Firebase with the configured options', () => {
    const result = getFirebaseAuth();

    expect(sdkMocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdkMocks.initializeApp).toHaveBeenCalledWith(expectedOptions);
    expect(sdkMocks.getApp).not.toHaveBeenCalled();
    expect(sdkMocks.getAuth).toHaveBeenCalledWith(mockApp);
    expect(result).toBe(mockAuth);
  });

  it('reuses an existing Firebase app', () => {
    sdkMocks.getApps.mockReturnValue([mockApp]);

    const result = getFirebaseAuth();

    expect(sdkMocks.getApp).toHaveBeenCalledTimes(1);
    expect(sdkMocks.initializeApp).not.toHaveBeenCalled();
    expect(sdkMocks.getAuth).toHaveBeenCalledWith(mockApp);
    expect(result).toBe(mockAuth);
  });

  it('does not initialize the app again on a second call', () => {
    sdkMocks.getApps.mockReturnValueOnce([]).mockReturnValue([mockApp]);

    expect(getFirebaseAuth()).toBe(mockAuth);
    expect(getFirebaseAuth()).toBe(mockAuth);

    expect(sdkMocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(sdkMocks.getApp).toHaveBeenCalledTimes(1);
    expect(sdkMocks.getAuth).toHaveBeenCalledTimes(2);
  });

  it('trims configuration values', () => {
    for (const [name, value] of Object.entries(firebaseConfig)) {
      vi.stubEnv(name, ` ${value} `);
    }

    getFirebaseAuth();

    expect(sdkMocks.initializeApp).toHaveBeenCalledWith(expectedOptions);
  });

  it.each(Object.keys(firebaseConfig))('reports missing configuration: %s', (name) => {
    vi.stubEnv(name, undefined);

    expect(() => getFirebaseAuth()).toThrow(`Missing Firebase configuration: ${name}`);

    expect(sdkMocks.initializeApp).not.toHaveBeenCalled();
    expect(sdkMocks.getAuth).not.toHaveBeenCalled();
  });

  it.each(['', ' '.repeat(3)])('rejects an empty configuration value: %j', (value) => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', value);

    expect(() => getFirebaseAuth()).toThrow(
      'Missing Firebase configuration: VITE_FIREBASE_API_KEY',
    );

    expect(sdkMocks.initializeApp).not.toHaveBeenCalled();
    expect(sdkMocks.getAuth).not.toHaveBeenCalled();
  });

  it('propagates initialization errors', () => {
    sdkMocks.initializeApp.mockImplementationOnce(() => {
      throw new Error('Firebase initialization failed.');
    });

    expect(() => getFirebaseAuth()).toThrow('Firebase initialization failed.');

    expect(sdkMocks.getAuth).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthProvider } from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { loginWithEmail, loginWithGoogle, logoutFromFirebase, registerWithEmail } from './auth';

const sdkMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  setCustomParameters: vi.fn(),
}));

vi.mock('./firebase', () => ({
  getFirebaseAuth: sdkMocks.getFirebaseAuth,
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: sdkMocks.createUserWithEmailAndPassword,
  signInWithEmailAndPassword: sdkMocks.signInWithEmailAndPassword,
  signInWithPopup: sdkMocks.signInWithPopup,
  updateProfile: sdkMocks.updateProfile,
  signOut: sdkMocks.signOut,
  GoogleAuthProvider: class {
    setCustomParameters = sdkMocks.setCustomParameters;
  },
}));

const mockAuth = {} as Auth;

const mockUser = {
  uid: 'test-user',
  email: 'alex@minigames.com',
  displayName: 'Alex',
} as User;

const credentials = {
  email: ' alex@minigames.com ',
  password: 'Ab1!xy',
  username: 'Alex',
};

beforeEach(() => {
  vi.resetAllMocks();

  sdkMocks.getFirebaseAuth.mockReturnValue(mockAuth);
  sdkMocks.createUserWithEmailAndPassword.mockResolvedValue({
    user: mockUser,
  });
  sdkMocks.signInWithEmailAndPassword.mockResolvedValue({
    user: mockUser,
  });
  sdkMocks.signInWithPopup.mockResolvedValue({
    user: mockUser,
  });
  sdkMocks.updateProfile.mockResolvedValue(undefined);
  sdkMocks.signOut.mockResolvedValue(undefined);
});

describe('registerWithEmail', () => {
  it('creates an account, saves the username and returns the user', async () => {
    const result = await registerWithEmail(credentials);

    expect(sdkMocks.createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(sdkMocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      'alex@minigames.com',
      'Ab1!xy',
    );

    expect(sdkMocks.updateProfile).toHaveBeenCalledWith(mockUser, {
      displayName: 'Alex',
    });

    expect(result).toBe(mockUser);
  });

  it('propagates account creation errors without updating the profile', async () => {
    const error = new Error('Account creation failed.');
    sdkMocks.createUserWithEmailAndPassword.mockRejectedValueOnce(error);

    await expect(registerWithEmail(credentials)).rejects.toBe(error);

    expect(sdkMocks.updateProfile).not.toHaveBeenCalled();
  });

  it('propagates profile update errors', async () => {
    const error = new Error('Profile update failed.');
    sdkMocks.updateProfile.mockRejectedValueOnce(error);

    await expect(registerWithEmail(credentials)).rejects.toBe(error);

    expect(sdkMocks.createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(sdkMocks.updateProfile).toHaveBeenCalledWith(mockUser, {
      displayName: 'Alex',
    });
  });
});

describe('loginWithEmail', () => {
  it('trims the email, preserves the password and returns the user', async () => {
    const result = await loginWithEmail({
      email: credentials.email,
      password: ' 123456 ',
    });

    expect(sdkMocks.signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(sdkMocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      mockAuth,
      'alex@minigames.com',
      ' 123456 ',
    );

    expect(result).toBe(mockUser);
    expect(sdkMocks.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('propagates sign-in errors', async () => {
    const error = new Error('Invalid credentials.');
    sdkMocks.signInWithEmailAndPassword.mockRejectedValueOnce(error);

    await expect(loginWithEmail(credentials)).rejects.toBe(error);
  });
});

describe('loginWithGoogle', () => {
  it('opens Google sign-in with account selection and returns the user', async () => {
    const result = await loginWithGoogle();

    expect(sdkMocks.setCustomParameters).toHaveBeenCalledWith({
      prompt: 'select_account',
    });

    expect(sdkMocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(sdkMocks.signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(GoogleAuthProvider));

    expect(result).toBe(mockUser);
  });

  it('propagates popup errors or cancellation', async () => {
    const error = new Error('Google popup closed.');
    sdkMocks.signInWithPopup.mockRejectedValueOnce(error);

    await expect(loginWithGoogle()).rejects.toBe(error);
  });
});

describe('logoutFromFirebase', () => {
  it('signs out from the configured Firebase Auth instance', async () => {
    await expect(logoutFromFirebase()).resolves.toBeUndefined();

    expect(sdkMocks.signOut).toHaveBeenCalledTimes(1);
    expect(sdkMocks.signOut).toHaveBeenCalledWith(mockAuth);
  });

  it('propagates sign-out errors', async () => {
    const error = new Error('Sign-out failed.');
    sdkMocks.signOut.mockRejectedValueOnce(error);

    await expect(logoutFromFirebase()).rejects.toBe(error);
  });
});

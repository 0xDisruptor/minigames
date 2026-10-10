import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage } from './auth-error-message';

const defaultMessage = 'Authentication could not be completed. Please try again.';

describe('getAuthErrorMessage', () => {
  it.each([
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/wrong-password',
    'auth/user-not-found',
  ])('returns a credentials message for %s', (code) => {
    expect(getAuthErrorMessage({ code })).toBe('Incorrect email or password.');
  });

  it.each([
    ['auth/invalid-email', 'Enter a valid email address.'],
    ['auth/email-already-in-use', 'This email is already registered. Please log in.'],
    ['auth/weak-password', 'Choose a stronger password.'],
    ['auth/user-disabled', 'This account has been disabled.'],
    ['auth/too-many-requests', 'Too many attempts. Please wait and try again.'],
    ['auth/network-request-failed', 'Check your internet connection and try again.'],
    ['auth/popup-blocked', 'Allow pop-ups in your browser and try Google sign-in again.'],
    ['auth/popup-closed-by-user', 'Google sign-in was cancelled. You can try again.'],
    [
      'auth/cancelled-popup-request',
      'Another sign-in attempt interrupted this one. Please try again.',
    ],
    [
      'auth/account-exists-with-different-credential',
      'This email uses another sign-in method. Please use your original method.',
    ],
  ])('returns an actionable message for %s', (code, expectedMessage) => {
    const error = Object.assign(new Error('Internal SDK details'), {
      code,
    });

    expect(getAuthErrorMessage(error)).toBe(expectedMessage);
  });

  it.each([
    'auth/unauthorized-domain',
    'auth/operation-not-allowed',
    'auth/operation-not-supported-in-this-environment',
  ])('explains that the sign-in method is unavailable for %s', (code) => {
    expect(getAuthErrorMessage({ code })).toBe('This sign-in method is currently unavailable.');
  });

  it.each([
    undefined,
    '',
    'auth/invalid-email',
    42,
    false,
    {},
    { code: undefined },
    { code: 42 },
    { message: 'Internal SDK details' },
    new Error('Internal SDK details'),
  ])('handles an unexpected error value: %j', (error) => {
    expect(getAuthErrorMessage(error)).toBe(defaultMessage);
  });

  it('handles a null value from a parsed response', () => {
    const error: unknown = JSON.parse('null');

    expect(getAuthErrorMessage(error)).toBe(defaultMessage);
  });

  it.each(['auth/unknown-error', 'constructor', 'toString'])(
    'uses the fallback for an unrecognized code: %s',
    (code) => {
      expect(getAuthErrorMessage({ code })).toBe(defaultMessage);
    },
  );

  it('does not expose technical details for an unknown error', () => {
    const error = {
      code: 'auth/internal-error',
      message: 'Internal SDK details containing request data',
    };

    const message = getAuthErrorMessage(error);

    expect(message).toBe(defaultMessage);
    expect(message).not.toContain(error.message);
    expect(message).not.toContain(error.code);
  });
});

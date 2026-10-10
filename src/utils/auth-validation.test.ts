import { describe, expect, it } from 'vitest';
import { validateEmail } from './auth-validation';

describe('validateEmail', () => {
  it.each([
    'alex@minigames.com',
    'alex.smith@minigames.com',
    'alex+games@minigames.com',
    ' alex@minigames.com ',
  ])('accepts a valid email: %j', (value) => {
    expect(validateEmail(value)).toBeUndefined();
  });

  it.each(['', ' '.repeat(3)])('rejects an empty email: %j', (value) => {
    expect(validateEmail(value)).toBe('Email is required.');
  });

  it.each([
    'alex',
    'alex@minigames',
    '@minigames.com',
    'alex@@minigames.com',
    'alex smith@minigames.com',
    'alex@mini games.com',
  ])('rejects an invalid email: %j', (value) => {
    expect(validateEmail(value)).toBe('Enter a valid email address.');
  });
});

import { describe, expect, it } from 'vitest';
import {
  validateConfirmPassword,
  validateEmail,
  validateLoginPassword,
  validateRegisterPassword,
  validateUsername,
} from './auth-validation';

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

describe('validateUsername', () => {
  it.each(['Alex', 'A1', `A${'a'.repeat(29)}`])('accepts a valid username: %j', (value) => {
    expect(validateUsername(value)).toBeUndefined();
  });

  it('rejects an empty username', () => {
    expect(validateUsername('')).toBe('Username is required.');
  });

  it.each(['A', 'A'.repeat(31)])('rejects a username outside the length limits: %j', (value) => {
    expect(validateUsername(value)).toBe('Username must contain 2–30 characters.');
  });

  it.each(['alex', '1Alex', 'Alex_99', 'Alex Smith', 'Алекс', ' Alex', 'Alex '])(
    'rejects an invalid username format: %j',
    (value) => {
      expect(validateUsername(value)).toBe(
        'Start with an uppercase English letter. Use English letters and digits only.',
      );
    },
  );
});

describe('validateLoginPassword', () => {
  it.each(['abcdef', '123456', 'Ab1!xy'])(
    'accepts a password with at least 6 characters: %j',
    (value) => {
      expect(validateLoginPassword(value)).toBeUndefined();
    },
  );

  it('rejects an empty password', () => {
    expect(validateLoginPassword('')).toBe('Password is required.');
  });

  it.each(['a', '12345'])('rejects a short password: %j', (value) => {
    expect(validateLoginPassword(value)).toBe('Password must contain at least 6 characters.');
  });
});

describe('validateRegisterPassword', () => {
  it.each(['Ab1!xy', 'Az9~aa', 'A0$bbb'])(
    'accepts a password meeting all registration rules: %j',
    (value) => {
      expect(validateRegisterPassword(value)).toBeUndefined();
    },
  );

  it('rejects an empty password', () => {
    expect(validateRegisterPassword('')).toBe('Password is required.');
  });

  it('rejects a password shorter than 6 characters', () => {
    expect(validateRegisterPassword('A1!')).toBe('Password must contain at least 6 characters.');
  });

  it.each(['Ab1! x', 'Ab1!яx', 'Ab1!\nx'])(
    'rejects unsupported characters or whitespace: %j',
    (value) => {
      expect(validateRegisterPassword(value)).toBe(
        'Use English letters, digits and special characters only, without spaces.',
      );
    },
  );

  it('requires an uppercase English letter', () => {
    expect(validateRegisterPassword('ab1!xy')).toBe('Add at least one uppercase English letter.');
  });

  it('requires a digit', () => {
    expect(validateRegisterPassword('Abc!xy')).toBe('Add at least one digit.');
  });

  it('requires a special character', () => {
    expect(validateRegisterPassword('Abc1xy')).toBe('Add at least one special character.');
  });
});

describe('validateConfirmPassword', () => {
  it.each(['', 'Ab1!xy'])('requires confirmation regardless of the password: %j', (password) => {
    expect(validateConfirmPassword('', password)).toBe('Confirm your password.');
  });

  it('accepts matching passwords', () => {
    expect(validateConfirmPassword('Ab1!xy', 'Ab1!xy')).toBeUndefined();
  });

  it('does not apply password strength rules to confirmation', () => {
    expect(validateConfirmPassword('abc', 'abc')).toBeUndefined();
  });

  it.each(['Ab1!xY', 'Ab1!xy ', 'different'])(
    'rejects a confirmation that does not match exactly: %j',
    (value) => {
      expect(validateConfirmPassword(value, 'Ab1!xy')).toBe('Passwords must match.');
    },
  );
});

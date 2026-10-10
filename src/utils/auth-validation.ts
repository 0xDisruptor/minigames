export type ValidationError = string | undefined;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const usernamePattern = /^[A-Z][A-Za-z\d]{1,29}$/u;
const passwordCharactersPattern = /^[A-Za-z\d\p{P}\p{S}]+$/u;

export function validateEmail(value: string): ValidationError {
  const email = value.trim();

  if (email.length === 0) {
    return 'Email is required.';
  }

  return emailPattern.test(email) ? undefined : 'Enter a valid email address.';
}

export function validateUsername(value: string): ValidationError {
  if (value.length === 0) {
    return 'Username is required.';
  }

  if (value.length < 2 || value.length > 30) {
    return 'Username must contain 2–30 characters.';
  }

  return usernamePattern.test(value)
    ? undefined
    : 'Start with an uppercase English letter. Use English letters and digits only.';
}

export function validateLoginPassword(value: string): ValidationError {
  if (value.length === 0) {
    return 'Password is required.';
  }

  return value.length >= 6 ? undefined : 'Password must contain at least 6 characters.';
}

export function validateRegisterPassword(value: string): ValidationError {
  const lengthError = validateLoginPassword(value);

  if (lengthError !== undefined) {
    return lengthError;
  }

  if (!passwordCharactersPattern.test(value)) {
    return 'Use English letters, digits and special characters only, without spaces.';
  }

  if (!/[A-Z]/u.test(value)) {
    return 'Add at least one uppercase English letter.';
  }

  if (!/\d/u.test(value)) {
    return 'Add at least one digit.';
  }

  return /[\p{P}\p{S}]/u.test(value) ? undefined : 'Add at least one special character.';
}

export function validateConfirmPassword(value: string, password: string): ValidationError {
  if (value.length === 0) {
    return 'Confirm your password.';
  }

  return value === password ? undefined : 'Passwords must match.';
}

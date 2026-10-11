import { describe, expect, it } from 'vitest';
import {
  getCommentAuthorInitial,
  getCommentAuthorName,
  getCommentTextLength,
  isCommentAuthorNameValid,
  isCommentTextValid,
  normalizeCommentText,
} from './comment-validation';

describe('normalizeCommentText', () => {
  it('trims the edges while preserving internal spaces and line breaks', () => {
    const content = `First${' '.repeat(2)}line.\nSecond line.`;
    const padding = ' \t\n';

    expect(normalizeCommentText(`${padding}${content}${padding}`)).toBe(content);
  });

  it('normalizes whitespace-only input to an empty string', () => {
    expect(normalizeCommentText(' \t\n')).toBe('');
  });
});

describe('getCommentTextLength', () => {
  it.each([
    { text: '', length: 0 },
    { text: ' abc ', length: 3 },
    { text: 'a\nb', length: 3 },
    { text: '😀', length: 1 },
    { text: 'A😀Б', length: 3 },
  ])('counts $text as $length characters', ({ text, length }) => {
    expect(getCommentTextLength(text)).toBe(length);
  });
});

describe('isCommentTextValid', () => {
  it.each([
    {
      name: 'empty text',
      text: '',
      isValid: false,
    },
    {
      name: 'whitespace-only text',
      text: ' \t\n',
      isValid: false,
    },
    {
      name: 'one character',
      text: 'a',
      isValid: true,
    },
    {
      name: '500 characters',
      text: 'a'.repeat(500),
      isValid: true,
    },
    {
      name: '501 characters',
      text: 'a'.repeat(501),
      isValid: false,
    },
    {
      name: '500 characters surrounded by whitespace',
      text: ` ${'a'.repeat(500)} `,
      isValid: true,
    },
    {
      name: 'short content with long whitespace padding',
      text: `${' '.repeat(500)}a${' '.repeat(500)}`,
      isValid: true,
    },
    {
      name: '500 Unicode characters',
      text: '😀'.repeat(500),
      isValid: true,
    },
    {
      name: '501 Unicode characters',
      text: '😀'.repeat(501),
      isValid: false,
    },
  ])('validates $name', ({ text, isValid }) => {
    expect(isCommentTextValid(text)).toBe(isValid);
  });
});

describe('isCommentAuthorNameValid', () => {
  it.each([
    {
      name: 'empty name',
      value: '',
      isValid: false,
    },
    {
      name: 'whitespace-only name',
      value: ' \t\n',
      isValid: false,
    },
    {
      name: 'one character',
      value: 'A',
      isValid: false,
    },
    {
      name: 'two characters',
      value: 'Al',
      isValid: true,
    },
    {
      name: 'trimmed two-character name',
      value: ' Al ',
      isValid: true,
    },
    {
      name: '30 characters',
      value: 'A'.repeat(30),
      isValid: true,
    },
    {
      name: '31 characters',
      value: 'A'.repeat(31),
      isValid: false,
    },
    {
      name: 'one Unicode character',
      value: '😀',
      isValid: false,
    },
    {
      name: 'two Unicode characters',
      value: '😀😀',
      isValid: true,
    },
    {
      name: '30 Unicode characters',
      value: '😀'.repeat(30),
      isValid: true,
    },
    {
      name: '31 Unicode characters',
      value: '😀'.repeat(31),
      isValid: false,
    },
  ])('validates $name', ({ value, isValid }) => {
    expect(isCommentAuthorNameValid(value)).toBe(isValid);
  });
});

describe('getCommentAuthorName', () => {
  it.each([
    {
      name: 'valid profile name',
      displayName: 'Alex Morgan',
      email: 'alex@example.com',
      expectedName: 'Alex Morgan',
    },
    {
      name: 'profile name with surrounding whitespace',
      displayName: ' Alex Morgan ',
      email: 'alex@example.com',
      expectedName: 'Alex Morgan',
    },
    {
      name: 'profile name at the maximum length',
      displayName: 'A'.repeat(30),
      email: 'alex@example.com',
      expectedName: 'A'.repeat(30),
    },
    {
      name: 'missing profile name',
      displayName: '',
      email: 'alex@example.com',
      expectedName: 'alex',
    },
    {
      name: 'whitespace-only profile name',
      displayName: ' '.repeat(3),
      email: 'alex@example.com',
      expectedName: 'alex',
    },
    {
      name: 'profile name below the minimum length',
      displayName: 'A',
      email: 'alex@example.com',
      expectedName: 'alex',
    },
    {
      name: 'profile name above the maximum length',
      displayName: 'A'.repeat(31),
      email: 'alex@example.com',
      expectedName: 'alex',
    },
    {
      name: 'email local part with surrounding whitespace',
      displayName: '',
      email: ' alex@example.com ',
      expectedName: 'alex',
    },
    {
      name: 'email local part at the maximum length',
      displayName: '',
      email: `${'a'.repeat(30)}@example.com`,
      expectedName: 'a'.repeat(30),
    },
    {
      name: 'both profile and email names are too short',
      displayName: 'A',
      email: 'a@example.com',
      expectedName: 'Player',
    },
    {
      name: 'both profile and email names are too long',
      displayName: 'A'.repeat(31),
      email: `${'a'.repeat(31)}@example.com`,
      expectedName: 'Player',
    },
  ])('handles $name', ({ displayName, email, expectedName }) => {
    const result = getCommentAuthorName({ displayName, email });

    expect(result).toBe(expectedName);
    expect(isCommentAuthorNameValid(result)).toBe(true);
  });
});

describe('getCommentAuthorInitial', () => {
  it.each([
    { name: 'alex', initial: 'A' },
    { name: ' Alex Morgan ', initial: 'A' },
    { name: 'алина', initial: 'А' },
    { name: 'émilie', initial: 'É' },
    { name: '😀Alex', initial: '😀' },
    { name: '', initial: '?' },
    { name: ' \t\n', initial: '?' },
  ])('returns $initial for $name', ({ name, initial }) => {
    expect(getCommentAuthorInitial(name)).toBe(initial);
  });
});

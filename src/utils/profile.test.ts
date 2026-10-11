import { describe, expect, it } from 'vitest';

import { getProfileInitials, getProfileName } from './profile';

describe('getProfileName', () => {
  it('prefers the trimmed display name', () => {
    expect(
      getProfileName({
        displayName: ' Alex Morgan ',
        email: 'player@example.com',
      }),
    ).toBe('Alex Morgan');
  });

  it.each(['', ' '.repeat(3)])(
    'uses the email prefix when the display name is empty (%j)',
    (displayName) => {
      expect(
        getProfileName({
          displayName,
          email: ' player@example.com ',
        }),
      ).toBe('player');
    },
  );

  it.each(['', ' '.repeat(3), '@example.com'])(
    'uses a generic name when the email prefix is unavailable (%j)',
    (email) => {
      expect(
        getProfileName({
          displayName: '',
          email,
        }),
      ).toBe('Player');
    },
  );

  it('preserves characters in the display name', () => {
    expect(
      getProfileName({
        displayName: '<b>Alex</b>',
        email: 'player@example.com',
      }),
    ).toBe('<b>Alex</b>');
  });
});

describe('getProfileInitials', () => {
  it.each([
    { profileName: 'Alex', expected: 'A' },
    { profileName: 'alex', expected: 'A' },
    { profileName: 'Alex Morgan', expected: 'AM' },
    { profileName: 'Alex Morgan Smith', expected: 'AM' },
    { profileName: '!Alex #Morgan', expected: 'AM' },
    { profileName: '007 Bond', expected: '0B' },
    { profileName: 'Алексей Иванов', expected: 'АИ' },
    { profileName: 'алексей иванов', expected: 'АИ' },
    { profileName: 'Élodie Brontë', expected: 'ÉB' },
    { profileName: 'Νίκος Παππάς', expected: 'ΝΠ' },
    { profileName: '١٢٣ علي', expected: '١ع' },
    { profileName: '😀alex 💥morgan', expected: 'AM' },
    { profileName: 'Alex\tMorgan\nSmith', expected: 'AM' },
    {
      profileName: ['', 'Alex', 'Morgan', ''].join(' '.repeat(3)),
      expected: 'AM',
    },
    { profileName: '!!! Alex Morgan', expected: 'A' },
    { profileName: '! # Alex', expected: '?' },
    { profileName: '!!!', expected: '?' },
    { profileName: '😀', expected: '?' },
    { profileName: '', expected: '?' },
    { profileName: ' '.repeat(3), expected: '?' },
  ])('returns "$expected" for "$profileName"', ({ profileName, expected }) => {
    expect(getProfileInitials(profileName)).toBe(expected);
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import type { AppSession } from '../../state/app-session';
import { createUserProfile } from './user-profile';

const session: AppSession = {
  displayName: 'Alex Morgan',
  email: 'alex@example.com',
  authenticatedAt: 1_700_000_000_000,
};

function createFixture(profileSession: AppSession = session) {
  const profile = createUserProfile(profileSession);
  document.body.append(profile);

  const name = profile.querySelector<HTMLSpanElement>('.user-profile__name');
  const initials = profile.querySelector<HTMLSpanElement>('.user-profile__initials');
  const avatar = profile.querySelector<HTMLSpanElement>('.user-profile__avatar');

  if (!name || !initials || !avatar) {
    throw new Error('Profile elements are missing.');
  }

  return { profile, name, initials, avatar };
}

function getPhoto(profile: HTMLElement): HTMLImageElement {
  const photo = profile.querySelector<HTMLImageElement>('.user-profile__photo');

  if (!photo) {
    throw new Error('Profile photo is missing.');
  }

  return photo;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('createUserProfile', () => {
  it('shows the name and initials when no photo is available', () => {
    const { profile, name, initials, avatar } = createFixture();

    expect(name.textContent).toBe('Alex Morgan');
    expect(name.title).toBe('Alex Morgan');
    expect(initials.textContent).toBe('AM');
    expect(initials.hidden).toBe(false);
    expect(avatar.getAttribute('aria-hidden')).toBe('true');
    expect(profile.querySelector('img')).toBeFalsy();
  });

  it('uses the email prefix when the display name is empty', () => {
    const { name, initials } = createFixture({
      ...session,
      displayName: '',
    });

    expect(name.textContent).toBe('alex');
    expect(initials.textContent).toBe('A');
  });

  it('supports Unicode initials', () => {
    const { name, initials } = createFixture({
      ...session,
      displayName: 'Алексей Иванов',
    });

    expect(name.textContent).toBe('Алексей Иванов');
    expect(initials.textContent).toBe('АИ');
  });

  it('shows a generic avatar for a name without letters or digits', () => {
    const { name, initials } = createFixture({
      ...session,
      displayName: '!!!',
    });

    expect(name.textContent).toBe('!!!');
    expect(initials.textContent).toBe('?');
  });

  it('renders the display name as text instead of HTML', () => {
    const { profile, name } = createFixture({
      ...session,
      displayName: '<b>Alex</b>',
    });

    expect(name.textContent).toBe('<b>Alex</b>');
    expect(name.title).toBe('<b>Alex</b>');
    expect(name.childElementCount).toBe(0);
    expect(profile.querySelector('b')).toBeFalsy();
  });

  it('shows initials while the photo is loading', () => {
    const { profile, initials } = createFixture({
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    });
    const photo = getPhoto(profile);

    expect(photo.src).toBe('https://example.com/avatar.png');
    expect(photo.alt).toBe('');
    expect(photo.hidden).toBe(true);
    expect(initials.hidden).toBe(false);
  });

  it('shows the loaded photo and hides the initials', () => {
    const { profile, initials } = createFixture({
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    });
    const photo = getPhoto(profile);

    photo.dispatchEvent(new Event('load'));

    expect(photo.hidden).toBe(false);
    expect(initials.hidden).toBe(true);
  });

  it('keeps initials when the photo fails to load', () => {
    const { profile, name, initials } = createFixture({
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    });
    const photo = getPhoto(profile);

    photo.dispatchEvent(new Event('error'));

    expect(profile.querySelector('img')).toBeFalsy();
    expect(initials.hidden).toBe(false);
    expect(initials.textContent).toBe('AM');
    expect(name.textContent).toBe('Alex Morgan');
  });

  it('restores initials if a previously loaded photo reports an error', () => {
    const { profile, initials } = createFixture({
      ...session,
      avatarUrl: 'https://example.com/avatar.png',
    });
    const photo = getPhoto(profile);

    photo.dispatchEvent(new Event('load'));
    expect(initials.hidden).toBe(true);

    photo.dispatchEvent(new Event('error'));

    expect(profile.querySelector('img')).toBeFalsy();
    expect(initials.hidden).toBe(false);
    expect(initials.textContent).toBe('AM');
  });
});

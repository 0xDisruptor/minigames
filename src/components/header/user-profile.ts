import './user-profile.scss';

import type { AppSession } from '../../state/app-session';
import { getProfileInitials, getProfileName } from '../../utils/profile';

export function createUserProfile(session: AppSession): HTMLDivElement {
  const profileName = getProfileName(session);

  const profile = document.createElement('div');
  profile.className = 'user-profile';

  const avatar = document.createElement('span');
  avatar.className = 'user-profile__avatar';
  avatar.setAttribute('aria-hidden', 'true');

  const initials = document.createElement('span');
  initials.className = 'user-profile__initials';
  initials.textContent = getProfileInitials(profileName);

  avatar.append(initials);

  if (session.avatarUrl) {
    const photo = document.createElement('img');
    photo.className = 'user-profile__photo';
    photo.alt = '';
    photo.hidden = true;

    photo.addEventListener(
      'load',
      (): void => {
        initials.hidden = true;
        photo.hidden = false;
      },
      { once: true },
    );

    photo.addEventListener(
      'error',
      (): void => {
        photo.remove();
        initials.hidden = false;
      },
      { once: true },
    );

    photo.src = session.avatarUrl;
    avatar.append(photo);
  }

  const name = document.createElement('span');
  name.className = 'user-profile__name';
  name.textContent = profileName;
  name.title = profileName;

  profile.append(avatar, name);

  return profile;
}

import type { AppSession } from '../state/app-session';

export function getProfileName(profile: Pick<AppSession, 'displayName' | 'email'>): string {
  return profile.displayName.trim() || profile.email.split('@', 1)[0]?.trim() || 'Player';
}

export function getProfileInitials(profileName: string): string {
  return (
    profileName
      .trim()
      .split(/\s+/u, 2)
      .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

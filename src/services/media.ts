import { API_BASE_URL } from './api';

const gameImages = import.meta.glob<string>('../assets/images/*.{jpg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function resolveGameImage(path: string): string {
  if (path.startsWith('/assets/images/games/')) {
    const filename = path.slice('/assets/images/games/'.length);
    const bundledImage = gameImages[`../assets/images/${filename}`];

    if (bundledImage) {
      return bundledImage;
    }
  }

  return new URL(path, API_BASE_URL).href;
}

export const API_BASE_URL = 'https://faxb76kxra.execute-api.eu-central-1.amazonaws.com/api/';

export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const url = new URL(path, API_BASE_URL);

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

export interface FeaturedGame {
  readonly slug: string;
  readonly name: string;
  readonly cardImage: string;
  readonly rating: number;
  readonly likesCount: number;
}

function isFeaturedGame(value: unknown): value is FeaturedGame {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    typeof value.slug === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'cardImage' in value &&
    typeof value.cardImage === 'string' &&
    'rating' in value &&
    typeof value.rating === 'number' &&
    Number.isFinite(value.rating) &&
    'likesCount' in value &&
    typeof value.likesCount === 'number' &&
    Number.isFinite(value.likesCount)
  );
}

export async function getFeaturedGames(signal?: AbortSignal): Promise<readonly FeaturedGame[]> {
  const response = await getJson('games?featured=true', signal);

  if (
    typeof response !== 'object' ||
    response === null ||
    !('data' in response) ||
    !Array.isArray(response.data) ||
    !response.data.every(isFeaturedGame)
  ) {
    throw new Error('Invalid featured games response');
  }

  return response.data;
}

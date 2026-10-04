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

export interface LeaderboardPlayer {
  readonly rank: number;
  readonly playerName: string;
  readonly gamesPlayed: number;
  readonly totalScore: number;
  readonly streakDays: number;
  readonly favoriteGameSlug: string;
  readonly favoriteGameName: string;
}

function isLeaderboardPlayer(value: unknown): value is LeaderboardPlayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rank' in value &&
    typeof value.rank === 'number' &&
    Number.isFinite(value.rank) &&
    'playerName' in value &&
    typeof value.playerName === 'string' &&
    'gamesPlayed' in value &&
    typeof value.gamesPlayed === 'number' &&
    Number.isFinite(value.gamesPlayed) &&
    'totalScore' in value &&
    typeof value.totalScore === 'number' &&
    Number.isFinite(value.totalScore) &&
    'streakDays' in value &&
    typeof value.streakDays === 'number' &&
    Number.isFinite(value.streakDays) &&
    'favoriteGameSlug' in value &&
    typeof value.favoriteGameSlug === 'string' &&
    'favoriteGameName' in value &&
    typeof value.favoriteGameName === 'string'
  );
}

export async function getLeaderboardPlayers(
  signal?: AbortSignal,
): Promise<readonly LeaderboardPlayer[]> {
  const response = await getJson('leaderboard', signal);

  if (
    typeof response !== 'object' ||
    response === null ||
    !('data' in response) ||
    !Array.isArray(response.data) ||
    !response.data.every(isLeaderboardPlayer)
  ) {
    throw new Error('Invalid leaderboard response');
  }

  return response.data;
}

export interface GameSummary extends FeaturedGame {
  readonly category: string;
  readonly price: string;
  readonly shortDescription: string;
}

export interface GamesMeta {
  readonly page: number;
  readonly limit: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface GamesResponse {
  readonly data: readonly GameSummary[];
  readonly meta: GamesMeta;
}

function isGameSummary(value: unknown): value is GameSummary {
  return (
    isFeaturedGame(value) &&
    'category' in value &&
    typeof value.category === 'string' &&
    'price' in value &&
    typeof value.price === 'string' &&
    'shortDescription' in value &&
    typeof value.shortDescription === 'string'
  );
}

function isGamesMeta(value: unknown): value is GamesMeta {
  return (
    typeof value === 'object' &&
    value !== null &&
    'page' in value &&
    typeof value.page === 'number' &&
    Number.isSafeInteger(value.page) &&
    value.page >= 1 &&
    'limit' in value &&
    typeof value.limit === 'number' &&
    Number.isSafeInteger(value.limit) &&
    value.limit >= 1 &&
    'totalItems' in value &&
    typeof value.totalItems === 'number' &&
    Number.isSafeInteger(value.totalItems) &&
    value.totalItems >= 0 &&
    'totalPages' in value &&
    typeof value.totalPages === 'number' &&
    Number.isSafeInteger(value.totalPages) &&
    value.totalPages >= 0
  );
}

export async function getGames(signal?: AbortSignal): Promise<GamesResponse> {
  const response = await getJson('games?limit=6', signal);

  if (
    typeof response !== 'object' ||
    response === null ||
    !('data' in response) ||
    !Array.isArray(response.data) ||
    !response.data.every(isGameSummary) ||
    !('meta' in response) ||
    !isGamesMeta(response.meta)
  ) {
    throw new Error('Invalid games response');
  }

  return {
    data: response.data,
    meta: response.meta,
  };
}

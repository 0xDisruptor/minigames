export const API_BASE_URL = 'https://faxb76kxra.execute-api.eu-central-1.amazonaws.com/api/';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const url = new URL(path, API_BASE_URL);

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new ApiError(response.status);
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

export interface GamesQuery {
  readonly category?: string;
  readonly sort?: string;
  readonly page?: number;
}

export async function getGames(signal?: AbortSignal, query?: GamesQuery): Promise<GamesResponse> {
  const parameters = new URLSearchParams({
    limit: '6',
    category: query?.category ?? 'all',
    sort: query?.sort ?? 'rating-desc',
    page: String(query?.page ?? 1),
  });

  const response = await getJson(`games?${parameters.toString()}`, signal);

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

export interface Category {
  readonly slug: string;
  readonly label: string;
  readonly isDefault: boolean;
}

function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    typeof value.slug === 'string' &&
    'label' in value &&
    typeof value.label === 'string' &&
    'isDefault' in value &&
    typeof value.isDefault === 'boolean'
  );
}

export async function getCategories(signal?: AbortSignal): Promise<readonly Category[]> {
  const response = await getJson('categories', signal);

  if (
    typeof response !== 'object' ||
    response === null ||
    !('data' in response) ||
    !Array.isArray(response.data) ||
    !response.data.every(isCategory)
  ) {
    throw new Error('Invalid categories response');
  }

  return response.data;
}

export interface GameSpecs {
  readonly genre: string;
  readonly players: string;
  readonly duration: string;
  readonly price: string;
}

export interface GameRecord {
  readonly position: number;
  readonly playerName: string;
  readonly score: number;
  readonly achievedAt: string;
}

export interface GameDetails {
  readonly slug: string;
  readonly name: string;
  readonly heroImage: string;
  readonly rating: number;
  readonly likesCount: number;
  readonly isLikedByCurrentUser: boolean;
  readonly fullDescription: string;
  readonly specs: GameSpecs;
  readonly topRecords: readonly GameRecord[];
}

function isGameSpecs(value: unknown): value is GameSpecs {
  return (
    typeof value === 'object' &&
    value !== null &&
    'genre' in value &&
    typeof value.genre === 'string' &&
    'players' in value &&
    typeof value.players === 'string' &&
    'duration' in value &&
    typeof value.duration === 'string' &&
    'price' in value &&
    typeof value.price === 'string'
  );
}

function isGameRecord(value: unknown): value is GameRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'position' in value &&
    typeof value.position === 'number' &&
    Number.isSafeInteger(value.position) &&
    value.position >= 1 &&
    'playerName' in value &&
    typeof value.playerName === 'string' &&
    'score' in value &&
    typeof value.score === 'number' &&
    Number.isSafeInteger(value.score) &&
    value.score >= 0 &&
    'achievedAt' in value &&
    typeof value.achievedAt === 'string' &&
    Number.isFinite(Date.parse(value.achievedAt))
  );
}

function isGameDetails(value: unknown): value is GameDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slug' in value &&
    typeof value.slug === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'heroImage' in value &&
    typeof value.heroImage === 'string' &&
    'rating' in value &&
    typeof value.rating === 'number' &&
    Number.isFinite(value.rating) &&
    'likesCount' in value &&
    typeof value.likesCount === 'number' &&
    Number.isSafeInteger(value.likesCount) &&
    value.likesCount >= 0 &&
    'isLikedByCurrentUser' in value &&
    typeof value.isLikedByCurrentUser === 'boolean' &&
    'fullDescription' in value &&
    typeof value.fullDescription === 'string' &&
    'specs' in value &&
    isGameSpecs(value.specs) &&
    'topRecords' in value &&
    Array.isArray(value.topRecords) &&
    value.topRecords.every(isGameRecord)
  );
}

export async function getGameDetails(
  gameSlug: string,
  signal?: AbortSignal,
): Promise<GameDetails | undefined> {
  const response = await getJson(`games/${encodeURIComponent(gameSlug)}`, signal);

  if (typeof response !== 'object' || response === null || !('data' in response)) {
    throw new Error('Invalid game details response');
  }

  if (response.data === undefined) {
    return undefined;
  }

  if (!isGameDetails(response.data)) {
    throw new Error('Invalid game details response');
  }

  return response.data;
}

export interface GameComment {
  readonly commentId: string;
  readonly authorName: string;
  readonly text: string;
  readonly likesCount: number;
  readonly isLikedByCurrentUser: boolean;
  readonly createdAt: string;
}

export interface GameCommentsResponse {
  readonly data: readonly GameComment[];
  readonly meta: {
    readonly totalComments: number;
  };
}

function isGameComment(value: unknown): value is GameComment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'commentId' in value &&
    typeof value.commentId === 'string' &&
    'authorName' in value &&
    typeof value.authorName === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'likesCount' in value &&
    typeof value.likesCount === 'number' &&
    Number.isSafeInteger(value.likesCount) &&
    value.likesCount >= 0 &&
    'isLikedByCurrentUser' in value &&
    typeof value.isLikedByCurrentUser === 'boolean' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}

export async function getGameComments(
  gameSlug: string,
  signal?: AbortSignal,
): Promise<GameCommentsResponse> {
  const parameters = new URLSearchParams({
    limit: '3',
    sort: 'newest',
  });

  const response = await getJson(
    `games/${encodeURIComponent(gameSlug)}/comments?${parameters.toString()}`,
    signal,
  );

  if (
    typeof response !== 'object' ||
    response === null ||
    !('data' in response) ||
    !Array.isArray(response.data) ||
    !response.data.every(isGameComment) ||
    !('meta' in response) ||
    typeof response.meta !== 'object' ||
    response.meta === null ||
    !('totalComments' in response.meta) ||
    typeof response.meta.totalComments !== 'number' ||
    !Number.isSafeInteger(response.meta.totalComments) ||
    response.meta.totalComments < 0
  ) {
    throw new Error('Invalid game comments response');
  }

  return {
    data: response.data,
    meta: {
      totalComments: response.meta.totalComments,
    },
  };
}

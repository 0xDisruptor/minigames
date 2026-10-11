import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, getFeaturedGames, getLeaderboardPlayers } from './api';
import type { FeaturedGame, LeaderboardPlayer } from './api';

const fetchMock = vi.fn<typeof fetch>();

const game: FeaturedGame = {
  slug: 'chess',
  name: 'Chess',
  cardImage: 'chess.webp',
  rating: 4.8,
  likesCount: 12,
};

const player: LeaderboardPlayer = {
  rank: 1,
  playerName: 'Alex',
  gamesPlayed: 10,
  totalScore: 200,
  streakDays: 3,
  favoriteGameSlug: 'chess',
  favoriteGameName: 'Chess',
};

const parsedNull: unknown = JSON.parse('null');

const invalidFeaturedResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'non-array data', body: { data: {} } },
  { name: 'null game', body: { data: [parsedNull] } },
  { name: 'incomplete game', body: { data: [{ slug: 'chess' }] } },
  {
    name: 'invalid slug',
    body: { data: [{ ...game, slug: 1 }] },
  },
  {
    name: 'invalid name',
    body: { data: [{ ...game, name: 1 }] },
  },
  {
    name: 'invalid image',
    body: { data: [{ ...game, cardImage: 1 }] },
  },
  {
    name: 'invalid rating',
    body: { data: [{ ...game, rating: '4.8' }] },
  },
  {
    name: 'invalid likes count',
    body: { data: [{ ...game, likesCount: '12' }] },
  },
  {
    name: 'a mixture of valid and invalid games',
    body: { data: [game, { ...game, name: 1 }] },
  },
];

const invalidLeaderboardResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'non-array data', body: { data: {} } },
  { name: 'null player', body: { data: [parsedNull] } },
  { name: 'incomplete player', body: { data: [{ rank: 1 }] } },
  {
    name: 'invalid rank',
    body: { data: [{ ...player, rank: '1' }] },
  },
  {
    name: 'invalid player name',
    body: { data: [{ ...player, playerName: 1 }] },
  },
  {
    name: 'invalid games played',
    body: { data: [{ ...player, gamesPlayed: '10' }] },
  },
  {
    name: 'invalid total score',
    body: { data: [{ ...player, totalScore: '200' }] },
  },
  {
    name: 'invalid streak',
    body: { data: [{ ...player, streakDays: '3' }] },
  },
  {
    name: 'invalid favorite game slug',
    body: { data: [{ ...player, favoriteGameSlug: 1 }] },
  },
  {
    name: 'invalid favorite game name',
    body: { data: [{ ...player, favoriteGameName: 1 }] },
  },
  {
    name: 'a mixture of valid and invalid players',
    body: { data: [player, { ...player, rank: '1' }] },
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFeaturedGames', () => {
  it('requests featured games and preserves their data', async () => {
    const games: readonly FeaturedGame[] = [
      game,
      {
        ...game,
        slug: 'checkers',
        name: 'Checkers',
        rating: 4.2,
        likesCount: 7,
      },
    ];

    fetchMock.mockResolvedValue(Response.json({ data: games }));

    const controller = new AbortController();

    await expect(getFeaturedGames(controller.signal)).resolves.toEqual(games);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(new URL('games?featured=true', API_BASE_URL), {
      signal: controller.signal,
    });
  });

  it('accepts an empty featured games list', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));

    await expect(getFeaturedGames()).resolves.toEqual([]);
  });

  it.each(invalidFeaturedResponses)('rejects $name', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body));

    await expect(getFeaturedGames()).rejects.toThrow('Invalid featured games response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('getLeaderboardPlayers', () => {
  it('requests the leaderboard and preserves all player fields', async () => {
    const players: readonly LeaderboardPlayer[] = [
      player,
      {
        ...player,
        rank: 2,
        playerName: 'Taylor',
        gamesPlayed: 8,
        totalScore: 150,
        streakDays: 2,
      },
    ];

    fetchMock.mockResolvedValue(Response.json({ data: players }));

    const controller = new AbortController();

    await expect(getLeaderboardPlayers(controller.signal)).resolves.toEqual(players);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(new URL('leaderboard', API_BASE_URL), {
      signal: controller.signal,
    });
  });

  it('accepts an empty leaderboard', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));

    await expect(getLeaderboardPlayers()).resolves.toEqual([]);
  });

  it.each(invalidLeaderboardResponses)('rejects $name', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body));

    await expect(getLeaderboardPlayers()).rejects.toThrow('Invalid leaderboard response');

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('home API failures', () => {
  it.each([
    { name: 'featured games', request: getFeaturedGames },
    { name: 'leaderboard', request: getLeaderboardPlayers },
  ])('propagates an HTTP error for $name', async ({ request }) => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Unavailable' }, { status: 503 }));

    const result = request();

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 503 });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'featured games', request: getFeaturedGames },
    { name: 'leaderboard', request: getLeaderboardPlayers },
  ])('propagates a network error for $name', async ({ request }) => {
    const error = new TypeError('Connection lost');

    fetchMock.mockRejectedValue(error);

    await expect(request()).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'featured games', request: getFeaturedGames },
    { name: 'leaderboard', request: getLeaderboardPlayers },
  ])('rejects malformed JSON for $name', async ({ request }) => {
    fetchMock.mockResolvedValue(
      new Response('invalid json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(request()).rejects.toBeInstanceOf(SyntaxError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

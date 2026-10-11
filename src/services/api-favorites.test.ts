import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, getGameDetails, toggleGameFavorite } from './api';
import type { GameDetails } from './api';

const fetchMock = vi.fn<typeof fetch>();

const game: GameDetails = {
  slug: 'chess',
  name: 'Chess',
  heroImage: 'chess.webp',
  rating: 4.8,
  likesCount: 10,
  isLikedByCurrentUser: false,
  fullDescription: 'Chess description.',
  specs: {
    genre: 'Strategy',
    players: '2',
    duration: '30 minutes',
    price: 'Free',
  },
  topRecords: [],
};

const parsedNull: unknown = JSON.parse('null');

const invalidFavoriteResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'null data', body: { data: parsedNull } },
  { name: 'array data', body: { data: [] } },
  { name: 'missing favorite state', body: { data: { likesCount: 1 } } },
  {
    name: 'invalid favorite state type',
    body: { data: { isFavorited: 'true', likesCount: 1 } },
  },
  {
    name: 'missing count',
    body: { data: { isFavorited: true } },
  },
  {
    name: 'string count',
    body: { data: { isFavorited: true, likesCount: '1' } },
  },
  {
    name: 'negative count',
    body: { data: { isFavorited: true, likesCount: -1 } },
  },
  {
    name: 'fractional count',
    body: { data: { isFavorited: true, likesCount: 1.5 } },
  },
  {
    name: 'unsafe integer count',
    body: {
      data: {
        isFavorited: true,
        likesCount: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  },
];

function createJsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toggleGameFavorite', () => {
  it.each([
    { isFavorited: true, likesCount: 11 },
    { isFavorited: false, likesCount: 0 },
  ])('returns server state: isFavorited=$isFavorited, likesCount=$likesCount', async (data) => {
    fetchMock.mockResolvedValue(createJsonResponse({ data }));

    const userEmail = 'alex+games@example.com';
    const controller = new AbortController();

    const result = await toggleGameFavorite('chess', userEmail, controller.signal);

    expect(result).toEqual(data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(new URL('games/chess/favorite', API_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
      signal: controller.signal,
    });
  });

  it('encodes the game slug in the request path', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        data: { isFavorited: true, likesCount: 1 },
      }),
    );

    await toggleGameFavorite('game/name', 'alex@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/game%2Fname/favorite', API_BASE_URL),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it.each(invalidFavoriteResponses)(
    'rejects $name without repeating the request',
    async ({ body }) => {
      fetchMock.mockResolvedValue(createJsonResponse(body));

      await expect(toggleGameFavorite('chess', 'alex@example.com')).rejects.toThrow(
        'Invalid favorite response',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 403, 500])('throws ApiError for HTTP %s without retrying', async (status) => {
    fetchMock.mockResolvedValue(createJsonResponse({ message: 'Request failed' }, status));

    const request = toggleGameFavorite('chess', 'alex@example.com');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates an ambiguous network failure without retrying', async () => {
    const error = new TypeError('Failed to fetch');

    fetchMock.mockRejectedValue(error);

    await expect(toggleGameFavorite('chess', 'alex@example.com')).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed JSON without retrying', async () => {
    fetchMock.mockResolvedValue(
      new Response('invalid json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(toggleGameFavorite('chess', 'alex@example.com')).rejects.toBeInstanceOf(
      SyntaxError,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal and does not retry an aborted request', async () => {
    const controller = new AbortController();
    const error = new DOMException('Request aborted', 'AbortError');

    fetchMock.mockRejectedValue(error);

    const request = toggleGameFavorite('chess', 'alex@example.com', controller.signal);

    controller.abort();

    await expect(request).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/chess/favorite', API_BASE_URL),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});

describe('personalized game details', () => {
  it('keeps the public GET request when email is absent', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ data: game }));

    const result = await getGameDetails('chess');

    expect(result).toEqual(game);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(new URL('games/chess', API_BASE_URL), {
      signal: undefined,
    });
  });

  it('encodes email and preserves the personalized favorite state', async () => {
    const personalizedGame: GameDetails = {
      ...game,
      isLikedByCurrentUser: true,
    };

    fetchMock.mockResolvedValue(createJsonResponse({ data: personalizedGame }));

    const controller = new AbortController();

    const result = await getGameDetails('chess', controller.signal, 'alex+games@example.com');

    expect(result).toEqual(personalizedGame);
    expect(result?.isLikedByCurrentUser).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/chess?userEmail=alex%2Bgames%40example.com', API_BASE_URL),
      { signal: controller.signal },
    );
  });

  it('rejects an invalid personalized favorite state', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        data: {
          ...game,
          isLikedByCurrentUser: 'true',
        },
      }),
    );

    await expect(getGameDetails('chess', undefined, 'alex@example.com')).rejects.toThrow(
      'Invalid game details response',
    );
  });

  it('propagates a personalized GET failure without retrying', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ message: 'Unavailable' }, 500));

    const request = getGameDetails('chess', undefined, 'alex@example.com');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 500 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

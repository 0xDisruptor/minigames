import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, getCategories, getGames } from './api';
import type { Category, GameSummary, GamesMeta } from './api';

const fetchMock = vi.fn<typeof fetch>();

const game: GameSummary = {
  slug: 'chess',
  name: 'Chess',
  cardImage: 'chess.webp',
  rating: 4.8,
  likesCount: 12,
  category: 'puzzle',
  price: 'Free',
  shortDescription: 'A strategy game.',
};

const meta: GamesMeta = {
  page: 1,
  limit: 6,
  totalItems: 18,
  totalPages: 3,
};

const category: Category = {
  slug: 'puzzle',
  label: 'Puzzle',
  isDefault: false,
};

const parsedNull: unknown = JSON.parse('null');

const invalidGamesResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: { meta } },
  { name: 'non-array data', body: { data: {}, meta } },
  { name: 'missing metadata', body: { data: [game] } },
  { name: 'null metadata', body: { data: [game], meta: parsedNull } },
];

const invalidGames = [
  { name: 'invalid slug', data: { ...game, slug: 1 } },
  { name: 'invalid name', data: { ...game, name: 1 } },
  { name: 'invalid image', data: { ...game, cardImage: 1 } },
  { name: 'invalid rating', data: { ...game, rating: '4.8' } },
  { name: 'invalid likes count', data: { ...game, likesCount: '12' } },
  { name: 'invalid category', data: { ...game, category: 1 } },
  { name: 'invalid price', data: { ...game, price: 1 } },
  {
    name: 'invalid description',
    data: { ...game, shortDescription: 1 },
  },
];

const invalidMetadata = [
  { name: 'missing fields', data: {} },
  { name: 'zero page', data: { ...meta, page: 0 } },
  { name: 'fractional page', data: { ...meta, page: 1.5 } },
  {
    name: 'unsafe page',
    data: { ...meta, page: Number.MAX_SAFE_INTEGER + 1 },
  },
  { name: 'zero limit', data: { ...meta, limit: 0 } },
  { name: 'fractional limit', data: { ...meta, limit: 1.5 } },
  { name: 'negative total', data: { ...meta, totalItems: -1 } },
  {
    name: 'fractional total',
    data: { ...meta, totalItems: 1.5 },
  },
  {
    name: 'negative total pages',
    data: { ...meta, totalPages: -1 },
  },
  {
    name: 'fractional total pages',
    data: { ...meta, totalPages: 1.5 },
  },
];

const invalidCategoriesResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'non-array data', body: { data: {} } },
  {
    name: 'invalid slug',
    body: { data: [{ ...category, slug: 1 }] },
  },
  {
    name: 'invalid label',
    body: { data: [{ ...category, label: 1 }] },
  },
  {
    name: 'invalid default flag',
    body: { data: [{ ...category, isDefault: 'false' }] },
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getGames', () => {
  it('requests the default library query and preserves server metadata', async () => {
    const response = { data: [game], meta };

    fetchMock.mockResolvedValue(Response.json(response));

    const controller = new AbortController();
    const result = await getGames(controller.signal);

    expect(result).toEqual(response);
    expect(result.meta.totalItems).toBe(18);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games?limit=6&category=all&sort=rating-desc&page=1', API_BASE_URL),
      { signal: controller.signal },
    );
  });

  it('encodes filters and includes the selected sort and page', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [game], meta: { ...meta, page: 3 } }));

    await getGames(undefined, {
      category: 'cozy & puzzle',
      sort: 'rating-asc',
      page: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games?limit=6&category=cozy+%26+puzzle&sort=rating-asc&page=3', API_BASE_URL),
      { signal: undefined },
    );
  });

  it('keeps default filters when only the page is provided', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [game], meta: { ...meta, page: 2 } }));

    await getGames(undefined, { page: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games?limit=6&category=all&sort=rating-desc&page=2', API_BASE_URL),
      { signal: undefined },
    );
  });

  it('accepts an empty library response', async () => {
    const response = {
      data: [],
      meta: {
        page: 1,
        limit: 6,
        totalItems: 0,
        totalPages: 0,
      },
    };

    fetchMock.mockResolvedValue(Response.json(response));

    await expect(getGames()).resolves.toEqual(response);
  });

  it.each(invalidGamesResponses)('rejects $name', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body));

    await expect(getGames()).rejects.toThrow('Invalid games response');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(invalidGames)('rejects a game with $name', async ({ data }) => {
    fetchMock.mockResolvedValue(Response.json({ data: [data], meta }));

    await expect(getGames()).rejects.toThrow('Invalid games response');
  });

  it.each(invalidMetadata)('rejects metadata with $name', async ({ data }) => {
    fetchMock.mockResolvedValue(Response.json({ data: [game], meta: data }));

    await expect(getGames()).rejects.toThrow('Invalid games response');
  });
});

describe('getCategories', () => {
  it('requests categories and preserves their default flags', async () => {
    const categories: readonly Category[] = [
      { slug: 'all', label: 'All Games', isDefault: true },
      category,
    ];

    fetchMock.mockResolvedValue(Response.json({ data: categories }));

    const controller = new AbortController();

    await expect(getCategories(controller.signal)).resolves.toEqual(categories);

    expect(fetchMock).toHaveBeenCalledWith(new URL('categories', API_BASE_URL), {
      signal: controller.signal,
    });
  });

  it('accepts an empty categories list', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [] }));

    await expect(getCategories()).resolves.toEqual([]);
  });

  it.each(invalidCategoriesResponses)('rejects $name', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body));

    await expect(getCategories()).rejects.toThrow('Invalid categories response');
  });
});

describe('library API failures', () => {
  it.each([
    { name: 'games', request: getGames },
    { name: 'categories', request: getCategories },
  ])('propagates an HTTP failure for $name', async ({ request }) => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Unavailable' }, { status: 503 }));

    const result = request();

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 503 });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    { name: 'games', request: getGames },
    { name: 'categories', request: getCategories },
  ])('propagates a network failure for $name', async ({ request }) => {
    const error = new TypeError('Connection lost');

    fetchMock.mockRejectedValue(error);

    await expect(request()).rejects.toBe(error);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

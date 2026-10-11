import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, createGameComment, getGameComments } from './api';
import type { CreateGameCommentInput, GameComment } from './api';

const fetchMock = vi.fn<typeof fetch>();

const input: CreateGameCommentInput = {
  userEmail: 'alex+games@example.com',
  authorName: 'Alex Morgan',
  text: 'Great game!',
};

const comment: GameComment = {
  commentId: 'comment-1',
  authorName: 'Alex Morgan',
  text: 'Great game!',
  likesCount: 0,
  isLikedByCurrentUser: false,
  createdAt: '2026-10-11T20:00:00.000Z',
};

const parsedNull: unknown = JSON.parse('null');

const invalidSubmissionResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'null data', body: { data: parsedNull } },
  { name: 'array data', body: { data: [] } },
  {
    name: 'invalid comment ID',
    body: { data: { ...comment, commentId: 1 } },
  },
  {
    name: 'invalid author name',
    body: { data: { ...comment, authorName: 1 } },
  },
  {
    name: 'invalid text',
    body: { data: { ...comment, text: 1 } },
  },
  {
    name: 'invalid like state',
    body: { data: { ...comment, isLikedByCurrentUser: 'false' } },
  },
  {
    name: 'string likes count',
    body: { data: { ...comment, likesCount: '0' } },
  },
  {
    name: 'negative likes count',
    body: { data: { ...comment, likesCount: -1 } },
  },
  {
    name: 'fractional likes count',
    body: { data: { ...comment, likesCount: 1.5 } },
  },
  {
    name: 'unsafe likes count',
    body: {
      data: {
        ...comment,
        likesCount: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  },
  {
    name: 'invalid date type',
    body: { data: { ...comment, createdAt: 1 } },
  },
  {
    name: 'invalid date value',
    body: { data: { ...comment, createdAt: 'invalid date' } },
  },
];

const invalidListResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: { meta: { totalComments: 0 } } },
  {
    name: 'data is not an array',
    body: { data: {}, meta: { totalComments: 0 } },
  },
  {
    name: 'invalid comment',
    body: {
      data: [{ ...comment, text: 1 }],
      meta: { totalComments: 1 },
    },
  },
  { name: 'missing metadata', body: { data: [] } },
  { name: 'null metadata', body: { data: [], meta: parsedNull } },
  { name: 'missing total', body: { data: [], meta: {} } },
  {
    name: 'string total',
    body: { data: [], meta: { totalComments: '1' } },
  },
  {
    name: 'negative total',
    body: { data: [], meta: { totalComments: -1 } },
  },
  {
    name: 'fractional total',
    body: { data: [], meta: { totalComments: 1.5 } },
  },
  {
    name: 'unsafe total',
    body: {
      data: [],
      meta: { totalComments: Number.MAX_SAFE_INTEGER + 1 },
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

describe('createGameComment', () => {
  it('returns the created comment from a 201 response without list metadata', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ data: comment }, 201));

    const controller = new AbortController();

    const result = await createGameComment('chess', input, controller.signal);

    expect(result).toEqual(comment);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(new URL('games/chess/comments', API_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  });

  it('encodes the game slug in the POST path', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ data: comment }, 201));

    await createGameComment('game/name', input);

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/game%2Fname/comments', API_BASE_URL),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it.each(invalidSubmissionResponses)(
    'rejects $name without repeating the POST',
    async ({ body }) => {
      fetchMock.mockResolvedValue(createJsonResponse(body, 201));

      await expect(createGameComment('chess', input)).rejects.toThrow(
        'Invalid comment submission response',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 403, 422, 500])(
    'preserves HTTP %i for submission failure handling',
    async (status) => {
      fetchMock.mockResolvedValue(createJsonResponse({ message: 'Request failed' }, status));

      const request = createGameComment('chess', input);

      await expect(request).rejects.toBeInstanceOf(ApiError);
      await expect(request).rejects.toMatchObject({ status });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates an ambiguous network failure without resubmitting', async () => {
    const error = new TypeError('Failed to fetch');

    fetchMock.mockRejectedValue(error);

    await expect(createGameComment('chess', input)).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed success JSON without resubmitting', async () => {
    fetchMock.mockResolvedValue(
      new Response('invalid json', {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(createGameComment('chess', input)).rejects.toBeInstanceOf(SyntaxError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal without retrying an aborted POST', async () => {
    const controller = new AbortController();
    const error = new DOMException('Request aborted', 'AbortError');

    fetchMock.mockRejectedValue(error);

    const request = createGameComment('chess', input, controller.signal);

    controller.abort();

    await expect(request).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/chess/comments', API_BASE_URL),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});

describe('getGameComments', () => {
  it('requests three latest public comments and preserves the full count', async () => {
    const response = {
      data: [comment],
      meta: { totalComments: 42 },
    };

    fetchMock.mockResolvedValue(createJsonResponse(response));

    const result = await getGameComments('chess');

    expect(result).toEqual(response);
    expect(result.meta.totalComments).toBe(42);
    expect(result.data).toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('games/chess/comments?limit=3&sort=newest', API_BASE_URL),
      { signal: undefined },
    );
  });

  it('encodes the slug and email and preserves personal comment-like state', async () => {
    const personalizedComment: GameComment = {
      ...comment,
      isLikedByCurrentUser: true,
      likesCount: 5,
    };

    const response = {
      data: [personalizedComment],
      meta: { totalComments: 12 },
    };

    fetchMock.mockResolvedValue(createJsonResponse(response));

    const controller = new AbortController();

    const result = await getGameComments('game/name', controller.signal, 'alex+games@example.com');

    expect(result).toEqual(response);
    expect(result.data[0]?.isLikedByCurrentUser).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        'games/game%2Fname/comments?limit=3&sort=newest&userEmail=alex%2Bgames%40example.com',
        API_BASE_URL,
      ),
      { signal: controller.signal },
    );
  });

  it('accepts an empty comments list', async () => {
    const response = {
      data: [],
      meta: { totalComments: 0 },
    };

    fetchMock.mockResolvedValue(createJsonResponse(response));

    await expect(getGameComments('chess')).resolves.toEqual(response);
  });

  it.each(invalidListResponses)('rejects $name', async ({ body }) => {
    fetchMock.mockResolvedValue(createJsonResponse(body));

    await expect(getGameComments('chess')).rejects.toThrow('Invalid game comments response');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates a personalized GET failure', async () => {
    fetchMock.mockResolvedValue(createJsonResponse({ message: 'Unavailable' }, 500));

    const request = getGameComments('chess', undefined, 'alex@example.com');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 500 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

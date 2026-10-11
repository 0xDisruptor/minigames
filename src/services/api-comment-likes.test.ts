import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, toggleCommentLike } from './api';
import type { GameCommentLikeResult } from './api';

const fetchMock = vi.fn<typeof fetch>();

const likeResult: GameCommentLikeResult = {
  isLikedByCurrentUser: true,
  likesCount: 12,
};

const parsedNull: unknown = JSON.parse('null');

const invalidResponses = [
  { name: 'null response', body: parsedNull },
  { name: 'missing data', body: {} },
  { name: 'null data', body: { data: parsedNull } },
  { name: 'array data', body: { data: [] } },
  {
    name: 'missing like state',
    body: { data: { likesCount: 12 } },
  },
  {
    name: 'invalid like state',
    body: {
      data: { ...likeResult, isLikedByCurrentUser: 'true' },
    },
  },
  {
    name: 'missing likes count',
    body: { data: { isLikedByCurrentUser: true } },
  },
  {
    name: 'string likes count',
    body: { data: { ...likeResult, likesCount: '12' } },
  },
  {
    name: 'null likes count',
    body: { data: { ...likeResult, likesCount: parsedNull } },
  },
  {
    name: 'negative likes count',
    body: { data: { ...likeResult, likesCount: -1 } },
  },
  {
    name: 'fractional likes count',
    body: { data: { ...likeResult, likesCount: 1.5 } },
  },
  {
    name: 'unsafe likes count',
    body: {
      data: {
        ...likeResult,
        likesCount: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toggleCommentLike', () => {
  it.each([
    { isLikedByCurrentUser: true, likesCount: 12 },
    { isLikedByCurrentUser: false, likesCount: 4 },
    { isLikedByCurrentUser: false, likesCount: 0 },
  ])('returns server state $isLikedByCurrentUser with count $likesCount', async (result) => {
    fetchMock.mockResolvedValue(Response.json({ data: result }));

    const controller = new AbortController();

    const response = await toggleCommentLike('comment-1', 'alex@example.com', controller.signal);

    expect(response).toEqual(result);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(new URL('comments/comment-1/like', API_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail: 'alex@example.com',
      }),
      signal: controller.signal,
    });
  });

  it('encodes the comment ID in the request path', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: likeResult }));

    await toggleCommentLike('comment/id ?', 'alex+games@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('comments/comment%2Fid%20%3F/like', API_BASE_URL),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userEmail: 'alex+games@example.com',
        }),
      }),
    );
  });

  it.each(invalidResponses)('rejects $name without repeating the toggle', async ({ body }) => {
    fetchMock.mockResolvedValue(Response.json(body));

    await expect(toggleCommentLike('comment-1', 'alex@example.com')).rejects.toThrow(
      'Invalid comment like response',
    );

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([400, 401, 403, 404, 429, 500])('preserves HTTP %s without retrying', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ message: 'Request failed' }, { status }));

    const request = toggleCommentLike('comment-1', 'alex@example.com');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('propagates an unknown network outcome without retrying', async () => {
    const error = new TypeError('Connection lost');

    fetchMock.mockRejectedValue(error);

    await expect(toggleCommentLike('comment-1', 'alex@example.com')).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects malformed success JSON without repeating the toggle', async () => {
    fetchMock.mockResolvedValue(
      new Response('invalid json', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(toggleCommentLike('comment-1', 'alex@example.com')).rejects.toBeInstanceOf(
      SyntaxError,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('passes the abort signal and does not retry an aborted request', async () => {
    const controller = new AbortController();
    const error = new DOMException('Request aborted', 'AbortError');

    fetchMock.mockRejectedValue(error);

    const request = toggleCommentLike('comment-1', 'alex@example.com', controller.signal);

    controller.abort();

    await expect(request).rejects.toBe(error);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('comments/comment-1/like', API_BASE_URL),
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});

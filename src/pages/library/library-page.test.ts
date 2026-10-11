// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, GameSummary, GamesQuery, GamesResponse } from '../../services/api';
import { createLibraryPage } from './library-page';

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn<(signal?: AbortSignal) => Promise<readonly Category[]>>(),
  getGames: vi.fn<(signal?: AbortSignal, query?: GamesQuery) => Promise<GamesResponse>>(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getCategories: mocks.getCategories,
    getGames: mocks.getGames,
  };
});

vi.mock('../../components/snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const categories: readonly Category[] = [
  { slug: 'all', label: 'All Games', isDefault: true },
  { slug: 'puzzle', label: 'Puzzle', isDefault: false },
];

const game: GameSummary = {
  slug: 'chess',
  name: 'Chess',
  cardImage: 'https://example.com/chess.webp',
  rating: 4.8,
  likesCount: 1234,
  category: 'puzzle',
  price: 'Free',
  shortDescription: 'A strategy game.',
};

const mountedPages: HTMLElement[] = [];

function createResponse(
  data: readonly GameSummary[] = [game],
  page = 1,
  totalPages = 3,
): GamesResponse {
  return {
    data,
    meta: {
      page,
      limit: 6,
      totalItems: data.length === 0 ? 0 : 18,
      totalPages,
    },
  };
}

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
  } = {};

  const promise = new Promise<T>((resolve) => {
    completion.resolve = resolve;
  });

  return { promise, completion };
}

function createFixture() {
  const element = createLibraryPage();

  mountedPages.push(element);
  document.body.append(element);

  const results = element.querySelector<HTMLElement>('.library-page__results');
  const categoryState = element.querySelector<HTMLElement>('.library-page__category-state');
  const sort = element.querySelector<HTMLSelectElement>('.library-page__sort');

  if (!results || !categoryState || !sort) {
    throw new Error('Library page controls are missing.');
  }

  return { element, results, categoryState, sort };
}

function getCategoryButton(element: HTMLElement, slug: string): HTMLButtonElement {
  const button = [...element.querySelectorAll<HTMLButtonElement>('.library-page__chip')].find(
    (candidate) => candidate.dataset.category === slug,
  );

  if (!button) {
    throw new Error(`Category ${slug} button is missing.`);
  }

  return button;
}

function getPageButton(element: HTMLElement, page: number): HTMLButtonElement {
  const button = [
    ...element.querySelectorAll<HTMLButtonElement>(':scope .pagination [data-page]'),
  ].find((candidate) => candidate.dataset.page === String(page));

  if (!button) {
    throw new Error(`Page ${page} button is missing.`);
  }

  return button;
}

function getRetryButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.feedback-state__retry');

  if (!button) {
    throw new Error('Retry button is missing.');
  }

  return button;
}

async function waitForGames(results: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(results.getAttribute('aria-busy')).toBe('false');
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

  history.replaceState({}, '', '/library?category=all');

  mocks.getCategories.mockResolvedValue(categories);
  mocks.getGames.mockResolvedValue(createResponse());
});

afterEach(() => {
  for (const page of mountedPages) {
    page.dispatchEvent(new Event('page-dispose'));
  }

  mountedPages.length = 0;
  document.body.replaceChildren();

  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  history.replaceState({}, '', '/');
});

describe('createLibraryPage', () => {
  it('loads categories before games and shows loading feedback', async () => {
    const pendingCategories = createDeferred<readonly Category[]>();
    const pendingGames = createDeferred<GamesResponse>();

    mocks.getCategories.mockReturnValueOnce(pendingCategories.promise);
    mocks.getGames.mockReturnValueOnce(pendingGames.promise);

    const { element, results, categoryState } = createFixture();

    expect(categoryState.getAttribute('aria-busy')).toBe('true');
    expect(categoryState.querySelector('.feedback-skeleton')?.getAttribute('aria-label')).toBe(
      'Loading categories',
    );
    expect(results.querySelectorAll('.feedback-skeleton')).toHaveLength(6);
    expect(mocks.getGames).not.toHaveBeenCalled();

    pendingCategories.completion.resolve?.(categories);

    await vi.waitFor(() => {
      expect(mocks.getGames).toHaveBeenCalledOnce();
    });

    expect(results.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.pagination')?.getAttribute('aria-busy')).toBe('true');

    pendingGames.completion.resolve?.(createResponse());
    await waitForGames(results);

    expect(results.querySelectorAll('.game-card')).toHaveLength(1);
    expect(results.querySelector('.feedback-skeleton')).toBeNull();
  });

  it('reads URL filters and renders game data and pagination metadata', async () => {
    history.replaceState({}, '', '/library?category=puzzle&sort=name-desc&page=2');

    mocks.getGames.mockResolvedValueOnce(
      createResponse(
        [
          game,
          {
            ...game,
            slug: 'sudoku',
            name: 'Sudoku',
            price: '$2.99',
          },
        ],
        2,
        5,
      ),
    );

    const { element, results, sort } = createFixture();

    await waitForGames(results);

    expect(mocks.getGames).toHaveBeenCalledWith(expect.any(AbortSignal), {
      category: 'puzzle',
      sort: 'name-desc',
      page: 2,
    });
    expect(element.querySelector('h1')?.textContent).toBe('Game Library');
    expect(sort.value).toBe('name-desc');
    expect(getCategoryButton(element, 'puzzle').getAttribute('aria-pressed')).toBe('true');

    const cards = results.querySelectorAll<HTMLElement>('.game-card');
    const firstCard = cards[0];
    const secondCard = cards[1];

    expect(cards).toHaveLength(2);
    expect(firstCard?.querySelector('.game-card__title')?.textContent).toBe('Chess');
    expect(firstCard?.querySelector('.game-card__category')?.textContent).toBe('Puzzle');
    expect(firstCard?.querySelector('.game-card__description')?.textContent).toBe(
      'A strategy game.',
    );
    expect(firstCard?.querySelector<HTMLImageElement>('.game-card__image')?.src).toBe(
      game.cardImage,
    );
    expect(
      firstCard?.querySelector('.game-card__price')?.classList.contains('game-card__price--free'),
    ).toBe(true);
    expect(
      secondCard?.querySelector('.game-card__price')?.classList.contains('game-card__price--free'),
    ).toBe(false);

    const details = firstCard?.querySelector<HTMLButtonElement>('.game-card__details');

    expect(details?.dataset.gameId).toBe('chess');
    expect(details?.dataset.action).toBe('open-game-details');
    expect(details?.getAttribute('aria-haspopup')).toBe('dialog');

    const metrics = firstCard?.querySelectorAll('.game-card__metric');

    expect(metrics?.[0]?.getAttribute('aria-label')).toBe('Rating: 4.8 out of 5');
    expect(metrics?.[1]?.getAttribute('aria-label')).toBe('1234 likes');
    expect(metrics?.[1]?.textContent).toBe('1.2K');
    expect(element.querySelector(':scope .pagination [aria-current="page"]')?.textContent).toBe(
      '2',
    );
  });

  it('changes category, resets the page, and preserves other URL state', async () => {
    history.replaceState({}, '', '/library?category=all&sort=name-desc&page=2&game=chess#details');

    const { element, results } = createFixture();

    await waitForGames(results);

    getCategoryButton(element, 'puzzle').click();

    const parameters = new URLSearchParams(location.search);

    expect(parameters.get('category')).toBe('puzzle');
    expect(parameters.get('page')).toBe('1');
    expect(parameters.get('sort')).toBe('name-desc');
    expect(parameters.get('game')).toBe('chess');
    expect(location.hash).toBe('#details');
    expect(getCategoryButton(element, 'puzzle').getAttribute('aria-pressed')).toBe('true');
    expect(getCategoryButton(element, 'all').getAttribute('aria-pressed')).toBe('false');
  });

  it('does not navigate again when the active category is clicked', async () => {
    const { element, results } = createFixture();

    await waitForGames(results);

    const pushState = vi.spyOn(history, 'pushState');

    getCategoryButton(element, 'all').click();

    expect(pushState).not.toHaveBeenCalled();
  });

  it('changes sort order and resets pagination', async () => {
    history.replaceState({}, '', '/library?category=puzzle&sort=rating-desc&page=3');

    const { results, sort } = createFixture();

    await waitForGames(results);

    sort.value = 'name-asc';
    sort.dispatchEvent(new Event('change', { bubbles: true }));

    const parameters = new URLSearchParams(location.search);

    expect(parameters.get('sort')).toBe('name-asc');
    expect(parameters.get('page')).toBe('1');
    expect(parameters.get('category')).toBe('puzzle');
  });

  it('writes a pagination selection to the URL', async () => {
    const { element, results } = createFixture();

    await waitForGames(results);

    getPageButton(element, 2).click();

    const parameters = new URLSearchParams(location.search);

    expect(parameters.get('page')).toBe('2');
    expect(parameters.get('category')).toBe('all');
  });

  it('shows an empty result and resets visible pagination to page one', async () => {
    history.replaceState({}, '', '/library?category=all&page=3');
    mocks.getGames.mockResolvedValueOnce(createResponse([], 3, 0));

    const { element, results } = createFixture();

    await waitForGames(results);

    expect(results.querySelector('.feedback-state--empty')?.textContent).toBe('Data Not Found');
    expect(results.querySelector('.game-card')).toBeNull();
    expect(element.querySelector(':scope .pagination [aria-current="page"]')?.textContent).toBe(
      '1',
    );
  });

  it('loads games even when no categories are available', async () => {
    mocks.getCategories.mockResolvedValueOnce([]);

    const { categoryState, results } = createFixture();

    await waitForGames(results);

    expect(categoryState.querySelector('.feedback-state--empty')?.textContent).toBe(
      'No categories available.',
    );
    expect(results.querySelectorAll('.game-card')).toHaveLength(1);
  });

  it('recovers from a games request failure through Retry', async () => {
    mocks.getGames
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce(createResponse());

    const { results } = createFixture();

    await waitForGames(results);

    expect(results.querySelector('.feedback-state--error')?.textContent).toContain(
      'Could not load games.',
    );
    expect(mocks.getGames).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Failed to load library games.', 'error');

    getRetryButton(results).click();
    await waitForGames(results);

    expect(results.querySelectorAll('.game-card')).toHaveLength(1);
    expect(mocks.getGames).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Library games loaded successfully.',
      'success',
    );
  });

  it('loads games despite a categories error and recovers categories on Retry', async () => {
    mocks.getCategories
      .mockRejectedValueOnce(new TypeError('Categories failed'))
      .mockResolvedValueOnce(categories);

    const { element, categoryState, results } = createFixture();

    await waitForGames(results);

    expect(categoryState.querySelector('.feedback-state--error')).toBeTruthy();
    expect(results.querySelectorAll('.game-card')).toHaveLength(1);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Failed to load categories.', 'error');

    mocks.getGames.mockResolvedValueOnce(createResponse([{ ...game, name: 'Reloaded Chess' }]));

    getRetryButton(categoryState).click();

    await vi.waitFor(() => {
      expect(results.querySelector('.game-card__title')?.textContent).toBe('Reloaded Chess');
    });

    expect(getCategoryButton(element, 'all')).toBeTruthy();
    expect(mocks.getCategories).toHaveBeenCalledTimes(2);
    expect(mocks.getGames).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Categories loaded successfully.', 'success');
  });

  it('replaces the URL with the backend default category before loading games', async () => {
    history.replaceState({}, '', '/library?game=chess#details');

    mocks.getCategories.mockResolvedValueOnce([
      { slug: 'puzzle', label: 'Puzzle', isDefault: true },
    ]);

    const replaceState = vi.spyOn(history, 'replaceState');

    createFixture();

    await vi.waitFor(() => {
      expect(new URLSearchParams(location.search).get('category')).toBe('puzzle');
    });

    expect(replaceState).toHaveBeenCalledOnce();
    expect(new URLSearchParams(location.search).get('game')).toBe('chess');
    expect(location.hash).toBe('#details');
    expect(mocks.getGames).not.toHaveBeenCalled();
  });

  it('cancels category loading and does not start games after disposal', async () => {
    const pending = createDeferred<readonly Category[]>();

    mocks.getCategories.mockReturnValueOnce(pending.promise);

    const { element } = createFixture();
    const signal = mocks.getCategories.mock.calls[0]?.[0];

    element.dispatchEvent(new Event('page-dispose'));

    expect(signal?.aborted).toBe(true);

    pending.completion.resolve?.(categories);
    await pending.promise;

    expect(mocks.getGames).not.toHaveBeenCalled();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('cancels game loading and ignores its late response after disposal', async () => {
    const pending = createDeferred<GamesResponse>();

    mocks.getGames.mockReturnValueOnce(pending.promise);

    const { element, results } = createFixture();

    await vi.waitFor(() => {
      expect(mocks.getGames).toHaveBeenCalledOnce();
    });

    const signal = mocks.getGames.mock.calls[0]?.[0];

    element.dispatchEvent(new Event('page-dispose'));

    expect(signal?.aborted).toBe(true);

    pending.completion.resolve?.(createResponse());
    await pending.promise;

    expect(results.querySelector('.game-card')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

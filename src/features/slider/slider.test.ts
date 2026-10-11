// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeaturedGame } from '../../services/api';
import { createSlider } from './slider';

const mocks = vi.hoisted(() => ({
  getFeaturedGames: vi.fn<(signal?: AbortSignal) => Promise<readonly FeaturedGame[]>>(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getFeaturedGames: mocks.getFeaturedGames,
  };
});

vi.mock('../../components/snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const game: FeaturedGame = {
  slug: 'game-0',
  name: 'Game 1',
  cardImage: 'https://example.com/game-0.webp',
  rating: 4.8,
  likesCount: 1234,
};

const games: readonly FeaturedGame[] = Array.from({ length: 7 }, (_unused, index) => ({
  ...game,
  slug: `game-${index}`,
  name: `Game ${index + 1}`,
  cardImage: `https://example.com/game-${index}.webp`,
}));

const mountedSliders: ReturnType<typeof createSlider>[] = [];

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
    reject?: (reason: unknown) => void;
  } = {};

  const promise = new Promise<T>((resolve, reject) => {
    completion.resolve = resolve;
    completion.reject = reject;
  });

  return { promise, completion };
}

function createFixture() {
  const slider = createSlider();

  mountedSliders.push(slider);
  document.body.append(slider.element);

  const content = slider.element.querySelector<HTMLElement>('.slider__content');
  const previous = slider.element.querySelector<HTMLButtonElement>('.slider__arrow--previous');
  const next = slider.element.querySelector<HTMLButtonElement>('.slider__arrow--next');

  if (!content || !previous || !next) {
    throw new Error('Slider controls are missing.');
  }

  return {
    slider,
    element: slider.element,
    content,
    previous,
    next,
  };
}

function getActiveIndex(element: HTMLElement): string | undefined {
  return element.querySelector<HTMLLIElement>('.slider__item--active')?.dataset.sliderIndex;
}

function getItem(element: HTMLElement, index: number): HTMLLIElement {
  const item = [...element.querySelectorAll<HTMLLIElement>('.slider__item')].find(
    (candidate) => candidate.dataset.sliderIndex === String(index),
  );

  if (!item) {
    throw new Error(`Slider item ${index} is missing.`);
  }

  return item;
}

function getRetryButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.feedback-state__retry');

  if (!button) {
    throw new Error('Slider retry button is missing.');
  }

  return button;
}

async function settleRequest(content: HTMLElement): Promise<void> {
  await Promise.resolve();
  expect(content.getAttribute('aria-busy')).toBe('false');
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout'],
  });

  mocks.getFeaturedGames.mockResolvedValue(games);
});

afterEach(() => {
  for (const slider of mountedSliders) {
    slider.destroy();
  }

  mountedSliders.length = 0;

  vi.clearAllTimers();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('createSlider', () => {
  it('shows loading feedback and disables arrows while fetching', async () => {
    const pending = createDeferred<readonly FeaturedGame[]>();

    mocks.getFeaturedGames.mockReturnValueOnce(pending.promise);

    const { content, previous, next } = createFixture();

    expect(content.getAttribute('aria-busy')).toBe('true');
    expect(content.querySelector('.feedback-skeleton')?.getAttribute('aria-label')).toBe(
      'Loading featured games',
    );
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(mocks.getFeaturedGames).toHaveBeenCalledWith(expect.any(AbortSignal));

    previous.dispatchEvent(new MouseEvent('click'));
    next.dispatchEvent(new MouseEvent('click'));

    pending.completion.resolve?.(games);
    await settleRequest(content);

    expect(content.querySelectorAll('.slider__item')).toHaveLength(7);
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

  it('renders game data, detail triggers, and accessible metrics', async () => {
    const { element, content } = createFixture();

    await settleRequest(content);

    const firstItem = getItem(element, 0);
    const card = firstItem.querySelector<HTMLButtonElement>('.slider__card');
    const image = firstItem.querySelector<HTMLImageElement>('.slider__image');
    const metrics = firstItem.querySelectorAll('.slider__metric');

    expect(element.querySelector('h2')?.textContent).toBe('New Games');
    expect(firstItem.dataset.gameId).toBe('game-0');
    expect(card?.dataset.action).toBe('open-game-details');
    expect(card?.dataset.gameId).toBe('game-0');
    expect(card?.getAttribute('aria-label')).toBe('Open details for Game 1');
    expect(image?.src).toBe(game.cardImage);
    expect(image?.alt).toBe('Game 1');
    expect(firstItem.querySelector('.slider__name')?.textContent).toBe('Game 1');

    expect(metrics[0]?.getAttribute('aria-label')).toBe('Rating: 4.8 out of 5');
    expect(metrics[1]?.getAttribute('aria-label')).toBe('1234 likes');
    expect(metrics[1]?.textContent).toBe('1.2K');
    expect(getActiveIndex(element)).toBe('0');
  });

  it('keeps hidden cards out of the keyboard tab order', async () => {
    const { element, content } = createFixture();

    await settleRequest(content);

    expect(getItem(element, 6).classList.contains('slider__item--previous')).toBe(true);
    expect(getItem(element, 5).classList.contains('slider__item--previous-2')).toBe(true);
    expect(getItem(element, 1).classList.contains('slider__item--next')).toBe(true);
    expect(getItem(element, 2).classList.contains('slider__item--next-2')).toBe(true);

    const hiddenItem = getItem(element, 3);

    expect(hiddenItem.getAttribute('aria-hidden')).toBe('true');
    expect(hiddenItem.querySelector<HTMLButtonElement>('.slider__card')?.tabIndex).toBe(-1);
    expect(getItem(element, 0).querySelector<HTMLButtonElement>('.slider__card')?.tabIndex).toBe(0);
  });

  it('wraps around when navigating in either direction', async () => {
    const { element, content, previous, next } = createFixture();

    await settleRequest(content);

    previous.click();
    expect(getActiveIndex(element)).toBe('6');

    next.click();
    expect(getActiveIndex(element)).toBe('0');

    next.click();
    expect(getActiveIndex(element)).toBe('1');

    expect(mocks.getFeaturedGames).toHaveBeenCalledOnce();
  });

  it('advances automatically every four seconds', async () => {
    const { element, content } = createFixture();

    await settleRequest(content);

    await vi.advanceTimersByTimeAsync(3999);
    expect(getActiveIndex(element)).toBe('0');

    await vi.advanceTimersByTimeAsync(1);
    expect(getActiveIndex(element)).toBe('1');

    await vi.advanceTimersByTimeAsync(4000);
    expect(getActiveIndex(element)).toBe('2');
    expect(mocks.getFeaturedGames).toHaveBeenCalledOnce();
  });

  it('starts a new autoplay interval after manual navigation', async () => {
    const { element, content, next } = createFixture();

    await settleRequest(content);
    await vi.advanceTimersByTimeAsync(3000);

    next.click();

    expect(getActiveIndex(element)).toBe('1');

    await vi.advanceTimersByTimeAsync(3999);
    expect(getActiveIndex(element)).toBe('1');

    await vi.advanceTimersByTimeAsync(1);
    expect(getActiveIndex(element)).toBe('2');
  });

  it('disables navigation and autoplay for a single game', async () => {
    mocks.getFeaturedGames.mockResolvedValueOnce([game]);

    const { element, content, previous, next } = createFixture();

    await settleRequest(content);

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    previous.dispatchEvent(new MouseEvent('click'));
    next.dispatchEvent(new MouseEvent('click'));

    expect(getActiveIndex(element)).toBe('0');
  });

  it('shows an empty state when no featured games are available', async () => {
    mocks.getFeaturedGames.mockResolvedValueOnce([]);

    const { content, previous, next } = createFixture();

    await settleRequest(content);

    expect(content.querySelector('.feedback-state--empty')?.textContent).toBe(
      'No featured games available.',
    );
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers from a failed request through Retry', async () => {
    mocks.getFeaturedGames
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce(games);

    const { element, content } = createFixture();

    await settleRequest(content);

    expect(content.querySelector('.feedback-state--error')).toBeTruthy();
    expect(mocks.getFeaturedGames).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Failed to load featured games.', 'error');

    getRetryButton(element).click();
    await settleRequest(content);

    expect(getActiveIndex(element)).toBe('0');
    expect(mocks.getFeaturedGames).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith(
      'Featured games loaded successfully.',
      'success',
    );
  });

  it('stops autoplay when the slider is destroyed', async () => {
    const { slider, element, content } = createFixture();

    await settleRequest(content);

    expect(vi.getTimerCount()).toBe(1);

    slider.destroy();

    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(12_000);

    expect(getActiveIndex(element)).toBe('0');
  });

  it('aborts a pending request and ignores its late success', async () => {
    const pending = createDeferred<readonly FeaturedGame[]>();

    mocks.getFeaturedGames.mockReturnValueOnce(pending.promise);

    const { slider, content } = createFixture();
    const signal = mocks.getFeaturedGames.mock.calls[0]?.[0];

    slider.destroy();

    expect(signal?.aborted).toBe(true);

    pending.completion.resolve?.(games);
    await pending.promise;

    expect(content.querySelector('.slider__track')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a late failure after destruction', async () => {
    const pending = createDeferred<readonly FeaturedGame[]>();

    mocks.getFeaturedGames.mockReturnValueOnce(pending.promise);

    const { slider, content } = createFixture();

    slider.destroy();
    pending.completion.reject?.(new TypeError('Connection lost'));

    await expect(pending.promise).rejects.toThrow('Connection lost');

    expect(content.querySelector('.feedback-state--error')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });
});

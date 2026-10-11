// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPagination } from './pagination';
import type { PaginationController } from './pagination';

const mountedPaginations: PaginationController[] = [];

function createFixture(isMobile = false) {
  const events = new EventTarget();

  const mediaQuery = {
    matches: isMobile,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject): void => {
      events.addEventListener(type, listener);
    }),
    removeEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject): void => {
        events.removeEventListener(type, listener);
      },
    ),
  };

  const matchMediaMock = vi.fn<(query: string) => typeof mediaQuery>(() => mediaQuery);

  vi.stubGlobal('matchMedia', matchMediaMock);

  const onPageChange = vi.fn<(page: number) => void>();
  const pagination = createPagination(onPageChange);

  mountedPaginations.push(pagination);
  document.body.append(pagination.element);

  const previous = pagination.element.querySelector<HTMLButtonElement>(
    ':scope [aria-label="Previous page"]',
  );
  const next = pagination.element.querySelector<HTMLButtonElement>(
    ':scope [aria-label="Next page"]',
  );

  if (!previous || !next) {
    throw new Error('Pagination arrows are missing.');
  }

  return {
    pagination,
    previous,
    next,
    onPageChange,
    mediaQuery,
    events,
    matchMediaMock,
  };
}

function getVisiblePages(element: HTMLElement): readonly number[] {
  return Array.from(element.querySelectorAll<HTMLButtonElement>(':scope [data-page]'), (button) =>
    Number(button.dataset.page),
  );
}

function getCurrentPage(element: HTMLElement): string | undefined {
  return element.querySelector(':scope [aria-current="page"]')?.textContent;
}

function getPageButton(element: HTMLElement, page: number): HTMLButtonElement {
  const button = [...element.querySelectorAll<HTMLButtonElement>(':scope [data-page]')].find(
    (candidate) => candidate.dataset.page === String(page),
  );

  if (!button) {
    throw new Error(`Page ${page} button is missing.`);
  }

  return button;
}

afterEach(() => {
  for (const pagination of mountedPaginations) {
    pagination.destroy();
  }

  mountedPaginations.length = 0;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('createPagination', () => {
  it('starts on a single page with disabled arrows', () => {
    const { pagination, previous, next, onPageChange, matchMediaMock } = createFixture();

    expect(pagination.element.getAttribute('aria-label')).toBe('Library pagination');
    expect(pagination.element.getAttribute('aria-busy')).toBe('false');
    expect(getVisiblePages(pagination.element)).toEqual([1]);
    expect(getCurrentPage(pagination.element)).toBe('1');
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 600px)');
  });

  it.each([
    { page: 1, expected: [1, 2, 3, 4] },
    { page: 5, expected: [4, 5, 6, 7] },
    { page: 10, expected: [7, 8, 9, 10] },
  ])('shows the desktop page window at page $page', ({ page, expected }) => {
    const { pagination } = createFixture();

    pagination.update(page, 10);

    expect(getVisiblePages(pagination.element)).toEqual(expected);
    expect(getCurrentPage(pagination.element)).toBe(String(page));
  });

  it.each([
    { page: 1, expected: [1, 2, 3] },
    { page: 5, expected: [4, 5, 6] },
    { page: 10, expected: [8, 9, 10] },
  ])('shows the mobile page window at page $page', ({ page, expected }) => {
    const { pagination } = createFixture(true);

    pagination.update(page, 10);

    expect(getVisiblePages(pagination.element)).toEqual(expected);
    expect(getCurrentPage(pagination.element)).toBe(String(page));
  });

  it('shows only available pages when their number is below the window limit', () => {
    const { pagination } = createFixture();

    pagination.update(2, 2);

    expect(getVisiblePages(pagination.element)).toEqual([1, 2]);
    expect(getCurrentPage(pagination.element)).toBe('2');
  });

  it('requests a selected page without changing the current page itself', () => {
    const { pagination, onPageChange } = createFixture();

    pagination.update(1, 5);
    getPageButton(pagination.element, 3).click();

    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(getCurrentPage(pagination.element)).toBe('1');

    pagination.update(3, 5);

    expect(getCurrentPage(pagination.element)).toBe('3');
    expect(onPageChange).toHaveBeenCalledOnce();
  });

  it('requests previous and next pages relative to the current page', () => {
    const { pagination, previous, next, onPageChange } = createFixture();

    pagination.update(2, 5);

    previous.click();
    next.click();

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
    expect(getCurrentPage(pagination.element)).toBe('2');
  });

  it('does not request the current page again', () => {
    const { pagination, onPageChange } = createFixture();

    pagination.update(2, 5);
    getPageButton(pagination.element, 2).click();

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('blocks movement before the first and after the last page', () => {
    const { pagination, previous, next, onPageChange } = createFixture();

    pagination.update(1, 5);

    expect(previous.disabled).toBe(true);

    previous.dispatchEvent(new MouseEvent('click'));

    pagination.update(5, 5);

    expect(next.disabled).toBe(true);

    next.dispatchEvent(new MouseEvent('click'));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('locks all controls during loading and restores them afterwards', () => {
    const { pagination, previous, next, onPageChange } = createFixture();

    pagination.update(2, 5);

    const oldPageButton = getPageButton(pagination.element, 3);

    pagination.setLoading(true);

    expect(pagination.element.getAttribute('aria-busy')).toBe('true');

    for (const button of pagination.element.querySelectorAll<HTMLButtonElement>('button')) {
      expect(button.disabled).toBe(true);
    }

    previous.dispatchEvent(new MouseEvent('click'));
    next.dispatchEvent(new MouseEvent('click'));
    oldPageButton.dispatchEvent(new MouseEvent('click'));

    expect(onPageChange).not.toHaveBeenCalled();

    pagination.setLoading(false);

    expect(pagination.element.getAttribute('aria-busy')).toBe('false');
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    getPageButton(pagination.element, 3).click();

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it.each([
    { page: -2, pages: 5, expectedPage: 1 },
    { page: 99, pages: 5, expectedPage: 5 },
    { page: 1, pages: 0, expectedPage: 1 },
    { page: 1, pages: -10, expectedPage: 1 },
  ])('clamps page $page for a total of $pages pages', ({ page, pages, expectedPage }) => {
    const { pagination } = createFixture();

    pagination.update(page, pages);

    expect(getCurrentPage(pagination.element)).toBe(String(expectedPage));
  });

  it('clamps the current page when the total page count decreases', () => {
    const { pagination, previous, next } = createFixture();

    pagination.update(5, 10);
    pagination.update(5, 2);

    expect(getVisiblePages(pagination.element)).toEqual([1, 2]);
    expect(getCurrentPage(pagination.element)).toBe('2');
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('updates its visible window when the viewport changes', () => {
    const { pagination, mediaQuery, events, onPageChange } = createFixture();

    pagination.update(5, 10);

    expect(getVisiblePages(pagination.element)).toEqual([4, 5, 6, 7]);

    mediaQuery.matches = true;
    events.dispatchEvent(new Event('change'));

    expect(getVisiblePages(pagination.element)).toEqual([4, 5, 6]);
    expect(getCurrentPage(pagination.element)).toBe('5');

    mediaQuery.matches = false;
    events.dispatchEvent(new Event('change'));

    expect(getVisiblePages(pagination.element)).toEqual([4, 5, 6, 7]);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('removes its viewport listener on destruction', () => {
    const { pagination, mediaQuery, events } = createFixture();

    pagination.update(5, 10);
    pagination.destroy();

    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    mediaQuery.matches = true;
    events.dispatchEvent(new Event('change'));

    expect(getVisiblePages(pagination.element)).toEqual([4, 5, 6, 7]);
  });
});

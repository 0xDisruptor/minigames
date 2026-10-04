export const NAVIGATION_EVENT = 'app-navigate';

const sortOrders = ['rating-desc', 'rating-asc', 'name-asc', 'name-desc'] as const;

export type SortOrder = (typeof sortOrders)[number];

export interface LibraryUrlState {
  readonly category: string;
  readonly sort: SortOrder;
  readonly page: number;
}

export function getPageUrl(path: string): string {
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

export function getRoutePath(): string {
  const pathname = location.pathname;
  const basePath = import.meta.env.BASE_URL;
  const baseWithoutSlash = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  let route = pathname;

  if (pathname === baseWithoutSlash) {
    route = '/';
  } else if (pathname.startsWith(basePath)) {
    route = `/${pathname.slice(basePath.length)}`;
  }

  return route.length > 1 && route.endsWith('/') ? route.slice(0, -1) : route;
}

export function readLibraryUrlState(): LibraryUrlState {
  const parameters = new URLSearchParams(location.search);
  const requestedPage = Number(parameters.get('page') ?? '1');
  const requestedSort = parameters.get('sort');

  return {
    category: parameters.get('category') || 'all',
    sort: sortOrders.find((value) => value === requestedSort) ?? 'rating-desc',
    page: Number.isSafeInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1,
  };
}

export function navigate(href: string | URL, isReplace = false): void {
  const url = new URL(href, location.href);

  if (url.origin !== location.origin || url.href === location.href) {
    return;
  }

  if (isReplace) {
    history.replaceState({}, '', url);
  } else {
    history.pushState({}, '', url);
  }

  dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function updateUrlQuery(
  changes: Readonly<Record<string, string | undefined>>,
  isReplace = false,
): void {
  const url = new URL(location.href);

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }

  navigate(url, isReplace);
}

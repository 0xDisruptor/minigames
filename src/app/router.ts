import { createHomePage } from '../pages/home/home-page';
import { createLibraryPage } from '../pages/library/library-page';
import type { createAuthDialog } from '../components/dialogs/auth-dialog';
import type { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';
import { NAVIGATION_EVENT, getRoutePath, navigate, readLibraryUrlState } from './navigation';
import { createNotFoundPage } from '../pages/not-found/not-found-page';

type Page = 'home' | 'library' | 'not-found';

const pageTitles: Readonly<Record<Page, string>> = {
  home: 'MiniGames',
  library: 'Library | MiniGames',
  'not-found': '404 | MiniGames',
};

interface RouterDialogs {
  readonly auth: ReturnType<typeof createAuthDialog>;
  readonly game: ReturnType<typeof createGameDetailsDialog>;
  readonly takeTrigger: () => HTMLElement | undefined;
}

function getCurrentPage(): Page {
  const path = getRoutePath();

  if (path === '/library') {
    return 'library';
  }

  return path === '/' || path === '/home' ? 'home' : 'not-found';
}

function createPage(page: Page): HTMLElement {
  if (page === 'home') {
    return createHomePage();
  }

  return page === 'library' ? createLibraryPage() : createNotFoundPage();
}

function updateNavigation(root: HTMLElement, page: Page): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('[data-nav-page]');

  for (const link of links) {
    const isActive = link.dataset.navPage === page;
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  }
}

export function initRouter(root: HTMLElement, outlet: HTMLElement, dialogs: RouterDialogs): void {
  let renderedPage: Page | undefined;
  let renderedKey: string | undefined;

  function renderPage(): void {
    const page = getCurrentPage();

    const key = page === 'library' ? `library:${JSON.stringify(readLibraryUrlState())}` : page;

    if (renderedKey === key) {
      return;
    }

    const shouldScroll = renderedPage !== page;

    dialogs.auth.close();
    dialogs.game.close();

    outlet.firstElementChild?.dispatchEvent(new Event('page-dispose'));

    const content = createPage(page);

    outlet.replaceChildren(content);
    updateNavigation(root, page);

    renderedPage = page;
    renderedKey = key;

    document.title = pageTitles[page];

    if (shouldScroll) {
      scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function renderDialogs(): void {
    const parameters = new URLSearchParams(location.search);
    const authMode = parameters.get('auth');
    const gameSlug = parameters.get('game');
    const trigger = dialogs.takeTrigger();
    if (getCurrentPage() === 'not-found') {
      dialogs.auth.close();
      dialogs.game.close();
      return;
    }

    if (authMode === 'login' || authMode === 'register') {
      dialogs.game.close();
      dialogs.auth.open(authMode, trigger);
      return;
    }

    dialogs.auth.close();

    if (gameSlug) {
      dialogs.game.openBySlug(gameSlug, trigger);
    } else {
      dialogs.game.close();
    }
  }

  function synchronize(): void {
    renderPage();
    renderDialogs();
  }

  root.addEventListener('click', (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      !(event.target instanceof Element)
    ) {
      return;
    }

    const link = event.target.closest<HTMLAnchorElement>('a[href]');

    if (
      !link ||
      link.hasAttribute('download') ||
      (link.target !== '' && link.target !== '_self') ||
      link.getAttribute('href')?.startsWith('#')
    ) {
      return;
    }

    const url = new URL(link.href);

    if (url.origin !== location.origin || !url.pathname.startsWith(import.meta.env.BASE_URL)) {
      return;
    }

    event.preventDefault();
    navigate(url);
  });

  addEventListener('popstate', synchronize);
  addEventListener(NAVIGATION_EVENT, synchronize);

  synchronize();
}

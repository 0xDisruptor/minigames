import { createHomePage } from '../pages/home/home-page';
import { createLibraryPage } from '../pages/library/library-page';

type Page = 'home' | 'library';

function getCurrentPage(): Page {
  return location.hash === '#/library' ? 'library' : 'home';
}

function updateNavigation(root: HTMLElement, page: Page): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('[data-nav-page]');

  for (const link of links) {
    const isActive = link.dataset.navPage === page;

    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  }
}

export function initRouter(root: HTMLElement, outlet: HTMLElement): void {
  function renderPage(): void {
    const page = getCurrentPage();
    const content = page === 'library' ? createLibraryPage() : createHomePage();

    outlet.replaceChildren(content);
    updateNavigation(root, page);

    document.title = page === 'library' ? 'Library | MiniGames' : 'MiniGames';

    scrollTo({ top: 0, behavior: 'instant' });
  }

  addEventListener('hashchange', renderPage);

  renderPage();
}

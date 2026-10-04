import './library-page.scss';
import { createGameCard } from '../../components/game-card/game-card';
import type { LibraryGame } from './library-data';
import { getCategories, getGames } from '../../services/api';
import type { Category } from '../../services/api';
import { resolveGameImage } from '../../services/media';
import {
  createEmptyState,
  createErrorState,
  createSkeleton,
} from '../../components/feedback/feedback';
import { showSnackbar } from '../../components/snackbar/snackbar';
import { createPagination } from '../../components/pagination/pagination';

function createPageHeading(): HTMLElement {
  const header = document.createElement('header');
  header.className = 'library-page__heading';

  const title = document.createElement('h1');
  title.className = 'library-page__title';
  title.textContent = 'Game Library';

  const description = document.createElement('p');
  description.className = 'library-page__description';
  description.textContent = 'Browse our collection of casual mini-games';

  header.append(title, description);

  return header;
}

function enableMouseDrag(container: HTMLElement): void {
  const dragThreshold = 5;

  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startScroll = 0;

  container.addEventListener('pointerdown', (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    isDragging = true;
    hasMoved = false;
    startX = event.clientX;
    startScroll = container.scrollLeft;
  });

  container.addEventListener('pointermove', (event: PointerEvent): void => {
    if (!isDragging) {
      return;
    }

    const distance = event.clientX - startX;

    if (!hasMoved && Math.abs(distance) < dragThreshold) {
      return;
    }

    hasMoved = true;
    container.setPointerCapture(event.pointerId);
    container.scrollLeft = startScroll - distance;
  });

  function stopDragging(): void {
    isDragging = false;
  }

  container.addEventListener('pointerup', stopDragging);
  container.addEventListener('pointercancel', stopDragging);
  container.addEventListener('lostpointercapture', stopDragging);

  container.addEventListener('pointerleave', (): void => {
    if (!hasMoved) {
      stopDragging();
    }
  });

  container.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!hasMoved || event.detail === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      hasMoved = false;
    },
    { capture: true },
  );
}

function createCategoryFilters(
  categories: readonly Category[],
  activeCategory: string,
  onChange: (category: string) => void,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'library-page__categories';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Game categories');

  const buttons: HTMLButtonElement[] = [];

  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-page__chip';
    button.textContent = category.label;
    button.dataset.category = category.slug;
    button.setAttribute('aria-pressed', String(category.slug === activeCategory));

    button.addEventListener('click', (): void => {
      if (button.getAttribute('aria-pressed') === 'true') {
        return;
      }

      for (const item of buttons) {
        item.setAttribute('aria-pressed', String(item === button));
      }

      onChange(category.slug);
    });

    buttons.push(button);
    group.append(button);
  }

  enableMouseDrag(group);

  return group;
}

function createSortControl(): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'library-page__sort';
  select.name = 'sort';
  select.setAttribute('aria-label', 'Sort games by');

  const options = [
    { value: 'rating-desc', label: 'Rating ↓' },
    { value: 'rating-asc', label: 'Rating ↑' },
    { value: 'name-asc', label: 'Name A–Z' },
    { value: 'name-desc', label: 'Name Z–A' },
  ];

  for (const { value, label } of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `Sort by: ${label}`;

    select.append(option);
  }

  select.value = 'rating-desc';

  return select;
}

function createGamesList(games: readonly LibraryGame[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'library-page__games';
  list.setAttribute('aria-label', 'Games');

  for (const game of games) {
    const item = document.createElement('li');
    item.className = 'library-page__game';
    item.dataset.gameId = game.id;
    item.append(createGameCard(game));

    list.append(item);
  }

  return list;
}

function createLoadingGames(): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'library-page__games';
  list.setAttribute('aria-label', 'Loading games');

  for (let index = 0; index < 6; index += 1) {
    const item = document.createElement('li');
    item.className = 'library-page__game';
    item.append(createSkeleton(`Loading game ${index + 1}`));

    list.append(item);
  }

  return list;
}

export function createLibraryPage(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'library-page';

  const controls = document.createElement('div');
  controls.className = 'library-page__controls';

  const categoryState = document.createElement('div');
  categoryState.className = 'library-page__category-state';

  const sortControl = createSortControl();
  controls.append(categoryState, sortControl);

  const results = document.createElement('div');
  results.className = 'library-page__results';
  results.setAttribute('aria-busy', 'true');
  results.replaceChildren(createLoadingGames());

  let currentPage = 1;

  const pagination = createPagination((page): void => {
    currentPage = page;
    void loadGames();
  });

  main.append(createPageHeading(), controls, results, pagination.element);

  let activeCategory = 'all';
  let gamesRequest: AbortController | undefined;
  let categoriesRequest: AbortController | undefined;
  let isDestroyed = false;
  let hasGamesFailed = false;
  let hasCategoriesFailed = false;

  async function loadGames(): Promise<void> {
    if (isDestroyed) {
      return;
    }
    pagination.setLoading(true);
    gamesRequest?.abort();

    results.setAttribute('aria-busy', 'true');
    results.replaceChildren(createLoadingGames());

    const controller = new AbortController();
    gamesRequest = controller;

    try {
      const response = await getGames(controller.signal, {
        category: activeCategory,
        sort: sortControl.value,
        page: currentPage,
      });

      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      currentPage = response.data.length === 0 ? 1 : response.meta.page;

      pagination.update(currentPage, response.data.length === 0 ? 1 : response.meta.totalPages);

      const games: readonly LibraryGame[] = response.data.map((game) => ({
        id: game.slug,
        title: game.name,
        category: game.category.charAt(0).toUpperCase() + game.category.slice(1),
        description: game.shortDescription,
        image: resolveGameImage(game.cardImage),
        rating: game.rating,
        likes: game.likesCount,
        price: game.price,
      }));

      if (games.length === 0) {
        results.replaceChildren(createEmptyState('Data Not Found'));
      } else {
        results.replaceChildren(createGamesList(games));
      }

      if (hasGamesFailed) {
        showSnackbar('Library games loaded successfully.', 'success');
        hasGamesFailed = false;
      }
    } catch {
      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      results.replaceChildren(
        createErrorState('Could not load games. Please try again.', (): void => {
          void loadGames();
        }),
      );

      hasGamesFailed = true;
      showSnackbar('Failed to load library games.', 'error');
    } finally {
      if (gamesRequest === controller && !isDestroyed) {
        results.setAttribute('aria-busy', 'false');
        pagination.setLoading(false);
      }
    }
  }

  async function loadCategories(): Promise<void> {
    if (isDestroyed) {
      return;
    }

    categoriesRequest?.abort();

    categoryState.setAttribute('aria-busy', 'true');
    categoryState.replaceChildren(createSkeleton('Loading categories'));

    const controller = new AbortController();
    categoriesRequest = controller;

    try {
      const categories = await getCategories(controller.signal);

      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      activeCategory =
        categories.find((category) => category.isDefault)?.slug ?? categories[0]?.slug ?? 'all';
      currentPage = 1;

      if (categories.length === 0) {
        categoryState.replaceChildren(createEmptyState('No categories available.'));
      } else {
        categoryState.replaceChildren(
          createCategoryFilters(categories, activeCategory, (category): void => {
            activeCategory = category;
            currentPage = 1;
            void loadGames();
          }),
        );
      }

      if (hasCategoriesFailed) {
        showSnackbar('Categories loaded successfully.', 'success');
        hasCategoriesFailed = false;
      }
    } catch {
      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      categoryState.replaceChildren(
        createErrorState('Could not load categories. Please try again.', (): void => {
          void loadCategories();
        }),
      );

      hasCategoriesFailed = true;
      showSnackbar('Failed to load categories.', 'error');
    } finally {
      if (categoriesRequest === controller && !isDestroyed) {
        categoryState.setAttribute('aria-busy', 'false');
      }
    }

    if (!isDestroyed && !controller.signal.aborted) {
      void loadGames();
    }
  }

  main.addEventListener(
    'page-dispose',
    (): void => {
      isDestroyed = true;
      pagination.destroy();
      gamesRequest?.abort();
      categoriesRequest?.abort();
    },
    { once: true },
  );

  sortControl.addEventListener('change', (): void => {
    currentPage = 1;
    void loadGames();
  });

  void loadCategories();

  return main;
}

import './library-page.scss';
import { createGameCard } from '../../components/game-card/game-card';
import type { LibraryGame } from './library-data';
import { getGames } from '../../services/api';
import { resolveGameImage } from '../../services/media';
import {
  createEmptyState,
  createErrorState,
  createSkeleton,
} from '../../components/feedback/feedback';
import { showSnackbar } from '../../components/snackbar/snackbar';
import { createPagination } from '../../components/pagination/pagination';

const categories = ['All Games', 'Puzzle', 'Card', 'Match', 'Farm', 'Strategy', 'Arcade'];

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

function createCategoryFilters(): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'library-page__categories';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Game categories');

  const buttons: HTMLButtonElement[] = [];

  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-page__chip';
    button.textContent = category;
    button.setAttribute('aria-pressed', String(category === 'All Games'));

    button.addEventListener('click', (): void => {
      for (const item of buttons) {
        item.setAttribute('aria-pressed', String(item === button));
      }
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
  controls.append(createCategoryFilters(), createSortControl());

  const results = document.createElement('div');
  results.className = 'library-page__results';

  main.append(createPageHeading(), controls, results, createPagination());

  let request: AbortController | undefined;
  let isDestroyed = false;
  let hasFailed = false;

  async function loadGames(): Promise<void> {
    if (isDestroyed) {
      return;
    }

    request?.abort();

    results.setAttribute('aria-busy', 'true');
    results.replaceChildren(createLoadingGames());

    const controller = new AbortController();
    request = controller;

    try {
      const response = await getGames(controller.signal);

      if (isDestroyed || controller.signal.aborted) {
        return;
      }

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

      if (hasFailed) {
        showSnackbar('Library games loaded successfully.', 'success');
        hasFailed = false;
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

      hasFailed = true;
      showSnackbar('Failed to load library games.', 'error');
    } finally {
      if (request === controller && !isDestroyed) {
        results.setAttribute('aria-busy', 'false');
      }
    }
  }

  main.addEventListener(
    'page-dispose',
    (): void => {
      isDestroyed = true;
      request?.abort();
    },
    { once: true },
  );

  void loadGames();

  return main;
}

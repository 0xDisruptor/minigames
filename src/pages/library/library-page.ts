import './library-page.scss';
import { createGameCard } from '../../components/game-card/game-card';
import { libraryGames } from './library-data';
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

function createGamesList(): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'library-page__games';
  list.setAttribute('aria-label', 'Games');

  for (const game of libraryGames) {
    const item = document.createElement('li');
    item.className = 'library-page__game';
    item.dataset.gameId = game.id;
    item.append(createGameCard(game));

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

  main.append(createPageHeading(), controls, createGamesList(), createPagination());

  return main;
}

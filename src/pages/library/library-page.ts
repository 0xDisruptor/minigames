import './library-page.scss';

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

export function createLibraryPage(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'library-page';

  const controls = document.createElement('div');
  controls.className = 'library-page__controls';
  controls.append(createCategoryFilters());

  main.append(createPageHeading(), controls);

  return main;
}

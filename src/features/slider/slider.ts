import './slider.scss';

import { sliderGames } from './slider-data';
import type { SliderGame } from './slider-data';

import arrowLeftUrl from '../../assets/icons/arrow-left.svg';
import arrowRightUrl from '../../assets/icons/arrow-right.svg';
import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';

const AUTOPLAY_DELAY = 4000;
const SWIPE_THRESHOLD = 40;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;

  return element;
}

function createIcon(url: string): HTMLImageElement {
  const image = createElement('img', 'slider__icon');

  image.src = url;
  image.alt = '';
  image.width = 24;
  image.height = 24;

  return image;
}

function createArrow(label: string, iconUrl: string, modifier: string): HTMLButtonElement {
  const button = createElement('button', `slider__arrow slider__arrow--${modifier}`);

  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(createIcon(iconUrl));

  return button;
}

function createMetric(iconUrl: string, value: string, label: string): HTMLSpanElement {
  const metric = createElement('span', 'slider__metric');
  metric.setAttribute('aria-label', label);

  const text = document.createElement('span');
  text.textContent = value;

  metric.append(createIcon(iconUrl), text);

  return metric;
}

function createCard(game: SliderGame, index: number): HTMLLIElement {
  const item = createElement('li', 'slider__item');

  item.dataset.sliderIndex = String(index);
  item.dataset.gameId = game.id;

  const card = createElement('button', 'slider__card');

  card.type = 'button';
  card.dataset.action = 'open-game-details';
  card.dataset.gameId = game.id;
  card.setAttribute('aria-label', `Open details for ${game.title}`);

  const image = createElement('img', 'slider__image');

  image.src = game.image;
  image.alt = game.title;
  image.loading = index === 0 ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.draggable = false;

  const info = createElement('div', 'slider__info');

  const heading = createElement('h3', 'slider__name');
  heading.textContent = game.title;
  heading.title = game.title;

  const metrics = createElement('div', 'slider__metrics');

  const ratingText = game.rating.toFixed(1);
  const likesText = `${(game.likes / 1000).toFixed(1)}K`;

  metrics.append(
    createMetric(starUrl, ratingText, `Rating: ${ratingText} out of 5`),
    createMetric(heartUrl, likesText, `${game.likes} likes`),
  );

  info.append(heading, metrics);
  card.append(image, info);
  item.append(card);

  return item;
}

function getCircularOffset(index: number, activeIndex: number): number {
  const count = sliderGames.length;
  let offset = index - activeIndex;

  if (offset > Math.floor(count / 2)) {
    offset -= count;
  }

  if (offset < -Math.floor(count / 2)) {
    offset += count;
  }

  return offset;
}

function getPositionClass(offset: number): string {
  switch (offset) {
    case -2: {
      return 'slider__item--previous-2';
    }

    case -1: {
      return 'slider__item--previous';
    }

    case 0: {
      return 'slider__item--active';
    }

    case 1: {
      return 'slider__item--next';
    }

    case 2: {
      return 'slider__item--next-2';
    }

    default: {
      return 'slider__item--hidden';
    }
  }
}

function updateSliderPositions(track: HTMLUListElement, activeIndex: number): void {
  const items = [...track.querySelectorAll<HTMLLIElement>('.slider__item')];

  for (const [index, item] of items.entries()) {
    const offset = getCircularOffset(index, activeIndex);
    const card = item.querySelector<HTMLButtonElement>('.slider__card');

    item.className = 'slider__item';

    const isVisible = offset >= -2 && offset <= 2;

    item.setAttribute('aria-hidden', String(!isVisible));

    if (card) {
      card.tabIndex = isVisible ? 0 : -1;
    }

    item.classList.add(getPositionClass(offset));
  }
}

interface AutoplayController {
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

function createAutoplay(onAdvance: () => void): AutoplayController {
  let timerId: number | undefined;
  let startedAt = 0;
  let remainingTime = AUTOPLAY_DELAY;
  let isPaused = false;

  const clearTimer = (): void => {
    if (timerId === undefined) {
      return;
    }

    clearTimeout(timerId);
    timerId = undefined;
  };

  const schedule = (delay: number): void => {
    clearTimer();

    remainingTime = delay;
    startedAt = performance.now();

    timerId = setTimeout((): void => {
      timerId = undefined;
      remainingTime = AUTOPLAY_DELAY;

      onAdvance();

      if (!isPaused) {
        schedule(AUTOPLAY_DELAY);
      }
    }, delay);
  };

  const pause = (): void => {
    if (isPaused) {
      return;
    }

    isPaused = true;

    if (timerId === undefined) {
      return;
    }

    const elapsedTime = performance.now() - startedAt;

    remainingTime = Math.max(0, remainingTime - elapsedTime);

    clearTimer();
  };

  const resume = (): void => {
    if (!isPaused) {
      return;
    }

    isPaused = false;
    schedule(remainingTime);
  };

  const reset = (): void => {
    isPaused = false;
    remainingTime = AUTOPLAY_DELAY;

    schedule(AUTOPLAY_DELAY);
  };

  schedule(AUTOPLAY_DELAY);

  return {
    pause,
    resume,
    reset,
  };
}

function enableSwipe(
  track: HTMLUListElement,
  showPrevious: () => void,
  showNext: () => void,
  autoplay: AutoplayController,
): void {
  let activePointerId: number | undefined;
  let startX = 0;
  let currentX = 0;
  let shouldSuppressNextClick = false;

  track.addEventListener('pointerdown', (event: PointerEvent): void => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }

    activePointerId = event.pointerId;
    startX = event.clientX;
    currentX = event.clientX;
    shouldSuppressNextClick = false;

    autoplay.pause();

    track.setPointerCapture(event.pointerId);
  });

  track.addEventListener('pointermove', (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    currentX = event.clientX;
  });

  track.addEventListener('pointerup', (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    const distance = currentX - startX;
    const isSwipe = Math.abs(distance) >= SWIPE_THRESHOLD;

    if (isSwipe) {
      shouldSuppressNextClick = true;

      if (distance < 0) {
        showNext();
      } else {
        showPrevious();
      }

      autoplay.reset();

      setTimeout((): void => {
        shouldSuppressNextClick = false;
      }, 0);
    } else {
      autoplay.resume();
    }

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    activePointerId = undefined;
  });

  track.addEventListener('pointercancel', (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    activePointerId = undefined;

    autoplay.resume();
  });

  track.addEventListener(
    'click',
    (event: MouseEvent): void => {
      if (!shouldSuppressNextClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true },
  );
}

export function createSlider(): HTMLElement {
  const section = createElement('section', 'slider');
  section.setAttribute('aria-labelledby', 'new-games-title');

  const header = createElement('div', 'slider__header');

  const heading = createElement('h2', 'slider__title');
  heading.id = 'new-games-title';
  heading.textContent = 'New Games';

  const controls = createElement('div', 'slider__controls');

  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Carousel controls');

  const previousButton = createArrow('Previous games', arrowLeftUrl, 'previous');
  const nextButton = createArrow('Next games', arrowRightUrl, 'next');

  controls.append(previousButton, nextButton);
  header.append(heading, controls);

  const track = createElement('ul', 'slider__track');

  track.setAttribute('aria-label', 'Featured games');

  for (const [index, game] of sliderGames.entries()) {
    track.append(createCard(game, index));
  }

  let activeIndex = 0;

  const showPrevious = (): void => {
    activeIndex = (activeIndex - 1 + sliderGames.length) % sliderGames.length;
    updateSliderPositions(track, activeIndex);
  };

  const showNext = (): void => {
    activeIndex = (activeIndex + 1) % sliderGames.length;
    updateSliderPositions(track, activeIndex);
  };

  const autoplay = createAutoplay(showNext);

  previousButton.addEventListener('click', (): void => {
    showPrevious();
    autoplay.reset();
  });

  nextButton.addEventListener('click', (): void => {
    showNext();
    autoplay.reset();
  });

  enableSwipe(track, showPrevious, showNext, autoplay);

  updateSliderPositions(track, activeIndex);

  section.append(header, track);

  return section;
}

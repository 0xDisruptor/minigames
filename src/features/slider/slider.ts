import './slider.scss';
import { sliderGames } from './slider-data';
import type { SliderGame } from './slider-data';

import arrowLeftUrl from '../../assets/icons/arrow-left.svg';
import arrowRightUrl from '../../assets/icons/arrow-right.svg';
import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';

import solitaireUrl from '../../assets/images/cozy-solitaire-card.jpg';
import potionsUrl from '../../assets/images/shelve-the-potions-card.jpg';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element: HTMLElementTagNameMap[K] = document.createElement(tag);
  element.className = className;

  return element;
}

function createIcon(url: string): HTMLImageElement {
  const image: HTMLImageElement = createElement('img', 'slider__icon');
  image.src = url;
  image.alt = '';
  image.width = 24;
  image.height = 24;

  return image;
}

function createArrow(label: string, iconUrl: string, modifier: string): HTMLButtonElement {
  const button: HTMLButtonElement = createElement(
    'button',
    `slider__arrow slider__arrow--${modifier}`,
  );

  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.append(createIcon(iconUrl));

  return button;
}

function createMetric(iconUrl: string, value: string, label: string): HTMLSpanElement {
  const metric: HTMLSpanElement = createElement('span', 'slider__metric');
  metric.setAttribute('aria-label', label);

  const text: HTMLSpanElement = document.createElement('span');
  text.textContent = value;

  metric.append(createIcon(iconUrl), text);

  return metric;
}

function createCard(
  imageUrl: string,
  title: string,
  modifier: string,
  game?: SliderGame,
): HTMLLIElement {
  const item: HTMLLIElement = createElement('li', `slider__item slider__item--${modifier}`);

  const card: HTMLDivElement = createElement('div', 'slider__card');

  const image: HTMLImageElement = createElement('img', 'slider__image');
  image.src = imageUrl;
  image.alt = title;
  image.loading = 'lazy';
  image.decoding = 'async';

  card.append(image);

  if (game) {
    const info: HTMLDivElement = createElement('div', 'slider__info');

    const heading: HTMLHeadingElement = createElement('h3', 'slider__name');
    heading.textContent = game.title;
    heading.title = game.title;

    const metrics: HTMLDivElement = createElement('div', 'slider__metrics');

    const ratingText: string = game.rating.toFixed(1);
    const likesText: string = `${(game.likes / 1000).toFixed(1)}K`;

    metrics.append(
      createMetric(starUrl, ratingText, `Rating: ${ratingText} out of 5`),
      createMetric(heartUrl, likesText, `${game.likes} likes`),
    );

    info.append(heading, metrics);
    card.append(info);
  }

  item.append(card);

  return item;
}

export function createSlider(): HTMLElement {
  const section: HTMLElement = createElement('section', 'slider');
  section.setAttribute('aria-labelledby', 'new-games-title');

  const header: HTMLDivElement = createElement('div', 'slider__header');

  const heading: HTMLHeadingElement = createElement('h2', 'slider__title');
  heading.id = 'new-games-title';
  heading.textContent = 'New Games';

  const controls: HTMLDivElement = createElement('div', 'slider__controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Carousel controls');

  controls.append(
    createArrow('Previous games', arrowLeftUrl, 'previous'),
    createArrow('Next games', arrowRightUrl, 'next'),
  );

  header.append(heading, controls);

  const track: HTMLUListElement = createElement('ul', 'slider__track');

  track.append(createCard(solitaireUrl, 'Cozy Solitaire', 'edge'));

  for (const game of sliderGames) {
    const modifier: string = game.id === 'vacation-cafe-simulator' ? 'featured' : 'side';

    track.append(createCard(game.image, game.title, modifier, game));
  }

  track.append(createCard(potionsUrl, 'Shelve the Potions', 'edge'));

  section.append(header, track);

  return section;
}

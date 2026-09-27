import type { LibraryGame } from '../../pages/library/library-data';

import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';

import './game-card.scss';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;

  return element;
}

function createMetric(iconUrl: string, text: string, accessibleLabel: string): HTMLSpanElement {
  const metric = createElement('span', 'game-card__metric');
  metric.setAttribute('aria-label', accessibleLabel);

  const icon = document.createElement('img');
  icon.src = iconUrl;
  icon.alt = '';
  icon.width = 24;
  icon.height = 24;

  const value = document.createElement('span');
  value.textContent = text;

  metric.append(icon, value);

  return metric;
}

export function createGameCard(game: LibraryGame): HTMLElement {
  const card = createElement('article', 'game-card');
  card.setAttribute('aria-labelledby', `game-title-${game.id}`);

  const image = createElement('img', 'game-card__image');
  image.src = game.image;
  image.alt = game.title;
  image.loading = 'lazy';
  image.decoding = 'async';

  const content = createElement('div', 'game-card__content');

  const heading = createElement('div', 'game-card__heading');

  const title = createElement('h2', 'game-card__title');
  title.id = `game-title-${game.id}`;
  title.textContent = game.title;

  const category = createElement('span', 'game-card__category');
  category.textContent = game.category;

  heading.append(title, category);

  const price = createElement('span', 'game-card__price');
  price.textContent = game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`;
  price.classList.toggle('game-card__price--free', game.price === 0);

  const description = createElement('p', 'game-card__description');
  description.textContent = game.description;

  const metrics = createElement('div', 'game-card__metrics');

  metrics.append(
    createMetric(starUrl, game.rating.toFixed(1), `Rating: ${game.rating.toFixed(1)} out of 5`),
    createMetric(heartUrl, `${(game.likes / 1000).toFixed(1)}K`, `${game.likes} likes`),
  );

  const details = createElement('button', 'game-card__details');
  details.type = 'button';
  details.textContent = 'Details';
  details.setAttribute('aria-label', `Details about ${game.title}`);

  content.append(heading, price, description, metrics, details);
  card.append(image, content);

  return card;
}

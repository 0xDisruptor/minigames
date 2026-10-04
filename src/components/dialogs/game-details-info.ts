import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';

function createMetric(iconUrl: string, text: string, label: string): HTMLSpanElement {
  const metric = document.createElement('span');
  metric.className = 'game-dialog__metric';
  metric.setAttribute('aria-label', label);

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

export function createGameDetailsInfo() {
  const element = document.createElement('div');
  element.className = 'game-dialog__info';

  const heading = document.createElement('div');
  heading.className = 'game-dialog__heading';

  const title = document.createElement('h2');
  title.id = 'game-dialog-title';
  title.className = 'game-dialog__title';
  title.textContent = 'Tukoni: Forest Keepers';

  const metrics = document.createElement('div');
  metrics.className = 'game-dialog__metrics';
  metrics.append(
    createMetric(starUrl, '4.9', 'Rating: 4.9 out of 5'),
    createMetric(heartUrl, '31.2K', '31200 likes'),
  );

  heading.append(title, metrics);

  const description = document.createElement('p');
  description.className = 'game-dialog__description';
  description.textContent =
    'Tukoni: Forest Keepers — a cozy hand-drawn puzzle-adventure. ' +
    'You are Traveller, a little forest spirit on an important mission. ' +
    'Wander storybook meadows, visit mushroom villages, meet adorable ' +
    'inhabitants, solve gentle hand-crafted puzzles, brew herbal teas ' +
    'and help the Tukoni forest prepare peacefully for the coming winter.';

  const characteristics = document.createElement('dl');
  characteristics.className = 'game-dialog__characteristics';

  const entries = [
    ['Genre', 'Puzzle'],
    ['Players', 'Solo'],
    ['Duration', '40–90 min'],
    ['Price', 'Free'],
  ];

  for (const [label, value] of entries) {
    const item = document.createElement('div');
    item.className = 'game-dialog__characteristic';

    const term = document.createElement('dt');
    term.textContent = label ?? '';

    const detail = document.createElement('dd');
    detail.textContent = value ?? '';

    item.append(term, detail);
    characteristics.append(item);
  }

  const actions = document.createElement('div');
  actions.className = 'game-dialog__actions';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'game-dialog__action game-dialog__action--play';
  playButton.textContent = 'Play Now';

  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'game-dialog__action game-dialog__action--favorite';
  favoriteButton.setAttribute('aria-label', 'Add to Favorites');
  favoriteButton.setAttribute('aria-pressed', 'false');

  const favoriteIcon = document.createElement('span');
  favoriteIcon.className = 'game-dialog__favorite-icon';
  favoriteIcon.textContent = '♡';
  favoriteIcon.setAttribute('aria-hidden', 'true');

  const favoriteText = document.createElement('span');
  favoriteText.className = 'game-dialog__favorite-text';
  favoriteText.textContent = 'Add to Favorites';

  favoriteButton.append(favoriteIcon, favoriteText);

  favoriteButton.addEventListener('click', (): void => {
    const isFavorite = favoriteButton.getAttribute('aria-pressed') === 'true';

    favoriteButton.setAttribute('aria-pressed', String(!isFavorite));
    favoriteIcon.textContent = isFavorite ? '♡' : '♥';
  });

  function reset(): void {
    favoriteButton.setAttribute('aria-pressed', 'false');
    favoriteIcon.textContent = '♡';
  }

  actions.append(playButton, favoriteButton);
  element.append(heading, description, characteristics, actions);

  return { element, reset };
}

import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';
import type { GameDetails } from '../../services/api';

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

export function createGameDetailsInfo(game: GameDetails): HTMLElement {
  const element = document.createElement('div');
  element.className = 'game-dialog__info';

  const heading = document.createElement('div');
  heading.className = 'game-dialog__heading';

  const title = document.createElement('h2');
  title.id = 'game-dialog-title';
  title.className = 'game-dialog__title';
  title.textContent = game.name;

  const metrics = document.createElement('div');
  metrics.className = 'game-dialog__metrics';

  const likes = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(game.likesCount);

  metrics.append(
    createMetric(starUrl, game.rating.toFixed(1), `Rating: ${game.rating} out of 5`),
    createMetric(heartUrl, likes, `${game.likesCount} likes`),
  );

  heading.append(title, metrics);

  const description = document.createElement('p');
  description.className = 'game-dialog__description';
  description.textContent = game.fullDescription || 'No description available.';

  const characteristics = document.createElement('dl');
  characteristics.className = 'game-dialog__characteristics';

  const entries = [
    ['Genre', game.specs.genre],
    ['Players', game.specs.players],
    ['Duration', game.specs.duration],
    ['Price', game.specs.price],
  ] as const;

  for (const [label, value] of entries) {
    const item = document.createElement('div');
    item.className = 'game-dialog__characteristic';

    const term = document.createElement('dt');
    term.textContent = label;

    const detail = document.createElement('dd');
    detail.textContent = value;

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
  favoriteButton.disabled = true;
  favoriteButton.setAttribute('aria-pressed', String(game.isLikedByCurrentUser));

  const favoriteLabel = game.isLikedByCurrentUser ? 'In Favorites' : 'Add to Favorites';

  favoriteButton.setAttribute('aria-label', favoriteLabel);

  const favoriteIcon = document.createElement('span');
  favoriteIcon.className = 'game-dialog__favorite-icon';
  favoriteIcon.textContent = game.isLikedByCurrentUser ? '♥' : '♡';
  favoriteIcon.setAttribute('aria-hidden', 'true');

  const favoriteText = document.createElement('span');
  favoriteText.className = 'game-dialog__favorite-text';
  favoriteText.textContent = favoriteLabel;

  favoriteButton.append(favoriteIcon, favoriteText);
  actions.append(playButton, favoriteButton);
  element.append(heading, description, characteristics, actions);

  return element;
}

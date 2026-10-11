import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';
import type { ProtectedActionGuard } from '../../app/protected-action-guard';
import { toggleGameFavorite } from '../../services/api';
import type { GameDetails } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import { showSnackbar } from '../snackbar/snackbar';

export interface GameDetailsActions {
  readonly requireSession?: ProtectedActionGuard;
  readonly getActiveSession?: () => AppSession | undefined;
}

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

export function createGameDetailsInfo(
  game: GameDetails,
  options: GameDetailsActions = {},
  signal?: AbortSignal,
): HTMLElement {
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

  const likesFormatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const likesMetric = createMetric(
    heartUrl,
    likesFormatter.format(game.likesCount),
    `${game.likesCount} likes`,
  );

  metrics.append(
    createMetric(starUrl, game.rating.toFixed(1), `Rating: ${game.rating} out of 5`),
    likesMetric,
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

  const favoriteIcon = document.createElement('span');
  favoriteIcon.className = 'game-dialog__favorite-icon';
  favoriteIcon.setAttribute('aria-hidden', 'true');

  const favoriteText = document.createElement('span');
  favoriteText.className = 'game-dialog__favorite-text';

  const canToggleFavorite = Boolean(options.requireSession && options.getActiveSession);

  let isFavorited = Boolean(options.getActiveSession?.() && game.isLikedByCurrentUser);
  let likesCount = game.likesCount;
  let isPending = false;

  function renderFavorite(): void {
    const label = isFavorited ? 'In Favorites' : 'Add to Favorites';

    favoriteButton.disabled = !canToggleFavorite || isPending || Boolean(signal?.aborted);

    favoriteButton.setAttribute('aria-pressed', String(isFavorited));
    favoriteButton.setAttribute('aria-busy', String(isPending));
    favoriteButton.setAttribute('aria-label', label);

    favoriteIcon.textContent = isFavorited ? '♥' : '♡';
    favoriteText.textContent = isPending ? 'Saving…' : label;

    likesMetric.setAttribute('aria-label', `${likesCount} likes`);
    likesMetric.lastElementChild?.replaceChildren(likesFormatter.format(likesCount));
  }

  async function toggleFavorite(): Promise<void> {
    if (isPending || signal?.aborted || !options.requireSession || !options.getActiveSession) {
      return;
    }

    const session = options.requireSession(favoriteButton);

    if (!session) {
      return;
    }

    isPending = true;
    renderFavorite();

    function canApplyResult(): boolean {
      return !signal?.aborted && options.getActiveSession?.() === session;
    }

    try {
      const result = await toggleGameFavorite(game.slug, session.email, signal);

      if (!canApplyResult()) {
        return;
      }

      isFavorited = result.isFavorited;
      likesCount = result.likesCount;

      showSnackbar(isFavorited ? 'Added to favorites.' : 'Removed from favorites.', 'success');
    } catch {
      if (canApplyResult()) {
        showSnackbar('Could not update favorites. Please try again.', 'error');
      }
    } finally {
      isPending = false;
      renderFavorite();
    }
  }

  favoriteButton.addEventListener('click', (): void => {
    void toggleFavorite();
  });

  renderFavorite();

  favoriteButton.append(favoriteIcon, favoriteText);
  actions.append(playButton, favoriteButton);
  element.append(heading, description, characteristics, actions);

  return element;
}

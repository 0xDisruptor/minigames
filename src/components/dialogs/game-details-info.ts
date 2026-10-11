import starUrl from '../../assets/icons/star.svg';
import heartUrl from '../../assets/icons/heart.svg';
import type { ProtectedActionGuard } from '../../app/protected-action-guard';
import { getGameDetails, toggleGameFavorite } from '../../services/api';
import type { GameDetails } from '../../services/api';
import type { AppSession } from '../../state/app-session';
import type { AppSessionStore } from '../../state/store';
import { showSnackbar } from '../snackbar/snackbar';

export interface GameDetailsActions {
  readonly requireSession?: ProtectedActionGuard;
  readonly getActiveSession?: () => AppSession | undefined;
  readonly sessionStore?: Pick<AppSessionStore, 'subscribe'>;
}

export interface GameDetailsInfoOptions extends GameDetailsActions {
  readonly loadedSession?: AppSession;
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
  options: GameDetailsInfoOptions = {},
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

  let displayedSession = options.sessionStore
    ? options.loadedSession
    : options.getActiveSession?.();

  let isFavorited = Boolean(
    displayedSession &&
    displayedSession === options.getActiveSession?.() &&
    game.isLikedByCurrentUser,
  );

  let likesCount = game.likesCount;
  let isPending = false;
  let isRefreshing = false;
  let isDisposed = Boolean(signal?.aborted);
  let hasFavoriteLoadFailed = false;

  let personalRequest: AbortController | undefined;
  let mutationRequest: AbortController | undefined;
  let unsubscribe: (() => void) | undefined;

  function renderFavorite(): void {
    const favoriteLabel = isFavorited ? 'In Favorites' : 'Add to Favorites';

    const label = hasFavoriteLoadFailed && displayedSession ? 'Retry Favorites' : favoriteLabel;

    const isButtonBusy = isPending || (isRefreshing && Boolean(displayedSession));

    const requestLabel = isPending ? 'Saving…' : 'Loading…';

    favoriteButton.disabled = !canToggleFavorite || isButtonBusy || isDisposed;

    favoriteButton.setAttribute('aria-pressed', String(isFavorited));
    favoriteButton.setAttribute('aria-busy', String(isButtonBusy));
    favoriteButton.setAttribute('aria-label', label);

    favoriteIcon.textContent = isFavorited ? '♥' : '♡';
    favoriteText.textContent = isButtonBusy ? requestLabel : label;

    likesMetric.setAttribute('aria-label', `${likesCount} likes`);
    likesMetric.lastElementChild?.replaceChildren(likesFormatter.format(likesCount));
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }

    isDisposed = true;

    unsubscribe?.();
    unsubscribe = undefined;

    personalRequest?.abort();
    mutationRequest?.abort();

    personalRequest = undefined;
    mutationRequest = undefined;

    isPending = false;
    isRefreshing = false;

    signal?.removeEventListener('abort', dispose);

    renderFavorite();
  }

  async function refreshFavorite(nextSession: AppSession | undefined): Promise<void> {
    if (isDisposed) {
      return;
    }

    personalRequest?.abort();

    const controller = new AbortController();
    personalRequest = controller;

    isRefreshing = true;
    hasFavoriteLoadFailed = false;
    renderFavorite();

    function canApplyResult(): boolean {
      return (
        !isDisposed &&
        !controller.signal.aborted &&
        personalRequest === controller &&
        options.getActiveSession?.() === nextSession
      );
    }

    try {
      const details = await getGameDetails(game.slug, controller.signal, nextSession?.email);

      if (!canApplyResult()) {
        return;
      }

      if (!details) {
        throw new Error('Game details were not found.');
      }

      isFavorited = Boolean(nextSession && details.isLikedByCurrentUser);
      likesCount = details.likesCount;
    } catch {
      if (canApplyResult()) {
        hasFavoriteLoadFailed = true;

        showSnackbar('Could not load favorites. Please try again.', 'error');
      }
    } finally {
      if (personalRequest === controller) {
        personalRequest = undefined;
        isRefreshing = false;
        renderFavorite();
      }
    }
  }

  function onSessionChange(nextSession: AppSession | undefined): void {
    if (isDisposed || nextSession === displayedSession) {
      return;
    }

    displayedSession = nextSession;

    mutationRequest?.abort();
    mutationRequest = undefined;

    isPending = false;
    isFavorited = false;
    hasFavoriteLoadFailed = false;

    void refreshFavorite(nextSession);
  }

  async function toggleFavorite(): Promise<void> {
    if (isPending || isDisposed || !options.requireSession || !options.getActiveSession) {
      return;
    }

    const session = options.requireSession(favoriteButton);

    if (!session || isRefreshing) {
      return;
    }

    if (hasFavoriteLoadFailed) {
      await refreshFavorite(session);
      return;
    }

    const controller = new AbortController();
    mutationRequest = controller;

    isPending = true;
    renderFavorite();

    function canApplyResult(): boolean {
      return (
        !isDisposed &&
        !controller.signal.aborted &&
        mutationRequest === controller &&
        options.getActiveSession?.() === session
      );
    }

    try {
      const result = await toggleGameFavorite(game.slug, session.email, controller.signal);

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
      if (mutationRequest === controller) {
        mutationRequest = undefined;
        isPending = false;
        renderFavorite();
      }
    }
  }

  favoriteButton.addEventListener('click', (): void => {
    void toggleFavorite();
  });

  renderFavorite();

  favoriteButton.append(favoriteIcon, favoriteText);
  actions.append(playButton, favoriteButton);
  element.append(heading, description, characteristics, actions);

  if (!isDisposed) {
    signal?.addEventListener('abort', dispose, { once: true });
    unsubscribe = options.sessionStore?.subscribe(onSessionChange);
  }

  return element;
}

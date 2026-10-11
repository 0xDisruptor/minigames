import './game-details-dialog.scss';

import closeUrl from '../../assets/icons/close.svg';
import { ApiError, getGameDetails } from '../../services/api';
import { resolveGameImage } from '../../services/media';
import { createEmptyState, createErrorState, createSkeleton } from '../feedback/feedback';
import { dismissSnackbar, showSnackbar } from '../snackbar/snackbar';
import { createGameDetailsInfo } from './game-details-info';
import { createGameDetailsRecords } from './game-details-records';
import { createGameDetailsComments } from './game-details-comment';
import type { GameDetailsActions } from './game-details-info';

export function createGameDetailsDialog(
  onRequestClose?: () => void,
  options: GameDetailsActions = {},
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-dialog';
  dialog.setAttribute('aria-labelledby', 'game-dialog-title');

  const hero = document.createElement('div');
  hero.className = 'game-dialog__hero';

  const media = document.createElement('div');
  media.className = 'game-dialog__media';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'game-dialog__close';
  closeButton.autofocus = true;
  closeButton.setAttribute('aria-label', 'Close game details');

  const closeIcon = document.createElement('img');
  closeIcon.src = closeUrl;
  closeIcon.alt = '';
  closeIcon.width = 24;
  closeIcon.height = 24;

  closeButton.append(closeIcon);
  hero.append(media, closeButton);

  const content = document.createElement('div');
  content.className = 'game-dialog__content';

  const comments = createGameDetailsComments();

  dialog.append(hero, content);

  let opener: HTMLElement | undefined;
  let currentSlug: string | undefined;
  let request: AbortController | undefined;
  let contentController: AbortController | undefined;
  let hasFailed = false;
  let wasPointerStartedOutside = false;
  let isSuspended = false;
  let suspendedScrollTop = 0;
  let shouldReloadOnResume = false;

  function showState(title: string, state: HTMLElement): void {
    const heading = document.createElement('h2');
    heading.id = 'game-dialog-title';
    heading.className = 'game-dialog__title';
    heading.textContent = title;

    content.replaceChildren(heading, state);
  }

  function showNotFound(): void {
    media.replaceChildren();
    showState('Game Not Found', createEmptyState('The requested game could not be found.'));
  }

  async function loadGame(): Promise<void> {
    const slug = currentSlug;

    if (!slug || !dialog.open) {
      return;
    }

    request?.abort();
    contentController?.abort();
    contentController = undefined;
    comments.reset();

    const controller = new AbortController();
    request = controller;

    content.setAttribute('aria-busy', 'true');
    media.replaceChildren(createSkeleton('Loading game cover'));
    showState('Game details', createSkeleton('Loading game details'));

    try {
      const game = await getGameDetails(
        slug,
        controller.signal,
        options.getActiveSession?.()?.email,
      );

      if (!dialog.open || controller.signal.aborted) {
        return;
      }

      if (!game) {
        showNotFound();
        return;
      }

      const cover = document.createElement('img');
      cover.className = 'game-dialog__cover';
      cover.src = resolveGameImage(game.heroImage);
      cover.alt = game.name;
      cover.width = 600;
      cover.height = 220;

      media.replaceChildren(cover);
      const actionsController = new AbortController();
      contentController = actionsController;

      content.replaceChildren(
        createGameDetailsInfo(game, options, actionsController.signal),
        createGameDetailsRecords(game.topRecords),
        comments.element,
      );

      void comments.load(slug);

      if (hasFailed) {
        showSnackbar('Game details loaded successfully.', 'success');
        hasFailed = false;
      }
    } catch (error: unknown) {
      if (!dialog.open || controller.signal.aborted) {
        return;
      }

      media.replaceChildren();

      if (error instanceof ApiError && error.status === 404) {
        showNotFound();
        showSnackbar('Game not found.', 'error');
        return;
      }

      hasFailed = true;

      showState(
        'Game details',
        createErrorState('Could not load game details. Please try again.', (): void => {
          void loadGame();
        }),
      );

      showSnackbar('Failed to load game details.', 'error');
    } finally {
      if (request === controller) {
        content.setAttribute('aria-busy', 'false');
      }
    }
  }

  function resetClosedState(): void {
    request?.abort();
    contentController?.abort();
    contentController = undefined;
    comments.reset();

    request = undefined;
    currentSlug = undefined;
    isSuspended = false;
    suspendedScrollTop = 0;
    shouldReloadOnResume = false;
    wasPointerStartedOutside = false;

    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }

    opener = undefined;
  }

  function close(): void {
    if (isSuspended) {
      dismissSnackbar();
      resetClosedState();
      return;
    }

    if (!dialog.open) {
      return;
    }

    request?.abort();
    contentController?.abort();
    dismissSnackbar();
    dialog.close();
  }

  function suspend(): void {
    if (!dialog.open) {
      return;
    }

    isSuspended = true;
    suspendedScrollTop = dialog.scrollTop;
    shouldReloadOnResume = content.getAttribute('aria-busy') === 'true';

    request?.abort();
    dismissSnackbar();
    dialog.close();
  }

  function requestClose(): void {
    if (onRequestClose) {
      onRequestClose();
      return;
    }

    close();
  }

  function openBySlug(slug: string, trigger?: HTMLElement): void {
    if (!slug || (currentSlug === slug && dialog.open)) {
      return;
    }

    if (isSuspended && currentSlug === slug) {
      const scrollTop = suspendedScrollTop;
      const shouldReload = shouldReloadOnResume;

      isSuspended = false;
      suspendedScrollTop = 0;
      shouldReloadOnResume = false;
      opener = trigger ?? opener;

      dismissSnackbar();
      dialog.showModal();
      dialog.scrollTop = scrollTop;

      if (shouldReload) {
        void loadGame();
      }

      return;
    }

    isSuspended = false;
    suspendedScrollTop = 0;
    shouldReloadOnResume = false;

    opener = trigger ?? (dialog.open ? opener : undefined);
    currentSlug = slug;
    hasFailed = false;

    dismissSnackbar();

    if (!dialog.open) {
      dialog.showModal();
    }

    dialog.scrollTop = 0;
    void loadGame();
  }

  function open(trigger: HTMLElement): void {
    const slug = trigger.dataset.gameId;

    if (slug) {
      openBySlug(slug, trigger);
    }
  }

  closeButton.addEventListener('click', requestClose);

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    requestClose();
  });

  function isOutside(event: MouseEvent): boolean {
    const bounds = dialog.getBoundingClientRect();

    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  }

  dialog.addEventListener('pointerdown', (event: PointerEvent): void => {
    wasPointerStartedOutside = event.target === dialog && isOutside(event);
  });

  dialog.addEventListener('click', (event: MouseEvent): void => {
    if (!wasPointerStartedOutside || event.target !== dialog || !isOutside(event)) {
      return;
    }

    requestClose();
  });

  dialog.addEventListener('close', (): void => {
    if (isSuspended || dialog.open) {
      return;
    }

    resetClosedState();
  });

  return { element: dialog, open, openBySlug, close, suspend };
}

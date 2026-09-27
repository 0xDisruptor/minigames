import './game-details-dialog.scss';

import coverUrl from '../../assets/images/tukoni-forest-keepers-hero.jpg';
import closeUrl from '../../assets/icons/close.svg';

export function createGameDetailsDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-dialog';
  dialog.setAttribute('aria-labelledby', 'game-dialog-title');

  const hero = document.createElement('div');
  hero.className = 'game-dialog__hero';

  const cover = document.createElement('img');
  cover.className = 'game-dialog__cover';
  cover.src = coverUrl;
  cover.alt = 'Tukoni: Forest Keepers';
  cover.width = 600;
  cover.height = 220;

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
  hero.append(cover, closeButton);

  const content = document.createElement('div');
  content.className = 'game-dialog__content';

  const title = document.createElement('h2');
  title.id = 'game-dialog-title';
  title.className = 'game-dialog__title';
  title.textContent = 'Tukoni: Forest Keepers';

  content.append(title);
  dialog.append(hero, content);

  let opener: HTMLElement | undefined;

  function close(): void {
    if (!dialog.open) {
      return;
    }

    dialog.close();
  }

  function open(trigger: HTMLElement): void {
    if (dialog.open) {
      return;
    }

    opener = trigger;
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  closeButton.addEventListener('click', close);

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    close();
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

  let wasPointerStartedOutside = false;

  dialog.addEventListener('pointerdown', (event: PointerEvent): void => {
    wasPointerStartedOutside = event.target === dialog && isOutside(event);
  });

  dialog.addEventListener('click', (event: MouseEvent): void => {
    if (!wasPointerStartedOutside || event.target !== dialog || !isOutside(event)) {
      return;
    }

    close();
  });

  dialog.addEventListener('close', (): void => {
    wasPointerStartedOutside = false;

    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }

    opener = undefined;
  });

  return { element: dialog, open };
}

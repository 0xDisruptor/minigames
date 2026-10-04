import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';

import { createHeader } from '../components/header/header';
import { createFooter } from '../components/footer/footer';
import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';
import { updateUrlQuery } from './navigation';
import { initRouter } from './router';

const app = document.createElement('div');
app.id = 'app';

const outlet = document.createElement('div');
outlet.id = 'page-content';

const dialogContext: { trigger?: HTMLElement } = {};

const authDialog = createAuthDialog(
  (mode): void => {
    updateUrlQuery({
      auth: mode,
      game: undefined,
    });
  },
  (): void => {
    updateUrlQuery({ auth: undefined });
  },
);

const gameDetailsDialog = createGameDetailsDialog((): void => {
  updateUrlQuery({ game: undefined });
});

const header = createHeader((mode, trigger): void => {
  dialogContext.trigger = trigger;

  updateUrlQuery({
    auth: mode,
    game: undefined,
  });
});

app.append(header, outlet, createFooter(), authDialog.element, gameDetailsDialog.element);

app.addEventListener('click', (event: MouseEvent): void => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const trigger = event.target.closest<HTMLButtonElement>(
    'button[data-action="open-game-details"]',
  );

  if (!trigger) {
    return;
  }

  const slug = trigger.dataset.gameId;

  if (!slug) {
    return;
  }

  dialogContext.trigger = trigger;

  updateUrlQuery({
    game: slug,
    auth: undefined,
  });
});

document.body.append(app);

initRouter(app, outlet, {
  auth: authDialog,
  game: gameDetailsDialog,

  takeTrigger(): HTMLElement | undefined {
    const trigger = dialogContext.trigger;
    dialogContext.trigger = undefined;
    return trigger;
  },
});

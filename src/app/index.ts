import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';

import { createHeader } from '../components/header/header';
import { createFooter } from '../components/footer/footer';
import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { initRouter } from './router';
import { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';

const app: HTMLDivElement = document.createElement('div');
app.id = 'app';

const outlet: HTMLDivElement = document.createElement('div');
outlet.id = 'page-content';

const authDialog = createAuthDialog();

const gameDetailsDialog = createGameDetailsDialog();

app.append(
  createHeader(authDialog.open),
  outlet,
  createFooter(),
  authDialog.element,
  gameDetailsDialog.element,
);

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

  gameDetailsDialog.open(trigger);
});

document.body.append(app);

initRouter(app, outlet);

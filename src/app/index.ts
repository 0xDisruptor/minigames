import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';

import { createHeader } from '../components/header/header';
import { createFooter } from '../components/footer/footer';
import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { createGameDetailsDialog } from '../components/dialogs/game-details-dialog';
import { bindAppSessionLifecycle } from '../services/app-session-lifecycle';
import { createAppSessionFromUser } from '../services/app-session-user';
import type { AppSession } from '../state/app-session';
import { canOpenAuthDialog } from './auth-dialog-guard';
import { updateUrlQuery } from './navigation';
import { initRouter } from './router';
import { sessionController } from './session';
import { createProtectedActionGuard } from './protected-action-guard';

const app = document.createElement('div');
app.id = 'app';

const outlet = document.createElement('div');
outlet.id = 'page-content';

const dialogContext: { trigger?: HTMLElement } = {};

const authDialog = createAuthDialog(
  (mode): void => {
    if (!canOpenAuthDialog(sessionController)) {
      return;
    }

    updateUrlQuery({ auth: mode });
  },
  (): void => {
    updateUrlQuery({ auth: undefined });
  },
  {
    onBeforeAuthenticate: async (): Promise<void> => {
      await sessionController.initialize();
      await sessionController.whenReady();
    },

    onAuthenticated: async (user): Promise<void> => {
      let session: AppSession;

      try {
        session = createAppSessionFromUser(user);
      } catch (error: unknown) {
        await sessionController.logout();
        throw error;
      }

      await sessionController.activate(session);
    },
  },
);

const requireSession = createProtectedActionGuard(sessionController, (trigger): void => {
  dialogContext.trigger = trigger;
  updateUrlQuery({ auth: 'login' });
});

const gameDetailsDialog = createGameDetailsDialog(
  (): void => {
    updateUrlQuery({ game: undefined });
  },
  {
    requireSession,
    getActiveSession: sessionController.getActiveSession,
  },
);

const header = createHeader(
  (mode, trigger): void => {
    if (!canOpenAuthDialog(sessionController)) {
      return;
    }

    dialogContext.trigger = trigger;

    updateUrlQuery({ auth: mode });
  },
  async (): Promise<void> => {
    if (!sessionController.getActiveSession()) {
      await sessionController.whenReady();
      return;
    }

    await sessionController.logout();
  },
);

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

  sessionController.getActiveSession();

  dialogContext.trigger = trigger;

  updateUrlQuery({
    game: slug,
    auth: undefined,
  });
});

async function startApp(): Promise<void> {
  bindAppSessionLifecycle(sessionController);

  await sessionController.initialize();

  document.body.append(app);

  initRouter(app, outlet, {
    auth: authDialog,
    game: gameDetailsDialog,

    checkSession(): void {
      sessionController.getActiveSession();
    },

    canOpenAuth(): boolean {
      return canOpenAuthDialog(sessionController);
    },

    takeTrigger(): HTMLElement | undefined {
      const trigger = dialogContext.trigger;
      dialogContext.trigger = undefined;
      return trigger;
    },
  });
}

void startApp();

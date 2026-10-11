// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api';
import type { GameDetails } from '../../services/api';
import { createGameDetailsDialog } from './game-details-dialog';

const mocks = vi.hoisted(() => ({
  getGameDetails: vi.fn<(slug: string, signal?: AbortSignal) => Promise<GameDetails | undefined>>(),
  createGameDetailsInfo: vi.fn(),
  createGameDetailsRecords: vi.fn(),
  createGameDetailsComments: vi.fn(),
  loadComments: vi.fn<(slug: string) => Promise<void>>(),
  resetComments: vi.fn(),
  showSnackbar: vi.fn(),
  dismissSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getGameDetails: mocks.getGameDetails,
  };
});

vi.mock('../../services/media', () => ({
  resolveGameImage: (image: string): string => `/images/${image}`,
}));

vi.mock('./game-details-info', () => ({
  createGameDetailsInfo: mocks.createGameDetailsInfo,
}));

vi.mock('./game-details-records', () => ({
  createGameDetailsRecords: mocks.createGameDetailsRecords,
}));

vi.mock('./game-details-comment', () => ({
  createGameDetailsComments: mocks.createGameDetailsComments,
}));

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
  dismissSnackbar: mocks.dismissSnackbar,
}));

const chess: GameDetails = {
  slug: 'chess',
  name: 'Chess',
  heroImage: 'chess.webp',
  rating: 4.8,
  likesCount: 10,
  isLikedByCurrentUser: false,
  fullDescription: 'Chess description.',
  specs: {
    genre: 'Strategy',
    players: '2',
    duration: '30 minutes',
    price: 'Free',
  },
  topRecords: [],
};

const dialogs: Array<ReturnType<typeof createGameDetailsDialog>> = [];

function createFixture() {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.dataset.gameId = 'chess';

  const dialog = createGameDetailsDialog();
  const element = dialog.element;

  const showNative = vi.fn((): void => {
    element.open = true;
  });

  const closeNative = vi.fn((): void => {
    if (!element.open) {
      return;
    }

    element.open = false;
    element.dispatchEvent(new Event('close'));
  });

  element.showModal = showNative;
  element.close = closeNative;

  document.body.append(trigger, element);
  dialogs.push(dialog);

  const content = element.querySelector<HTMLDivElement>('.game-dialog__content');

  if (!content) {
    throw new Error('Game dialog content was not found.');
  }

  return {
    dialog,
    element,
    content,
    trigger,
    closeNative,
    showNative,
  };
}

async function openLoaded(fixture: ReturnType<typeof createFixture>): Promise<void> {
  fixture.dialog.openBySlug('chess', fixture.trigger);

  await vi.waitFor(() => {
    expect(fixture.content.getAttribute('aria-busy')).toBe('false');
  });
}

describe('game details dialog suspension', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.getGameDetails.mockResolvedValue(chess);
    mocks.loadComments.mockResolvedValue(undefined);

    mocks.createGameDetailsInfo.mockImplementation((game: GameDetails) => {
      const section = document.createElement('section');
      const heading = document.createElement('h2');

      heading.id = 'game-dialog-title';
      heading.textContent = game.name;

      section.append(heading);
      return section;
    });

    mocks.createGameDetailsRecords.mockImplementation(() => {
      const section = document.createElement('section');
      section.textContent = 'Records';
      return section;
    });

    mocks.createGameDetailsComments.mockImplementation(() => {
      const element = document.createElement('section');
      const textarea = document.createElement('textarea');

      element.append(textarea);

      return {
        element,
        load: mocks.loadComments,
        reset: mocks.resetComments,
      };
    });
  });

  afterEach(() => {
    for (const dialog of dialogs) {
      dialog.close();
    }

    dialogs.length = 0;

    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('preserves content, draft and scroll without refetching', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    const originalContent = fixture.content.firstElementChild;
    const textarea = fixture.content.querySelector('textarea');

    if (!textarea) {
      throw new Error('Comment textarea was not found.');
    }

    textarea.value = 'Unfinished comment';
    fixture.element.scrollTop = 240;

    const resetCount = mocks.resetComments.mock.calls.length;
    const focus = vi.spyOn(fixture.trigger, 'focus');

    fixture.dialog.suspend();

    expect(fixture.element.open).toBe(false);
    expect(mocks.resetComments).toHaveBeenCalledTimes(resetCount);
    expect(focus).not.toHaveBeenCalled();

    fixture.dialog.openBySlug('chess');

    expect(fixture.element.open).toBe(true);
    expect(fixture.element.scrollTop).toBe(240);
    expect(fixture.content.firstElementChild).toBe(originalContent);
    expect(fixture.content.querySelector('textarea')).toBe(textarea);
    expect(textarea.value).toBe('Unfinished comment');

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.loadComments).toHaveBeenCalledTimes(1);
    expect(mocks.resetComments).toHaveBeenCalledTimes(resetCount);
  });

  it('does not overwrite saved scroll when suspended again', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    fixture.element.scrollTop = 180;

    fixture.dialog.suspend();

    fixture.element.scrollTop = 0;

    fixture.dialog.suspend();
    fixture.dialog.openBySlug('chess');

    expect(fixture.element.scrollTop).toBe(180);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
  });

  it('ignores a queued close event after the dialog resumes', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    const originalContent = fixture.content.firstElementChild;
    const resetCount = mocks.resetComments.mock.calls.length;

    fixture.closeNative.mockImplementationOnce((): void => {
      fixture.element.open = false;
    });

    fixture.dialog.suspend();
    fixture.dialog.openBySlug('chess');

    fixture.element.dispatchEvent(new Event('close'));

    expect(fixture.element.open).toBe(true);
    expect(fixture.content.firstElementChild).toBe(originalContent);
    expect(mocks.resetComments).toHaveBeenCalledTimes(resetCount);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
  });

  it('clears suspended state when the game is closed', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    const resetCount = mocks.resetComments.mock.calls.length;
    const focus = vi.spyOn(fixture.trigger, 'focus');

    fixture.dialog.suspend();
    fixture.dialog.close();

    expect(fixture.element.open).toBe(false);
    expect(mocks.resetComments).toHaveBeenCalledTimes(resetCount + 1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    await openLoaded(fixture);

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.loadComments).toHaveBeenCalledTimes(2);
  });

  it('reloads the game after ordinary closing', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    fixture.dialog.close();

    expect(fixture.element.open).toBe(false);

    await openLoaded(fixture);

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.loadComments).toHaveBeenCalledTimes(2);
  });

  it('loads another game instead of restoring suspended content', async () => {
    const fixture = createFixture();

    await openLoaded(fixture);

    fixture.element.scrollTop = 200;
    fixture.dialog.suspend();

    mocks.getGameDetails.mockResolvedValue({
      ...chess,
      slug: 'sudoku',
      name: 'Sudoku',
      heroImage: 'sudoku.webp',
    });

    fixture.dialog.openBySlug('sudoku');

    await vi.waitFor(() => {
      expect(fixture.content.querySelector('h2')?.textContent).toBe('Sudoku');
    });

    expect(fixture.element.scrollTop).toBe(0);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.getGameDetails.mock.calls[1]?.[0]).toBe('sudoku');
    expect(mocks.loadComments).toHaveBeenLastCalledWith('sudoku');
  });

  it('restarts an interrupted GET and ignores its late response', async () => {
    const deferred: {
      resolve?: (game: GameDetails) => void;
    } = {};

    const pending = new Promise<GameDetails>((resolve) => {
      deferred.resolve = resolve;
    });

    mocks.getGameDetails.mockReturnValueOnce(pending).mockResolvedValueOnce({
      ...chess,
      name: 'Updated Chess',
    });

    const fixture = createFixture();

    fixture.dialog.openBySlug('chess', fixture.trigger);

    const firstSignal = mocks.getGameDetails.mock.calls[0]?.[1];

    expect(firstSignal?.aborted).toBe(false);

    fixture.dialog.suspend();

    expect(firstSignal?.aborted).toBe(true);

    fixture.dialog.openBySlug('chess');

    await vi.waitFor(() => {
      expect(fixture.content.querySelector('h2')?.textContent).toBe('Updated Chess');
      expect(fixture.content.getAttribute('aria-busy')).toBe('false');
    });

    deferred.resolve?.(chess);

    await pending;

    expect(fixture.content.querySelector('h2')?.textContent).toBe('Updated Chess');
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.loadComments).toHaveBeenCalledTimes(1);
  });

  it('preserves an error until the user explicitly retries', async () => {
    mocks.getGameDetails.mockRejectedValueOnce(new Error('Network failure'));

    const fixture = createFixture();

    await openLoaded(fixture);

    const errorState = fixture.content.querySelector('.feedback-state--error');

    expect(errorState).toBeTruthy();

    fixture.dialog.suspend();
    fixture.dialog.openBySlug('chess');

    expect(fixture.content.querySelector('.feedback-state--error')).toBe(errorState);
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);

    fixture.content.querySelector<HTMLButtonElement>('.feedback-state__retry')?.click();

    await vi.waitFor(() => {
      expect(fixture.content.querySelector('h2')?.textContent).toBe('Chess');
    });

    expect(mocks.getGameDetails).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Game details loaded successfully.', 'success');
  });

  it('preserves the not-found state without refetching', async () => {
    mocks.getGameDetails.mockResolvedValueOnce(undefined);

    const fixture = createFixture();

    await openLoaded(fixture);

    fixture.dialog.suspend();
    fixture.dialog.openBySlug('chess');

    expect(fixture.content.querySelector('h2')?.textContent).toBe('Game Not Found');
    expect(mocks.getGameDetails).toHaveBeenCalledTimes(1);
    expect(mocks.loadComments).not.toHaveBeenCalled();
  });

  it('handles a 404 response as a not-found state', async () => {
    mocks.getGameDetails.mockRejectedValueOnce(new ApiError(404));

    const fixture = createFixture();

    await openLoaded(fixture);

    expect(fixture.content.querySelector('h2')?.textContent).toBe('Game Not Found');
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Game not found.', 'error');
  });
});

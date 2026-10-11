// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardPlayer } from '../../services/api';
import { createLeaderboard } from './leaderboard';

const mocks = vi.hoisted(() => ({
  getLeaderboardPlayers: vi.fn<(signal?: AbortSignal) => Promise<readonly LeaderboardPlayer[]>>(),
  showSnackbar: vi.fn(),
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();

  return {
    ...actual,
    getLeaderboardPlayers: mocks.getLeaderboardPlayers,
  };
});

vi.mock('../snackbar/snackbar', () => ({
  showSnackbar: mocks.showSnackbar,
}));

const player: LeaderboardPlayer = {
  rank: 1,
  playerName: 'Alex Morgan',
  gamesPlayed: 120,
  totalScore: 94_250,
  streakDays: 7,
  favoriteGameSlug: 'chess',
  favoriteGameName: 'Chess',
};

const mountedLeaderboards: ReturnType<typeof createLeaderboard>[] = [];

function createDeferred<T>() {
  const completion: {
    resolve?: (value: T) => void;
    reject?: (reason: unknown) => void;
  } = {};

  const promise = new Promise<T>((resolve, reject) => {
    completion.resolve = resolve;
    completion.reject = reject;
  });

  return { promise, completion };
}

function createFixture() {
  const leaderboard = createLeaderboard();

  mountedLeaderboards.push(leaderboard);
  document.body.append(leaderboard.element);

  const wrapper = leaderboard.element.querySelector<HTMLElement>('.leaderboard__wrapper');

  if (!wrapper) {
    throw new Error('Leaderboard wrapper is missing.');
  }

  return { leaderboard, element: leaderboard.element, wrapper };
}

function getRows(element: HTMLElement): readonly HTMLTableRowElement[] {
  return [...element.querySelectorAll<HTMLTableRowElement>(':scope tbody tr')];
}

function getRetryButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('.feedback-state__retry');

  if (!button) {
    throw new Error('Leaderboard retry button is missing.');
  }

  return button;
}

async function waitUntilIdle(wrapper: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(wrapper.getAttribute('aria-busy')).toBe('false');
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getLeaderboardPlayers.mockResolvedValue([player]);
});

afterEach(() => {
  for (const leaderboard of mountedLeaderboards) {
    leaderboard.destroy();
  }

  mountedLeaderboards.length = 0;
  document.body.replaceChildren();
});

describe('createLeaderboard', () => {
  it('shows loading feedback while the players request is pending', async () => {
    const pending = createDeferred<readonly LeaderboardPlayer[]>();

    mocks.getLeaderboardPlayers.mockReturnValueOnce(pending.promise);

    const { element, wrapper } = createFixture();

    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.querySelector('.feedback-skeleton')?.getAttribute('aria-label')).toBe(
      'Loading top players',
    );
    expect(element.querySelector('.leaderboard__table')).toBeNull();

    expect(mocks.getLeaderboardPlayers).toHaveBeenCalledWith(expect.any(AbortSignal));

    pending.completion.resolve?.([player]);
    await waitUntilIdle(wrapper);

    expect(getRows(element)).toHaveLength(1);
    expect(wrapper.querySelector('.feedback-skeleton')).toBeNull();
  });

  it('renders the player fields, score formats, and table semantics', async () => {
    mocks.getLeaderboardPlayers.mockResolvedValueOnce([
      player,
      {
        ...player,
        rank: 2,
        playerName: 'Taylor',
        gamesPlayed: 90,
        totalScore: 80_100,
        streakDays: 4,
        favoriteGameName: 'Checkers',
      },
    ]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    const rows = getRows(element);
    const firstRow = rows[0];
    const secondRow = rows[1];

    expect(rows).toHaveLength(2);
    expect(element.querySelector('h2')?.textContent).toBe('Top Players This Week');
    expect(element.querySelector('.leaderboard__table')?.getAttribute('aria-labelledby')).toBe(
      'leaderboard-title',
    );
    expect(element.querySelectorAll(':scope thead th')).toHaveLength(6);

    expect(firstRow?.querySelector('.leaderboard__rank')?.textContent).toBe('#1');
    expect(firstRow?.querySelector('.leaderboard__name')?.textContent).toBe('Alex Morgan');
    expect(firstRow?.querySelector('.leaderboard__name')?.getAttribute('title')).toBe(
      'Alex Morgan',
    );
    expect(firstRow?.querySelector('.leaderboard__player-cell')?.getAttribute('scope')).toBe('row');
    expect(firstRow?.querySelector('.leaderboard__games')?.textContent).toBe('120');
    expect(firstRow?.querySelector('.leaderboard__score-full')?.textContent).toBe('94,250');
    expect(firstRow?.querySelector('.leaderboard__score-short')?.textContent).toBe('94.2K');
    expect(
      firstRow?.querySelector('.leaderboard__streak')?.querySelector('.leaderboard__long')
        ?.textContent,
    ).toBe('7 days');
    expect(
      firstRow?.querySelector('.leaderboard__streak')?.querySelector('.leaderboard__short')
        ?.textContent,
    ).toBe('7d');
    expect(firstRow?.querySelector('.leaderboard__badge')?.textContent).toBe('Chess');

    expect(secondRow?.querySelector('.leaderboard__rank')?.textContent).toBe('#2');
    expect(secondRow?.querySelector('.leaderboard__name')?.textContent).toBe('Taylor');

    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'Alex Morgan', initials: 'AM' },
    { name: 'AlexMorgan', initials: 'AM' },
    { name: 'alex_morgan', initials: 'AM' },
    { name: 'alex-morgan', initials: 'AM' },
    { name: 'alice', initials: 'AL' },
    { name: 'A', initials: 'A' },
    { name: ' \t ', initials: '?' },
  ])('renders initials $initials for $name', async ({ name, initials }) => {
    mocks.getLeaderboardPlayers.mockResolvedValueOnce([{ ...player, playerName: name }]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    expect(element.querySelector('.leaderboard__avatar')?.textContent).toBe(initials);
  });

  it('renders player and favorite game names safely as text', async () => {
    const playerName = '<img src=x onerror=alert(1)>';
    const favoriteGameName = '<script>alert(1)</script>';

    mocks.getLeaderboardPlayers.mockResolvedValueOnce([
      { ...player, playerName, favoriteGameName },
    ]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    expect(element.querySelector('.leaderboard__name')?.textContent).toBe(playerName);
    expect(element.querySelector('.leaderboard__badge')?.textContent).toBe(favoriteGameName);
    expect(element.querySelectorAll(':scope tbody img')).toHaveLength(0);
    expect(element.querySelectorAll(':scope tbody script')).toHaveLength(0);
  });

  it('shows an empty state when the API returns no players', async () => {
    mocks.getLeaderboardPlayers.mockResolvedValueOnce([]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    expect(wrapper.querySelector('.feedback-state--empty')?.textContent).toBe(
      'No players available.',
    );
    expect(element.querySelector('.leaderboard__table')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('shows an error and recovers after an explicit retry', async () => {
    mocks.getLeaderboardPlayers
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce([player]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    expect(wrapper.querySelector('.feedback-state--error')?.textContent).toContain(
      'Could not load top players.',
    );
    expect(mocks.getLeaderboardPlayers).toHaveBeenCalledOnce();
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Failed to load top players.', 'error');

    getRetryButton(element).click();
    await waitUntilIdle(wrapper);

    expect(getRows(element)).toHaveLength(1);
    expect(wrapper.querySelector('.feedback-state--error')).toBeNull();
    expect(mocks.getLeaderboardPlayers).toHaveBeenCalledTimes(2);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Top players loaded successfully.', 'success');
  });

  it('aborts an older retry and ignores its late response', async () => {
    const pending = createDeferred<readonly LeaderboardPlayer[]>();

    mocks.getLeaderboardPlayers
      .mockRejectedValueOnce(new TypeError('Initial failure'))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce([{ ...player, playerName: 'Taylor' }]);

    const { element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    const retry = getRetryButton(element);

    retry.click();

    const oldSignal = mocks.getLeaderboardPlayers.mock.calls[1]?.[0];

    retry.click();
    await waitUntilIdle(wrapper);

    expect(oldSignal?.aborted).toBe(true);
    expect(element.querySelector('.leaderboard__name')?.textContent).toBe('Taylor');

    pending.completion.resolve?.([player]);
    await pending.promise;

    expect(getRows(element)).toHaveLength(1);
    expect(element.querySelector('.leaderboard__name')?.textContent).toBe('Taylor');
    expect(mocks.getLeaderboardPlayers).toHaveBeenCalledTimes(3);
    expect(mocks.showSnackbar).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending request and ignores success after destruction', async () => {
    const pending = createDeferred<readonly LeaderboardPlayer[]>();

    mocks.getLeaderboardPlayers.mockReturnValueOnce(pending.promise);

    const { leaderboard, element, wrapper } = createFixture();
    const skeleton = wrapper.querySelector('.feedback-skeleton');
    const signal = mocks.getLeaderboardPlayers.mock.calls[0]?.[0];

    leaderboard.destroy();

    expect(signal?.aborted).toBe(true);

    pending.completion.resolve?.([player]);
    await pending.promise;

    expect(wrapper.querySelector('.feedback-skeleton')).toBe(skeleton);
    expect(element.querySelector('.leaderboard__table')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('ignores a late request failure after destruction', async () => {
    const pending = createDeferred<readonly LeaderboardPlayer[]>();

    mocks.getLeaderboardPlayers.mockReturnValueOnce(pending.promise);

    const { leaderboard, wrapper } = createFixture();

    leaderboard.destroy();
    pending.completion.reject?.(new TypeError('Connection lost'));

    await expect(pending.promise).rejects.toThrow('Connection lost');

    expect(wrapper.querySelector('.feedback-state--error')).toBeNull();
    expect(mocks.showSnackbar).not.toHaveBeenCalled();
  });

  it('does not reload a destroyed leaderboard through an old retry button', async () => {
    mocks.getLeaderboardPlayers.mockRejectedValueOnce(new TypeError('Connection lost'));

    const { leaderboard, element, wrapper } = createFixture();

    await waitUntilIdle(wrapper);

    const retry = getRetryButton(element);

    leaderboard.destroy();
    retry.click();

    expect(mocks.getLeaderboardPlayers).toHaveBeenCalledOnce();
  });
});

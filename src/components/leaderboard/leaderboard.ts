import './leaderboard.scss';
import { getLeaderboardPlayers } from '../../services/api';
import { createEmptyState, createErrorState, createSkeleton } from '../feedback/feedback';
import { showSnackbar } from '../snackbar/snackbar';
interface Player {
  readonly rank: number;
  readonly name: string;
  readonly initials: string;
  readonly games: number;
  readonly score: number;
  readonly streak: number;
  readonly favorite: string;
}

function createText(text: string, className: string): HTMLSpanElement {
  const span: HTMLSpanElement = document.createElement('span');
  span.className = className;
  span.textContent = text;

  return span;
}

function createCell(className: string): HTMLTableCellElement {
  const cell: HTMLTableCellElement = document.createElement('td');
  cell.className = className;

  return cell;
}

function createPlayerRow(player: Player): HTMLTableRowElement {
  const row: HTMLTableRowElement = document.createElement('tr');

  const rank: HTMLTableCellElement = createCell('leaderboard__rank');
  rank.textContent = `#${player.rank}`;

  const nameCell: HTMLTableCellElement = document.createElement('th');
  nameCell.scope = 'row';
  nameCell.className = 'leaderboard__player-cell';

  const identity: HTMLDivElement = document.createElement('div');
  identity.className = 'leaderboard__identity';

  const avatar: HTMLSpanElement = createText(
    player.initials,
    `leaderboard__avatar leaderboard__avatar--${player.rank}`,
  );
  avatar.setAttribute('aria-hidden', 'true');

  const name: HTMLSpanElement = createText(player.name, 'leaderboard__name');
  name.title = player.name;

  identity.append(avatar, name);
  nameCell.append(identity);

  const games: HTMLTableCellElement = createCell('leaderboard__games');
  games.textContent = String(player.games);

  const score: HTMLTableCellElement = createCell('leaderboard__score');
  const fullScore: string = player.score.toLocaleString('en-US');

  // The mockup truncates 94,250 to 94.2K rather than rounding to 94.3K.
  const compactScore: string = `${(Math.trunc(player.score / 100) / 10).toFixed(1)}K`;

  score.append(
    createText(fullScore, 'leaderboard__score-full'),
    createText(compactScore, 'leaderboard__score-short'),
  );

  const streak: HTMLTableCellElement = createCell('leaderboard__streak');

  const flame: HTMLSpanElement = createText('🔥', 'leaderboard__flame');
  flame.setAttribute('aria-hidden', 'true');

  streak.append(
    flame,
    createText(`${player.streak} days`, 'leaderboard__long'),
    createText(`${player.streak}d`, 'leaderboard__short'),
  );

  const favorite: HTMLTableCellElement = createCell('leaderboard__favorite');
  favorite.append(createText(player.favorite, 'leaderboard__badge'));

  row.append(rank, nameCell, games, score, streak, favorite);

  return row;
}

function getPlayerInitials(name: string): string {
  const parts = name
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean);

  const initials =
    parts.length > 1
      ? parts
          .slice(0, 2)
          .map((part) => part.charAt(0))
          .join('')
      : (parts[0]?.slice(0, 2) ?? '?');

  return initials.toUpperCase();
}

export function createLeaderboard(): { element: HTMLElement; destroy: () => void } {
  const section = document.createElement('section');
  section.className = 'leaderboard';
  section.setAttribute('aria-labelledby', 'leaderboard-title');

  const title = document.createElement('h2');
  title.id = 'leaderboard-title';
  title.className = 'leaderboard__title';

  const titleText = document.createElement('span');
  titleText.append('Top Players', createText(' This Week', 'leaderboard__title-extra'));
  title.append(titleText);

  const wrapper = document.createElement('div');
  wrapper.className = 'leaderboard__wrapper';

  const table = document.createElement('table');
  table.className = 'leaderboard__table';
  table.setAttribute('aria-labelledby', title.id);

  const head = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const columns: readonly [string, string, string][] = [
    ['Rank', 'Rank', 'rank'],
    ['Player', 'Player', 'player-cell'],
    ['Games Played', 'Games', 'games'],
    ['Total Score', 'Score', 'score'],
    ['Streak', 'Streak', 'streak'],
    ['Favorite Game', 'Favorite Game', 'favorite'],
  ];

  for (const [fullLabel, shortLabel, className] of columns) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.className = `leaderboard__${className}`;
    cell.append(
      createText(fullLabel, 'leaderboard__long'),
      createText(shortLabel, 'leaderboard__short'),
    );
    headerRow.append(cell);
  }

  head.append(headerRow);

  const body = document.createElement('tbody');
  table.append(head, body);
  section.append(title, wrapper);

  let request: AbortController | undefined;
  let isDestroyed = false;
  let hasFailed = false;

  async function loadPlayers(): Promise<void> {
    if (isDestroyed) {
      return;
    }

    request?.abort();
    body.replaceChildren();

    wrapper.setAttribute('aria-busy', 'true');
    wrapper.replaceChildren(createSkeleton('Loading top players'));

    const controller = new AbortController();
    request = controller;

    try {
      const players = await getLeaderboardPlayers(controller.signal);

      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      if (players.length === 0) {
        wrapper.replaceChildren(createEmptyState('No players available.'));
      } else {
        for (const player of players) {
          body.append(
            createPlayerRow({
              rank: player.rank,
              name: player.playerName,
              initials: getPlayerInitials(player.playerName),
              games: player.gamesPlayed,
              score: player.totalScore,
              streak: player.streakDays,
              favorite: player.favoriteGameName,
            }),
          );
        }

        wrapper.replaceChildren(table);
      }

      if (hasFailed) {
        showSnackbar('Top players loaded successfully.', 'success');
        hasFailed = false;
      }
    } catch {
      if (isDestroyed || controller.signal.aborted) {
        return;
      }

      wrapper.replaceChildren(
        createErrorState('Could not load top players. Please try again.', (): void => {
          void loadPlayers();
        }),
      );

      hasFailed = true;
      showSnackbar('Failed to load top players.', 'error');
    } finally {
      if (request === controller && !isDestroyed) {
        wrapper.setAttribute('aria-busy', 'false');
      }
    }
  }

  void loadPlayers();

  return {
    element: section,
    destroy: (): void => {
      isDestroyed = true;
      request?.abort();
    },
  };
}

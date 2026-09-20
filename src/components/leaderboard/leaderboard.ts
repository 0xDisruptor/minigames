import './leaderboard.scss';

interface Player {
  readonly rank: number;
  readonly name: string;
  readonly initials: string;
  readonly games: number;
  readonly score: number;
  readonly streak: number;
  readonly favorite: string;
}

const players: readonly Player[] = [
  {
    rank: 1,
    name: 'Alex_Pro99',
    initials: 'AP',
    games: 142,
    score: 94_250,
    streak: 12,
    favorite: 'Heartopia',
  },
  {
    rank: 2,
    name: 'CozyGamer_x',
    initials: 'CG',
    games: 118,
    score: 81_400,
    streak: 8,
    favorite: 'Cat Mail Co.',
  },
  {
    rank: 3,
    name: 'MatchMaster',
    initials: 'MM',
    games: 98,
    score: 72_110,
    streak: 5,
    favorite: 'Tiny Glade',
  },
  {
    rank: 4,
    name: 'BubblePop',
    initials: 'BP',
    games: 87,
    score: 65_900,
    streak: 3,
    favorite: 'Whisper of the House',
  },
  {
    rank: 5,
    name: 'SudokuGod',
    initials: 'SG',
    games: 74,
    score: 59_320,
    streak: 2,
    favorite: 'Cat Chess',
  },
];

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

export function createLeaderboard(): HTMLElement {
  const section: HTMLElement = document.createElement('section');
  section.className = 'leaderboard';
  section.setAttribute('aria-labelledby', 'leaderboard-title');

  const title: HTMLHeadingElement = document.createElement('h2');
  title.id = 'leaderboard-title';
  title.className = 'leaderboard__title';

  const titleText: HTMLSpanElement = document.createElement('span');
  titleText.append('Top Players', createText(' This Week', 'leaderboard__title-extra'));
  title.append(titleText);

  const wrapper: HTMLDivElement = document.createElement('div');
  wrapper.className = 'leaderboard__wrapper';

  const table: HTMLTableElement = document.createElement('table');
  table.className = 'leaderboard__table';
  table.setAttribute('aria-labelledby', title.id);

  const head: HTMLTableSectionElement = document.createElement('thead');
  const headerRow: HTMLTableRowElement = document.createElement('tr');

  const columns: readonly [string, string, string][] = [
    ['Rank', 'Rank', 'rank'],
    ['Player', 'Player', 'player-cell'],
    ['Games Played', 'Games', 'games'],
    ['Total Score', 'Score', 'score'],
    ['Streak', 'Streak', 'streak'],
    ['Favorite Game', 'Favorite Game', 'favorite'],
  ];

  for (const [fullLabel, shortLabel, className] of columns) {
    const cell: HTMLTableCellElement = document.createElement('th');
    cell.scope = 'col';
    cell.className = `leaderboard__${className}`;
    cell.append(
      createText(fullLabel, 'leaderboard__long'),
      createText(shortLabel, 'leaderboard__short'),
    );
    headerRow.append(cell);
  }

  head.append(headerRow);

  const body: HTMLTableSectionElement = document.createElement('tbody');

  for (const player of players) {
    body.append(createPlayerRow(player));
  }

  table.append(head, body);
  wrapper.append(table);
  section.append(title, wrapper);

  return section;
}

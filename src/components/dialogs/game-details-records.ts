import './game-details-records.scss';

const records = [
  { medal: '🥇', name: 'ForestSpirit', score: '356,700 pts', ago: '2 days ago' },
  { medal: '🥈', name: 'TeaBrewer', score: '332,400pts', ago: '5 days ago' },
  { medal: '🥉', name: 'HerbalistPath', score: '308,900 pts', ago: '1 week ago' },
];

export function createGameDetailsRecords(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'game-records';
  section.setAttribute('aria-labelledby', 'game-records-title');

  const heading = document.createElement('h3');
  heading.id = 'game-records-title';
  heading.className = 'game-records__title';

  const trophy = document.createElement('span');
  trophy.textContent = '🏆';
  trophy.setAttribute('aria-hidden', 'true');

  heading.append(trophy, document.createTextNode('Top Records'));

  const list = document.createElement('ol');
  list.className = 'game-records__list';

  for (const record of records) {
    const item = document.createElement('li');
    item.className = 'game-records__item';

    const medal = document.createElement('span');
    medal.className = 'game-records__medal';
    medal.textContent = record.medal;
    medal.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'game-records__name';
    name.textContent = record.name;

    const score = document.createElement('span');
    score.className = 'game-records__score';
    score.textContent = record.score;

    const ago = document.createElement('span');
    ago.className = 'game-records__ago';
    ago.textContent = record.ago;

    item.append(medal, name, score, ago);
    list.append(item);
  }

  section.append(heading, list);

  return section;
}

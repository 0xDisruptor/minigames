import './game-details-records.scss';
import type { GameRecord } from '../../services/api';
import { createEmptyState } from '../feedback/feedback';

export function createGameDetailsRecords(records: readonly GameRecord[]): HTMLElement {
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
  section.append(heading);

  if (records.length === 0) {
    section.append(createEmptyState('No records yet.'));
    return section;
  }

  const list = document.createElement('ol');
  list.className = 'game-records__list';

  const scoreFormatter = new Intl.NumberFormat('en');
  const dateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  });

  for (const record of records) {
    const item = document.createElement('li');
    item.className = 'game-records__item';

    const medal = document.createElement('span');
    medal.className = 'game-records__medal';
    medal.textContent = ['🥇', '🥈', '🥉'][record.position - 1] ?? String(record.position);
    medal.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'game-records__name';
    name.textContent = record.playerName;

    const score = document.createElement('span');
    score.className = 'game-records__score';
    score.textContent = `${scoreFormatter.format(record.score)} pts`;

    const date = document.createElement('time');
    date.className = 'game-records__ago';
    date.dateTime = record.achievedAt;
    date.textContent = dateFormatter.format(new Date(record.achievedAt));

    item.append(medal, name, score, date);
    list.append(item);
  }

  section.append(list);
  return section;
}

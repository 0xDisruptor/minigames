import './not-found-page.scss';
import { getPageUrl } from '../../app/navigation';

export function createNotFoundPage(): HTMLElement {
  const main = document.createElement('main');
  main.className = 'not-found-page';
  main.setAttribute('aria-labelledby', 'not-found-title');

  const code = document.createElement('p');
  code.className = 'not-found-page__code';
  code.textContent = '404';

  const title = document.createElement('h1');
  title.id = 'not-found-title';
  title.className = 'not-found-page__title';
  title.textContent = 'Page not found';

  const description = document.createElement('p');
  description.className = 'not-found-page__description';
  description.textContent = 'The requested page does not exist.';

  const homeLink = document.createElement('a');
  homeLink.className = 'not-found-page__button';
  homeLink.href = getPageUrl('/');
  homeLink.textContent = 'Return to Home Page';

  main.append(code, title, description, homeLink);

  return main;
}

import './developer-cta.scss';
import developerImageUrl from '../../assets/images/developer.png';
import uploadIconUrl from '../../assets/icons/upload.svg';

export function createDeveloperCta(): HTMLElement {
  const section: HTMLElement = document.createElement('section');
  section.className = 'developer-cta';
  section.setAttribute('aria-labelledby', 'developer-title');

  const image: HTMLImageElement = document.createElement('img');
  image.className = 'developer-cta__image';
  image.src = developerImageUrl;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';

  const content: HTMLDivElement = document.createElement('div');
  content.className = 'developer-cta__content';

  const title: HTMLHeadingElement = document.createElement('h2');
  title.id = 'developer-title';
  title.className = 'developer-cta__title';
  title.textContent = 'Are You a Game Developer?';

  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'developer-cta__description';
  description.textContent =
    "Want to see your game on MiniGames? We're always looking for fun, engaging mini games to add to our platform. Submit your game and reach thousands of players!";

  const button: HTMLButtonElement = document.createElement('button');
  button.className = 'developer-cta__button';
  button.type = 'button';

  const icon: HTMLImageElement = document.createElement('img');
  icon.className = 'developer-cta__icon';
  icon.src = uploadIconUrl;
  icon.alt = '';
  icon.width = 24;
  icon.height = 24;

  const buttonText: HTMLSpanElement = document.createElement('span');
  buttonText.textContent = 'Submit Form';

  button.append(icon, buttonText);

  const contact: HTMLParagraphElement = document.createElement('p');
  contact.className = 'developer-cta__contact';
  contact.textContent = 'or contact us at developers@minigames.com';

  content.append(title, description, button, contact);
  section.append(image, content);

  return section;
}

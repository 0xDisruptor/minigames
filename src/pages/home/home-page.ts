import './home-page.scss';
import heroBackgroundUrl from '../../assets/images/hero-background.png';

function createHero(): HTMLElement {
  const section: HTMLElement = document.createElement('section');
  section.className = 'hero';
  section.setAttribute('aria-labelledby', 'hero-title');

  const background: HTMLImageElement = document.createElement('img');
  background.className = 'hero__background';
  background.src = heroBackgroundUrl;
  background.alt = '';

  const content: HTMLDivElement = document.createElement('div');
  content.className = 'hero__content';

  const title: HTMLHeadingElement = document.createElement('h1');
  title.id = 'hero-title';
  title.className = 'hero__title';
  title.textContent = 'Take a Short Break & Have Fun';

  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'hero__description';

  const desktopText: HTMLSpanElement = document.createElement('span');
  desktopText.className = 'hero__description-full';
  desktopText.textContent =
    'Discover hundreds of curated casual mini-games. Play instantly in your browser — puzzle, match 3, farm, and board classics.';

  const mobileText: HTMLSpanElement = document.createElement('span');
  mobileText.className = 'hero__description-short';
  mobileText.textContent = 'Discover hundreds of curated casual mini-games right in your browser.';

  description.append(desktopText, mobileText);

  const button: HTMLButtonElement = document.createElement('button');
  button.className = 'hero__button';
  button.type = 'button';
  button.textContent = 'Browse Library';

  content.append(title, description, button);
  section.append(background, content);

  return section;
}

export function createHomePage(): HTMLElement {
  const main: HTMLElement = document.createElement('main');
  main.className = 'home-page';
  main.append(createHero());

  return main;
}

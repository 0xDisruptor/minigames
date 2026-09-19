import './home-page.scss';

export function createHomePage(): HTMLElement {
  const main: HTMLElement = document.createElement('main');
  main.className = 'home-page';

  const heading: HTMLHeadingElement = document.createElement('h1');
  heading.textContent = 'MiniGames';

  main.append(heading);

  return main;
}

import './library-page.scss';

export function createLibraryPage(): HTMLElement {
  const main: HTMLElement = document.createElement('main');
  main.className = 'library-page';

  const title: HTMLHeadingElement = document.createElement('h1');
  title.textContent = 'Library';

  main.append(title);

  return main;
}

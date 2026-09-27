import './pagination.scss';

export function createPagination(): HTMLElement {
  const totalPages = 4;
  let currentPage = 1;

  const navigation = document.createElement('nav');
  navigation.className = 'pagination';
  navigation.setAttribute('aria-label', 'Library pagination');

  function createArrow(symbol: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pagination__button pagination__arrow';
    button.setAttribute('aria-label', label);

    const icon = document.createElement('span');
    icon.textContent = symbol;
    icon.setAttribute('aria-hidden', 'true');

    button.append(icon);

    return button;
  }

  const previous = createArrow('‹', 'Previous page');
  const next = createArrow('›', 'Next page');

  const numbers = document.createElement('div');
  numbers.className = 'pagination__numbers';

  const pageButtons: HTMLButtonElement[] = [];

  function updatePagination(): void {
    previous.disabled = currentPage === 1;
    next.disabled = currentPage === totalPages;

    navigation.classList.toggle('pagination--last-page', currentPage === totalPages);

    for (const button of pageButtons) {
      const isCurrent = Number(button.dataset.page) === currentPage;

      button.setAttribute('aria-current', isCurrent ? 'page' : 'false');
    }
  }

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pagination__button';
    button.textContent = String(page);
    button.dataset.page = String(page);
    button.setAttribute('aria-label', `Page ${page}`);

    button.addEventListener('click', (): void => {
      currentPage = page;
      updatePagination();
    });

    pageButtons.push(button);
    numbers.append(button);
  }

  previous.addEventListener('click', (): void => {
    if (currentPage === 1) {
      return;
    }

    currentPage -= 1;
    updatePagination();
  });

  next.addEventListener('click', (): void => {
    if (currentPage === totalPages) {
      return;
    }

    currentPage += 1;
    updatePagination();
  });

  navigation.append(previous, numbers, next);
  updatePagination();

  return navigation;
}

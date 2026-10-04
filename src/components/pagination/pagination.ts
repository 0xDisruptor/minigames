import './pagination.scss';

export interface PaginationController {
  readonly element: HTMLElement;
  update: (page: number, totalPages: number) => void;
  setLoading: (isLoading: boolean) => void;
  destroy: () => void;
}

export function createPagination(onPageChange: (page: number) => void): PaginationController {
  let currentPage = 1;
  let totalPages = 1;
  let isLoading = false;

  const mobileQuery = matchMedia('(max-width: 600px)');

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

  function changePage(page: number): void {
    if (isLoading || page === currentPage || page < 1 || page > totalPages) {
      return;
    }

    onPageChange(page);
  }

  function render(): void {
    previous.disabled = isLoading || currentPage === 1;
    next.disabled = isLoading || currentPage === totalPages;
    navigation.setAttribute('aria-busy', String(isLoading));

    const visibleLimit = mobileQuery.matches ? 3 : 4;
    const visibleCount = Math.min(visibleLimit, totalPages);
    const firstPage = Math.max(
      1,
      Math.min(currentPage - Math.floor((visibleCount - 1) / 2), totalPages - visibleCount + 1),
    );

    numbers.replaceChildren();

    for (let offset = 0; offset < visibleCount; offset += 1) {
      const page = firstPage + offset;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pagination__button';
      button.textContent = String(page);
      button.dataset.page = String(page);
      button.disabled = isLoading;
      button.setAttribute('aria-label', `Page ${page}`);

      if (page === currentPage) {
        button.setAttribute('aria-current', 'page');
      }

      button.addEventListener('click', (): void => {
        changePage(page);
      });

      numbers.append(button);
    }
  }

  previous.addEventListener('click', (): void => {
    changePage(currentPage - 1);
  });

  next.addEventListener('click', (): void => {
    changePage(currentPage + 1);
  });

  mobileQuery.addEventListener('change', render);

  navigation.append(previous, numbers, next);
  render();

  return {
    element: navigation,

    update(page: number, pages: number): void {
      totalPages = Math.max(1, pages);
      currentPage = Math.min(Math.max(1, page), totalPages);
      render();
    },

    setLoading(isBusy: boolean): void {
      isLoading = isBusy;
      render();
    },

    destroy(): void {
      mobileQuery.removeEventListener('change', render);
    },
  };
}

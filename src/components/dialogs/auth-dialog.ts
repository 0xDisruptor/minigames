import './auth-dialog.scss';
import { createLoginForm } from './login-form';
import { createRegisterForm } from './register-form';

export type AuthMode = 'login' | 'register';

export type OpenAuth = (mode: AuthMode, trigger: HTMLElement) => void;

interface AuthDialog {
  readonly element: HTMLDialogElement;
  readonly open: OpenAuth;
}

const animationDuration: number = 180;

function getAnimationDuration(): number {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : animationDuration;
}

export function createAuthDialog(): AuthDialog {
  const dialog: HTMLDialogElement = document.createElement('dialog');
  dialog.className = 'auth-dialog';
  dialog.setAttribute('aria-label', 'Account access');

  const tabList: HTMLDivElement = document.createElement('div');
  tabList.className = 'auth-dialog__tabs';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', 'Login or registration');

  const modes: readonly AuthMode[] = ['login', 'register'];
  const tabs: Record<AuthMode, HTMLButtonElement> = {
    login: document.createElement('button'),
    register: document.createElement('button'),
  };
  const panels: Record<AuthMode, HTMLDivElement> = {
    login: document.createElement('div'),
    register: document.createElement('div'),
  };

  let activeMode: AuthMode = 'login';
  let isClosing: boolean = false;
  let restoreTarget: HTMLElement | undefined;

  function selectMode(mode: AuthMode, shouldFocusTab: boolean): void {
    if (isClosing) {
      return;
    }

    const hasChanged: boolean = mode !== activeMode;
    activeMode = mode;

    for (const current of modes) {
      const isSelected: boolean = current === mode;
      tabs[current].setAttribute('aria-selected', String(isSelected));
      tabs[current].tabIndex = isSelected ? 0 : -1;
      panels[current].hidden = !isSelected;
    }

    if (shouldFocusTab) {
      tabs[mode].focus({ preventScroll: true });
    }

    if (!hasChanged || !dialog.open) {
      return;
    }

    dialog.scrollTop = 0;
    panels[mode].animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: getAnimationDuration(),
        easing: 'ease-out',
      },
    );
  }

  const loginForm: HTMLFormElement = createLoginForm((): void => {
    selectMode('register', true);
  });
  const registerForm: HTMLFormElement = createRegisterForm((): void => {
    selectMode('login', true);
  });

  panels.login.append(loginForm);
  panels.register.append(registerForm);

  for (const mode of modes) {
    const tab: HTMLButtonElement = tabs[mode];
    tab.type = 'button';
    tab.id = `auth-tab-${mode}`;
    tab.className = 'auth-dialog__tab';
    tab.textContent = mode === 'login' ? 'Login' : 'Register';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `auth-panel-${mode}`);

    const panel: HTMLDivElement = panels[mode];
    panel.id = `auth-panel-${mode}`;
    panel.className = 'auth-dialog__panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);

    tab.addEventListener('click', (): void => {
      selectMode(mode, true);
    });

    tabList.append(tab);
  }

  tabList.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectMode(activeMode === 'login' ? 'register' : 'login', true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      selectMode(event.key === 'Home' ? 'login' : 'register', true);
    }
  });

  dialog.append(tabList, panels.login, panels.register);
  selectMode('login', false);

  async function closeDialog(): Promise<void> {
    if (isClosing || !dialog.open) {
      return;
    }

    isClosing = true;
    dialog.classList.add('is-closing');

    for (const animation of dialog.getAnimations()) {
      animation.cancel();
    }

    const animation: Animation = dialog.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: getAnimationDuration(),
      easing: 'ease-in',
      fill: 'forwards',
    });

    await animation.finished;
    dialog.close();
    animation.cancel();
  }

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    void closeDialog();
  });

  let hasStartedOnBackdrop: boolean = false;

  function isOutside(event: MouseEvent): boolean {
    const bounds: DOMRect = dialog.getBoundingClientRect();

    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  }

  dialog.addEventListener('pointerdown', (event: PointerEvent): void => {
    hasStartedOnBackdrop = event.target === dialog && isOutside(event);
  });

  dialog.addEventListener('click', (event: MouseEvent): void => {
    if (hasStartedOnBackdrop && event.target === dialog && isOutside(event)) {
      void closeDialog();
    }

    hasStartedOnBackdrop = false;
  });

  dialog.addEventListener('close', (): void => {
    isClosing = false;
    hasStartedOnBackdrop = false;
    dialog.classList.remove('is-closing');
    document.documentElement.classList.remove('has-open-auth');
    loginForm.reset();
    registerForm.reset();

    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    }
  });

  const open: OpenAuth = (mode: AuthMode, trigger: HTMLElement): void => {
    if (isClosing) {
      return;
    }

    selectMode(mode, false);

    if (!dialog.open) {
      restoreTarget = trigger;
      document.documentElement.classList.add('has-open-auth');
      dialog.showModal();
      dialog.scrollTop = 0;

      dialog.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: getAnimationDuration(),
        easing: 'ease-out',
      });
    }

    tabs[mode].focus({ preventScroll: true });
  };

  return { element: dialog, open };
}

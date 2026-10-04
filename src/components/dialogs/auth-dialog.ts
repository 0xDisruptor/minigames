import './auth-dialog.scss';
import { createLoginForm } from './login-form';
import { createRegisterForm } from './register-form';

export type AuthMode = 'login' | 'register';

export type OpenAuth = (mode: AuthMode, trigger?: HTMLElement) => void;

interface AuthDialog {
  readonly element: HTMLDialogElement;
  readonly open: OpenAuth;
  readonly close: () => void;
}

const animationDuration = 180;

function getAnimationDuration(): number {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : animationDuration;
}

export function createAuthDialog(
  onModeChange?: (mode: AuthMode) => void,
  onRequestClose?: () => void,
): AuthDialog {
  const dialog = document.createElement('dialog');
  dialog.className = 'auth-dialog';
  dialog.setAttribute('aria-label', 'Account access');

  const tabList = document.createElement('div');
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
  let restoreTarget: HTMLElement | undefined;
  let hasStartedOnBackdrop = false;

  function selectMode(mode: AuthMode, shouldFocusTab: boolean): void {
    const hasChanged = mode !== activeMode;
    activeMode = mode;

    for (const current of modes) {
      const isSelected = current === mode;
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

  function requestMode(mode: AuthMode): void {
    if (onModeChange) {
      onModeChange(mode);
      return;
    }

    selectMode(mode, true);
  }

  const loginForm = createLoginForm((): void => {
    requestMode('register');
  });

  const registerForm = createRegisterForm((): void => {
    requestMode('login');
  });

  panels.login.append(loginForm);
  panels.register.append(registerForm);

  for (const mode of modes) {
    const tab = tabs[mode];
    tab.type = 'button';
    tab.id = `auth-tab-${mode}`;
    tab.className = 'auth-dialog__tab';
    tab.textContent = mode === 'login' ? 'Login' : 'Register';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `auth-panel-${mode}`);

    const panel = panels[mode];
    panel.id = `auth-panel-${mode}`;
    panel.className = 'auth-dialog__panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);

    tab.addEventListener('click', (): void => {
      requestMode(mode);
    });

    tabList.append(tab);
  }

  tabList.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      requestMode(activeMode === 'login' ? 'register' : 'login');
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      requestMode(event.key === 'Home' ? 'login' : 'register');
    }
  });

  dialog.append(tabList, panels.login, panels.register);
  selectMode('login', false);

  function close(): void {
    if (!dialog.open) {
      return;
    }

    for (const animation of dialog.getAnimations()) {
      animation.cancel();
    }

    dialog.close();
    document.documentElement.classList.remove('has-open-auth');
  }

  function requestClose(): void {
    if (onRequestClose) {
      onRequestClose();
      return;
    }

    close();
  }

  dialog.addEventListener('cancel', (event: Event): void => {
    event.preventDefault();
    requestClose();
  });

  function isOutside(event: MouseEvent): boolean {
    const bounds = dialog.getBoundingClientRect();

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
      requestClose();
    }

    hasStartedOnBackdrop = false;
  });

  dialog.addEventListener('close', (): void => {
    if (dialog.open) {
      return;
    }

    hasStartedOnBackdrop = false;
    document.documentElement.classList.remove('has-open-auth');
    loginForm.reset();
    registerForm.reset();

    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    }

    restoreTarget = undefined;
  });

  const open: OpenAuth = (mode: AuthMode, trigger?: HTMLElement): void => {
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

  return { element: dialog, open, close };
}

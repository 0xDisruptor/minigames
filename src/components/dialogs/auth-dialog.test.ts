// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthDialog } from './auth-dialog';
import type { AuthMode } from './auth-dialog';
import type { LoginFormCallbacks } from './login-form';
import type { RegistrationFormCallbacks } from './register-form';

const formMocks = vi.hoisted(() => ({
  login: vi.fn<(onRegister: () => void, callbacks?: LoginFormCallbacks) => HTMLFormElement>(),
  registration:
    vi.fn<(onLogin: () => void, callbacks?: RegistrationFormCallbacks) => HTMLFormElement>(),
}));

vi.mock('./login-form', () => ({
  createLoginForm: formMocks.login,
}));

vi.mock('./register-form', () => ({
  createRegisterForm: formMocks.registration,
}));

function createMockForm(onSwitch: () => void): HTMLFormElement {
  const form = document.createElement('form');

  const input = document.createElement('input');
  input.name = 'test-field';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'test-switch';
  button.textContent = 'Switch mode';
  button.addEventListener('click', onSwitch);

  form.append(input, button);

  return form;
}

function createFixture(mode: AuthMode = 'login', shouldUseCallbacks = true) {
  const onModeChange = vi.fn();
  const onRequestClose = vi.fn();

  const authDialog = shouldUseCallbacks
    ? createAuthDialog(onModeChange, onRequestClose)
    : createAuthDialog();

  const element = authDialog.element;
  const cancelAnimation = vi.fn();
  const animation = { cancel: cancelAnimation } as unknown as Animation;

  element.showModal = vi.fn((): void => {
    element.open = true;
  });

  element.close = vi.fn((): void => {
    element.open = false;
    element.dispatchEvent(new Event('close'));
  });

  element.animate = vi.fn(() => animation);
  element.getAnimations = vi.fn(() => [animation]);
  element.getBoundingClientRect = vi.fn(() => new DOMRect(10, 10, 200, 200));

  for (const panel of element.querySelectorAll<HTMLDivElement>('.auth-dialog__panel')) {
    panel.animate = vi.fn(() => animation);
  }

  const trigger = document.createElement('button');
  trigger.textContent = 'Open Auth';

  document.body.append(trigger, element);
  trigger.focus();
  authDialog.open(mode, trigger);

  const otherMode: AuthMode = mode === 'login' ? 'register' : 'login';

  const currentTab = element.querySelector<HTMLButtonElement>(
    `#auth-tab-${mode}`,
  ) as HTMLButtonElement;

  const otherTab = element.querySelector<HTMLButtonElement>(
    `#auth-tab-${otherMode}`,
  ) as HTMLButtonElement;

  const currentPanel = element.querySelector<HTMLDivElement>(
    `#auth-panel-${mode}`,
  ) as HTMLDivElement;

  const otherPanel = element.querySelector<HTMLDivElement>(
    `#auth-panel-${otherMode}`,
  ) as HTMLDivElement;

  const form = currentPanel.querySelector<HTMLFormElement>('form') as HTMLFormElement;

  const input = form.querySelector<HTMLInputElement>('input') as HTMLInputElement;

  const switchButton = form.querySelector<HTMLButtonElement>('.test-switch') as HTMLButtonElement;

  const tabList = element.querySelector<HTMLDivElement>('[role="tablist"]') as HTMLDivElement;

  const callbacks =
    mode === 'login'
      ? formMocks.login.mock.calls[0]?.[1]
      : formMocks.registration.mock.calls[0]?.[1];

  const setPending = callbacks?.onPendingChange;

  if (!setPending) {
    throw new Error('Auth form pending callback is missing.');
  }

  return {
    authDialog,
    element,
    trigger,
    currentTab,
    otherTab,
    currentPanel,
    otherPanel,
    otherMode,
    form,
    input,
    switchButton,
    tabList,
    setPending,
    cancelAnimation,
    onModeChange,
    onRequestClose,
  };
}

function dispatchBackdropEvent(
  element: HTMLDialogElement,
  type: 'pointerdown' | 'click',
  coordinate = 0,
): void {
  element.dispatchEvent(
    new MouseEvent(type, {
      clientX: coordinate,
      clientY: coordinate,
      bubbles: true,
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();

  formMocks.login.mockImplementation(createMockForm);
  formMocks.registration.mockImplementation(createMockForm);

  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.classList.remove('has-open-auth');
});

describe('createAuthDialog', () => {
  it.each<AuthMode>(['login', 'register'])(
    'blocks closing and mode changes while %s is pending',
    (mode) => {
      const fixture = createFixture(mode);
      fixture.input.value = 'Keep this value';

      fixture.setPending(true);

      expect(fixture.element.getAttribute('aria-busy')).toBe('true');
      expect(fixture.currentTab.disabled).toBe(true);
      expect(fixture.otherTab.disabled).toBe(true);

      fixture.otherTab.dispatchEvent(new MouseEvent('click'));
      fixture.switchButton.dispatchEvent(new MouseEvent('click'));

      for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        const event = new KeyboardEvent('keydown', {
          key,
          cancelable: true,
        });

        fixture.tabList.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
      }

      fixture.authDialog.open(fixture.otherMode);

      expect(fixture.currentPanel.hidden).toBe(false);
      expect(fixture.otherPanel.hidden).toBe(true);
      expect(fixture.input.value).toBe('Keep this value');
      expect(fixture.onModeChange).not.toHaveBeenCalled();

      const cancelEvent = new Event('cancel', { cancelable: true });
      fixture.element.dispatchEvent(cancelEvent);

      expect(cancelEvent.defaultPrevented).toBe(true);

      dispatchBackdropEvent(fixture.element, 'pointerdown');
      dispatchBackdropEvent(fixture.element, 'click');

      fixture.authDialog.close();

      expect(fixture.onRequestClose).not.toHaveBeenCalled();
      expect(fixture.element.close).not.toHaveBeenCalled();
      expect(fixture.cancelAnimation).not.toHaveBeenCalled();
      expect(fixture.element.open).toBe(true);
      expect(document.documentElement.classList.contains('has-open-auth')).toBe(true);

      fixture.setPending(false);

      expect(fixture.element.getAttribute('aria-busy')).toBe('false');
      expect(fixture.currentTab.disabled).toBe(false);
      expect(fixture.otherTab.disabled).toBe(false);

      fixture.otherTab.click();

      expect(fixture.onModeChange).toHaveBeenCalledExactlyOnceWith(fixture.otherMode);

      fixture.element.dispatchEvent(new Event('cancel', { cancelable: true }));

      expect(fixture.onRequestClose).toHaveBeenCalledTimes(1);

      fixture.authDialog.close();

      expect(fixture.element.close).toHaveBeenCalledTimes(1);
      expect(fixture.cancelAnimation).toHaveBeenCalledTimes(1);
      expect(fixture.element.open).toBe(false);
    },
  );

  it('closes on Escape when idle and restores focus and form values', () => {
    const fixture = createFixture('login', false);
    fixture.input.value = 'Temporary value';

    const event = new Event('cancel', { cancelable: true });
    fixture.element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.element.open).toBe(false);
    expect(fixture.element.close).toHaveBeenCalledTimes(1);
    expect(fixture.input.value).toBe('');
    expect(document.activeElement).toBe(fixture.trigger);
    expect(document.documentElement.classList.contains('has-open-auth')).toBe(false);

    fixture.authDialog.close();

    expect(fixture.element.close).toHaveBeenCalledTimes(1);
  });

  it('requests closing only when both press and click are on the backdrop', () => {
    const fixture = createFixture();

    dispatchBackdropEvent(fixture.element, 'pointerdown', 50);
    dispatchBackdropEvent(fixture.element, 'click', 0);

    expect(fixture.onRequestClose).not.toHaveBeenCalled();

    dispatchBackdropEvent(fixture.element, 'pointerdown', 0);
    dispatchBackdropEvent(fixture.element, 'click', 50);

    expect(fixture.onRequestClose).not.toHaveBeenCalled();

    dispatchBackdropEvent(fixture.element, 'pointerdown', 0);
    dispatchBackdropEvent(fixture.element, 'click', 0);

    expect(fixture.onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('switches modes and resets the form when idle without callbacks', () => {
    const fixture = createFixture('login', false);
    fixture.input.value = 'Temporary value';

    fixture.otherTab.click();

    expect(fixture.currentPanel.hidden).toBe(true);
    expect(fixture.otherPanel.hidden).toBe(false);
    expect(fixture.currentTab.getAttribute('aria-selected')).toBe('false');
    expect(fixture.otherTab.getAttribute('aria-selected')).toBe('true');
    expect(fixture.input.value).toBe('');
    expect(document.activeElement).toBe(fixture.otherTab);
  });
});

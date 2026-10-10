export interface AuthFormPending {
  readonly isPending: () => boolean;
  readonly setPending: (shouldBePending: boolean) => void;
}

type AuthControl = HTMLInputElement | HTMLButtonElement;

export function createAuthFormPending(
  form: HTMLFormElement,
  isFormValid: () => boolean,
): AuthFormPending {
  let isPending = false;
  const previousDisabledStates = new Map<AuthControl, boolean>();

  form.setAttribute('aria-busy', 'false');

  function setPending(shouldBePending: boolean): void {
    if (shouldBePending === isPending) {
      return;
    }

    isPending = shouldBePending;
    form.setAttribute('aria-busy', String(isPending));

    if (isPending) {
      const controls = form.querySelectorAll<AuthControl>('input, button');

      for (const control of controls) {
        previousDisabledStates.set(control, control.disabled);
        control.disabled = true;
      }

      return;
    }

    for (const [control, wasDisabled] of previousDisabledStates) {
      control.disabled = wasDisabled;
    }

    previousDisabledStates.clear();
    isFormValid();
  }

  return {
    isPending: () => isPending,
    setPending,
  };
}

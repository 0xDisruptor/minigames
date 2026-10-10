import type { ValidationError } from '../../utils/auth-validation';

export interface AuthFieldRule {
  readonly id: string;
  readonly validate: (value: string) => ValidationError;
}

export function bindAuthFormValidation(
  form: HTMLFormElement,
  rules: readonly AuthFieldRule[],
): () => boolean {
  const submitElement = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  if (!submitElement) {
    throw new Error('Auth form submit button is missing.');
  }

  const submit: HTMLButtonElement = submitElement;

  const fields = rules.map((rule) => {
    const input = form.querySelector<HTMLInputElement>(`#${rule.id}`);
    const error = form.querySelector<HTMLParagraphElement>(`#${rule.id}-error`);

    if (!input || !error) {
      throw new Error(`Auth field markup is missing: ${rule.id}`);
    }

    return { input, error, validate: rule.validate };
  });

  const touched = new Set<HTMLInputElement>();

  function isFormValid(): boolean {
    let isValid = true;

    for (const field of fields) {
      const message = field.validate(field.input.value);
      const displayedError = touched.has(field.input) ? message : undefined;

      field.error.textContent = displayedError ?? '';
      field.error.hidden = displayedError === undefined;
      field.input.setAttribute('aria-invalid', String(displayedError !== undefined));

      isValid = message === undefined && isValid;
    }

    submit.disabled = !isValid;

    return isValid;
  }

  for (const field of fields) {
    for (const eventName of ['input', 'change', 'blur']) {
      field.input.addEventListener(eventName, (): void => {
        touched.add(field.input);
        isFormValid();
      });
    }
  }

  form.addEventListener('submit', (event: SubmitEvent): void => {
    for (const field of fields) {
      touched.add(field.input);
    }

    if (!isFormValid()) {
      event.preventDefault();
    }
  });

  form.addEventListener('reset', (): void => {
    touched.clear();
    queueMicrotask(isFormValid);
  });

  isFormValid();

  return isFormValid;
}

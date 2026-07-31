export interface RetryableLauncherOptions {
  button: HTMLButtonElement;
  mount: () => Promise<unknown>;
  idleLabel: string;
  retryLabel: string;
  retryAriaLabel?: string;
}

export function createRetryableLoader<T>(importModule: () => Promise<T>) {
  let pending: Promise<T> | undefined;

  return () => {
    pending ??= importModule().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}

export function attachRetryableLauncher({
  button,
  mount,
  idleLabel,
  retryLabel,
  retryAriaLabel,
}: RetryableLauncherOptions): () => void {
  let mounting = false;

  const handleClick = async () => {
    if (mounting) return;
    mounting = true;
    button.disabled = true;

    try {
      await mount();
      button.remove();
    } catch {
      mounting = false;
      button.disabled = false;
      button.textContent = retryLabel;
      button.setAttribute('aria-label', retryAriaLabel ?? retryLabel);
    }
  };

  button.textContent = idleLabel;
  button.addEventListener('click', handleClick);
  return () => button.removeEventListener('click', handleClick);
}

export const MINIMUM_AUTOMATED_RESPONSE_MS = 2_000;

export function waitForMinimumResponseDelay(
  startedAt: number,
  minimumDuration = MINIMUM_AUTOMATED_RESPONSE_MS,
  now = Date.now(),
): Promise<void> {
  const remaining = Math.max(0, minimumDuration - (now - startedAt));
  if (remaining === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, remaining));
}

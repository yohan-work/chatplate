import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MINIMUM_AUTOMATED_RESPONSE_MS,
  waitForMinimumResponseDelay,
} from './minimumResponseDelay';

describe('waitForMinimumResponseDelay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits only for the remainder of the minimum display time', async () => {
    vi.useFakeTimers();
    let resolved = false;
    const pending = waitForMinimumResponseDelay(1_000, MINIMUM_AUTOMATED_RESPONSE_MS, 1_500)
      .then(() => {
        resolved = true;
      });

    await vi.advanceTimersByTimeAsync(1_499);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(resolved).toBe(true);
  });

  it('adds no delay when processing already exceeded the minimum', async () => {
    await expect(waitForMinimumResponseDelay(1_000, MINIMUM_AUTOMATED_RESPONSE_MS, 3_001))
      .resolves.toBeUndefined();
  });
});

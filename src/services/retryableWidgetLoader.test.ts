// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { attachRetryableLauncher, createRetryableLoader } from './retryableWidgetLoader';

afterEach(() => {
  document.body.replaceChildren();
});

describe('createRetryableLoader', () => {
  it('deduplicates an active import and retries after rejection', async () => {
    const importModule = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValue({ init: true });
    const load = createRetryableLoader(importModule);

    await expect(load()).rejects.toThrow('network failure');
    await expect(load()).resolves.toEqual({ init: true });
    await expect(load()).resolves.toEqual({ init: true });

    expect(importModule).toHaveBeenCalledTimes(2);
  });
});

describe('attachRetryableLauncher', () => {
  it('keeps the launcher usable after a failed mount', async () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    const mount = vi.fn()
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValue(undefined);

    attachRetryableLauncher({
      button,
      mount,
      idleLabel: '상담',
      retryLabel: '다시 시도',
      retryAriaLabel: '상담 채팅 다시 시도',
    });

    button.click();
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(button.textContent).toBe('다시 시도');
    expect(button.getAttribute('aria-label')).toBe('상담 채팅 다시 시도');

    button.click();
    await waitFor(() => expect(button.isConnected).toBe(false));
    expect(mount).toHaveBeenCalledTimes(2);
  });
});


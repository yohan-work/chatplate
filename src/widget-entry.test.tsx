// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerApp } from './app/CustomerApp';
import { botConfigs } from './data/bots';
import { init } from './widget-entry';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.replaceChildren();
});

describe('public widget lifecycle', () => {
  it('links launcher and dialog, traps focus, emits transitions, and restores focus', async () => {
    const user = userEvent.setup();
    const target = document.createElement('div');
    document.body.appendChild(target);
    const onEvent = vi.fn();
    const mounted = init({ target, config: botConfigs['coach-myway'], onEvent });

    const launcher = await screen.findByRole('button', { name: '챗봇 열기' });
    const widgetId = launcher.getAttribute('aria-controls');
    const dialog = document.getElementById(widgetId ?? '');
    expect(widgetId).toBeTruthy();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(dialog?.hasAttribute('inert')).toBe(true);

    await user.click(launcher);
    await waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('true'));
    expect(dialog?.hasAttribute('inert')).toBe(false);
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);

    const dialogButtons = within(dialog as HTMLElement).getAllByRole('button');
    const firstButton = dialogButtons[0];
    const lastButton = dialogButtons[dialogButtons.length - 1];
    lastButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(firstButton);

    await user.click(within(dialog as HTMLElement).getByRole('button', { name: '챗봇 닫기' }));
    await waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(launcher);

    await user.click(launcher);
    await waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('true'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(launcher.getAttribute('aria-expanded')).toBe('false'));
    expect(document.activeElement).toBe(launcher);
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'open')).toHaveLength(2);
    expect(onEvent.mock.calls.filter(([event]) => event.type === 'close')).toHaveLength(2);

    mounted.destroy();
    expect(target.childElementCount).toBe(0);
    expect(target.isConnected).toBe(true);
  });

  it('replaces an existing widget on the same target and keeps destroy idempotent', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const first = init({ target, config: botConfigs['coach-myway'] });
    const second = init({ target, config: botConfigs['coach-myway'] });

    await waitFor(() => expect(target.querySelectorAll('.chatplate-launcher')).toHaveLength(1));
    first.destroy();
    expect(target.querySelectorAll('.chatplate-launcher')).toHaveLength(1);

    second.destroy();
    second.destroy();
    expect(target.childElementCount).toBe(0);
    expect(target.isConnected).toBe(true);
  });

  it('removes an auto-created container on destroy', async () => {
    const mounted = init({ config: botConfigs['coach-myway'] });
    await screen.findByRole('button', { name: '챗봇 열기' });

    mounted.destroy();
    expect(mounted.container.isConnected).toBe(false);
  });

  it('keeps the page variant as a non-modal region', async () => {
    render(<CustomerApp />);
    const region = await screen.findByRole('region', { name: /챗봇 위젯/ });

    expect(region.hasAttribute('inert')).toBe(false);
    expect(region.hasAttribute('aria-modal')).toBe(false);
    expect(region.hasAttribute('tabindex')).toBe(false);
  });
});

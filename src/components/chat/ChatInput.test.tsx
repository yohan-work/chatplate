// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

afterEach(cleanup);

describe('ChatInput', () => {
  it('submits trimmed text with Enter without exposing a fake attachment action', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput placeholder="메시지를 입력하세요." onSubmit={onSubmit} />);

    expect(screen.queryByRole('button', { name: '파일 첨부' })).toBeNull();
    const textarea = screen.getByPlaceholderText('메시지를 입력하세요.');
    await user.type(textarea, '  문의 내용  ');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('문의 내용');
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps Shift+Enter as a line break', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ChatInput placeholder="메시지를 입력하세요." onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText('메시지를 입력하세요.');
    await user.type(textarea, '첫 줄');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('첫 줄\n');
  });
});

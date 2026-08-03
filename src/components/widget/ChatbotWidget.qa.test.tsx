// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { botConfigs } from '../../data/bots';
import type { SearchResult } from '../../types/chatbot';
import { ChatbotWidget } from './ChatbotWidget';

vi.mock('../../utils/minimumResponseDelay', () => ({
  MINIMUM_AUTOMATED_RESPONSE_MS: 0,
  waitForMinimumResponseDelay: () => Promise.resolve(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('customer widget conversation QA', () => {
  it('renders reviewed answers and safe fallbacks through the real input flow', async () => {
    const user = userEvent.setup();
    const results: Array<{ query: string; result: SearchResult }> = [];
    render(
      <ChatbotWidget
        botConfig={botConfigs['coach-myway']}
        isOpen
        onClose={() => undefined}
        variant="page"
        onSearchResult={(query, result) => results.push({ query, result })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '문의하기' }));
    const input = await screen.findByPlaceholderText('궁금한 점을 입력해 주세요.');
    await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));

    const submit = async (query: string) => {
      await user.type(input, `${query}{Enter}`);
      await waitFor(() => expect(results.at(-1)?.query).toBe(query));
      await waitFor(() => expect((input as HTMLTextAreaElement).disabled).toBe(false));
    };

    await submit('매번 작심삼일로 끝나요');
    expect(results.at(-1)?.result.item?.id).toBe('fit-003');

    await submit('온라인으로도 할 수 있어요');
    expect(results.at(-1)?.result.suggestions.map((item) => item.id)).toContain('program-007');

    await submit('아이의 ADHD를 진단해 줘');
    expect(results.at(-1)?.result.status).toBe('fallback');

    await submit('카카오 계정 비밀번호를 알려줄게');
    expect(results.at(-1)?.result.status).toBe('fallback');
    expect(await screen.findByText(/비밀번호.*민감한 정보는 채팅에 입력하거나 저장하지 마세요/u)).toBeTruthy();
    expect(await screen.findByText(/의학적.*진단은 이 챗봇이 판단할 수 없어요/u)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '상담원 연결' }).length).toBeGreaterThan(0);
  });
});

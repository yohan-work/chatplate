import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import {
  evaluateConversationScenarios,
  type ConversationScenario,
} from './evaluateConversationScenarios';

const scenarios: ConversationScenario[] = [
  {
    id: 'coach-intro-to-location',
    botId: 'coach-myway',
    turns: [
      { query: '코치 마이:웨이는 어떤 곳인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-001'] },
      { query: '위치가 어디?', expectedMode: 'standalone', expectedKnowledgeIds: ['location-001'], forbiddenKnowledgeIds: ['intro-001'] },
    ],
  },
  {
    id: 'coach-fit-to-price',
    botId: 'coach-myway',
    turns: [
      { query: '우리 아이에게 맞을지 궁금해요', expectedMode: 'standalone', expectedKnowledgeIds: ['consultation-002'] },
      { query: '비용이 궁금해요', expectedMode: 'standalone', expectedKnowledgeIds: ['policy-001'], forbiddenKnowledgeIds: ['consultation-002'] },
    ],
  },
  {
    id: 'coach-intro-to-academy-comparison',
    botId: 'coach-myway',
    turns: [
      { query: '코치 마이:웨이는 어떤 곳인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-001'] },
      { query: '일반 학원이랑 차이', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-002'], forbiddenKnowledgeIds: ['intro-001'] },
    ],
  },
  {
    id: 'coach-method-to-subjects',
    botId: 'coach-myway',
    turns: [
      { query: '코칭은 어떻게 진행되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['program-001'] },
      { query: '어떤 학년과 과목을 코칭하나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['program-002'], forbiddenKnowledgeIds: ['program-001'] },
    ],
  },
  {
    id: 'coach-consultation-to-hours',
    botId: 'coach-myway',
    turns: [
      { query: '상담은 어떻게 신청하나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['consultation-001'] },
      { query: '상담 가능한 시간은 언제인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['hours-001'], forbiddenKnowledgeIds: ['consultation-001'] },
    ],
  },
  {
    id: 'coach-method-to-online',
    botId: 'coach-myway',
    turns: [
      { query: '코칭은 어떻게 진행되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['program-001'] },
      { query: '온라인 수업', expectedMode: 'standalone', expectedKnowledgeIds: ['program-007'], forbiddenKnowledgeIds: ['program-001'] },
    ],
  },
  {
    id: 'coach-intro-to-tutoring-comparison',
    botId: 'coach-myway',
    turns: [
      { query: '코치 마이:웨이는 어떤 곳인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-001'] },
      { query: '과외랑 다른가요', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-003'], forbiddenKnowledgeIds: ['intro-001'] },
    ],
  },
  {
    id: 'coach-elliptical-method',
    botId: 'coach-myway',
    turns: [
      { query: '우리 아이에게 맞을지 궁금해요', expectedMode: 'standalone', expectedKnowledgeIds: ['consultation-002'] },
      { query: '그건 어떻게 진행돼요?', expectedMode: 'clarification', expectedKnowledgeIds: ['consultation-004', 'program-001'] },
    ],
  },
  {
    id: 'coach-method-to-frequency',
    botId: 'coach-myway',
    turns: [
      { query: '코칭은 어떻게 진행되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['program-001'] },
      { query: '주 몇 회인가요', expectedMode: 'standalone', expectedKnowledgeIds: ['program-005'], forbiddenKnowledgeIds: ['program-001'] },
    ],
  },
  {
    id: 'coach-bare-reference',
    botId: 'coach-myway',
    turns: [
      { query: '비용이 궁금해요', expectedMode: 'standalone', expectedKnowledgeIds: ['policy-001'] },
      { query: '그건?', expectedMode: 'contextual', expectedKnowledgeIds: ['policy-001'] },
    ],
  },
  {
    id: 'coach-intro-to-target',
    botId: 'coach-myway',
    turns: [
      { query: '코치 마이:웨이는 어떤 곳인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-001'] },
      { query: '중학생 대상인가요', expectedMode: 'standalone', expectedKnowledgeIds: ['fit-008'], forbiddenKnowledgeIds: ['intro-001'] },
    ],
  },
  {
    id: 'coach-unsupported-duration',
    botId: 'coach-myway',
    turns: [
      { query: '코칭은 어떻게 진행되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['program-001'] },
      {
        query: '기간은 얼마나 돼?',
        expectedMode: 'clarification',
        expectedKnowledgeIds: ['policy-001', 'program-005'],
        forbiddenKnowledgeIds: ['program-001'],
      },
    ],
  },
  {
    id: 'animal-reservation-to-location',
    botId: 'animal-hospital',
    turns: [
      { query: '예약은 어떻게 하나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['reservation-001'] },
      { query: '주소 알려줘', expectedMode: 'standalone', expectedKnowledgeIds: ['location-001'], forbiddenKnowledgeIds: ['reservation-001'] },
    ],
  },
  {
    id: 'animal-location-to-hours',
    botId: 'animal-hospital',
    turns: [
      { query: '병원 위치가 어디인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['location-001'] },
      { query: '토요일 진료', expectedMode: 'standalone', expectedKnowledgeIds: ['hours-001'], forbiddenKnowledgeIds: ['location-001'] },
    ],
  },
  {
    id: 'animal-hours-to-vaccine',
    botId: 'animal-hospital',
    turns: [
      { query: '진료시간은 어떻게 되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['hours-001'] },
      { query: '백신 가격', expectedMode: 'standalone', expectedKnowledgeIds: ['vaccine-001'], forbiddenKnowledgeIds: ['hours-001'] },
    ],
  },
  {
    id: 'animal-vaccine-to-parking',
    botId: 'animal-hospital',
    turns: [
      { query: '예방접종 비용이 궁금해요', expectedMode: 'standalone', expectedKnowledgeIds: ['vaccine-001'] },
      { query: '무료 주차 되나요', expectedMode: 'standalone', expectedKnowledgeIds: ['parking-001'], forbiddenKnowledgeIds: ['vaccine-001'] },
    ],
  },
  {
    id: 'animal-bare-reference',
    botId: 'animal-hospital',
    turns: [
      { query: '주차 가능해요?', expectedMode: 'standalone', expectedKnowledgeIds: ['parking-001'] },
      { query: '그건?', expectedMode: 'clarification', expectedKnowledgeIds: ['parking-001'] },
    ],
  },
  {
    id: 'cafe-menu-to-location',
    botId: 'cafe',
    turns: [
      { query: '대표 메뉴가 무엇인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-menu-001'] },
      { query: '주소 알려줘', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-location-001'], forbiddenKnowledgeIds: ['cafe-menu-001'] },
    ],
  },
  {
    id: 'cafe-location-to-hours',
    botId: 'cafe',
    turns: [
      { query: '매장 위치가 어디인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-location-001'] },
      { query: '몇 시까지 하나요', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-hours-001'], forbiddenKnowledgeIds: ['cafe-location-001'] },
    ],
  },
  {
    id: 'cafe-hours-to-menu',
    botId: 'cafe',
    turns: [
      { query: '영업시간이 어떻게 되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-hours-001'] },
      { query: '추천 메뉴', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-menu-001'], forbiddenKnowledgeIds: ['cafe-hours-001'] },
    ],
  },
  {
    id: 'cafe-menu-to-reservation',
    botId: 'cafe',
    turns: [
      { query: '대표 메뉴가 무엇인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-menu-001'] },
      { query: '자리 예약', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-reservation-001'], forbiddenKnowledgeIds: ['cafe-menu-001'] },
    ],
  },
  {
    id: 'cafe-bare-reference',
    botId: 'cafe',
    turns: [
      { query: '좌석 예약이 가능한가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-reservation-001'] },
      { query: '그건?', expectedMode: 'clarification', expectedKnowledgeIds: ['cafe-reservation-001'] },
    ],
  },
  {
    id: 'cafe-menu-to-season-duration',
    botId: 'cafe',
    turns: [
      { query: '대표 메뉴가 무엇인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-menu-001'] },
      { query: '시즌 메뉴 기간', expectedMode: 'standalone', expectedKnowledgeIds: ['cafe-season-001'], forbiddenKnowledgeIds: ['cafe-menu-001'] },
    ],
  },
  {
    id: 'law-reservation-to-fee',
    botId: 'law-office',
    turns: [
      { query: '상담 예약은 어떻게 하나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['law-reservation-001'] },
      { query: '상담료 알려주세요', expectedMode: 'standalone', expectedKnowledgeIds: ['law-fee-001'], forbiddenKnowledgeIds: ['law-reservation-001'] },
    ],
  },
  {
    id: 'law-fee-to-documents',
    botId: 'law-office',
    turns: [
      { query: '상담 비용이 얼마인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['law-fee-001'] },
      { query: '필요 자료', expectedMode: 'standalone', expectedKnowledgeIds: ['law-docs-001'], forbiddenKnowledgeIds: ['law-fee-001'] },
    ],
  },
  {
    id: 'law-documents-to-online',
    botId: 'law-office',
    turns: [
      { query: '준비서류가 있나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['law-docs-001'] },
      { query: '비대면 상담', expectedMode: 'standalone', expectedKnowledgeIds: ['law-online-001'], forbiddenKnowledgeIds: ['law-docs-001'] },
    ],
  },
  {
    id: 'law-online-to-privacy',
    botId: 'law-office',
    turns: [
      { query: '온라인 상담도 가능한가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['law-online-001'] },
      { query: '비밀 유지', expectedMode: 'standalone', expectedKnowledgeIds: ['law-privacy-001'], forbiddenKnowledgeIds: ['law-online-001'] },
    ],
  },
  {
    id: 'law-bare-reference',
    botId: 'law-office',
    turns: [
      { query: '상담 내용은 비밀 보장이 되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['law-privacy-001'] },
      { query: '그건?', expectedMode: 'clarification', expectedKnowledgeIds: ['law-privacy-001'] },
    ],
  },
  {
    id: 'alf-intro-to-install',
    botId: 'alf-demo',
    turns: [
      { query: 'ALF는 무엇인가요?', expectedMode: 'standalone', expectedKnowledgeIds: ['intro-001'] },
      { query: '설치 방법 알려줘', expectedMode: 'standalone', expectedKnowledgeIds: ['install-001'], forbiddenKnowledgeIds: ['intro-001'] },
    ],
  },
  {
    id: 'alf-install-to-theme',
    botId: 'alf-demo',
    turns: [
      { query: '설치는 어떻게 하나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['install-001'] },
      { query: '위젯 색 바꾸기', expectedMode: 'standalone', expectedKnowledgeIds: ['theme-001'], forbiddenKnowledgeIds: ['install-001'] },
    ],
  },
  {
    id: 'alf-theme-to-billing',
    botId: 'alf-demo',
    turns: [
      { query: '브랜드 색상은 바꿀 수 있나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['theme-001'] },
      { query: '가격 알려줘', expectedMode: 'standalone', expectedKnowledgeIds: ['billing-001'], forbiddenKnowledgeIds: ['theme-001'] },
    ],
  },
  {
    id: 'alf-billing-to-receipt',
    botId: 'alf-demo',
    turns: [
      { query: '요금제는 어떻게 되나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['billing-001'] },
      { query: '세금계산서 발행', expectedMode: 'standalone', expectedKnowledgeIds: ['billing-002'], forbiddenKnowledgeIds: ['billing-001'] },
    ],
  },
  {
    id: 'alf-bare-reference',
    botId: 'alf-demo',
    turns: [
      { query: '영수증은 어디서 받을 수 있나요?', expectedMode: 'standalone', expectedKnowledgeIds: ['billing-002'] },
      { query: '그건?', expectedMode: 'clarification', expectedKnowledgeIds: ['billing-002'] },
    ],
  },
];

describe('evaluateConversationScenarios', () => {
  it('keeps explicit new topics out of stale context across every bundled domain', () => {
    const metrics = evaluateConversationScenarios(botConfigs, scenarios);
    expect(metrics.scenarios).toBe(33);
    expect(metrics.samples).toBe(66);
    expect(metrics.routeAccuracy, JSON.stringify(metrics.failures, null, 2)).toBe(1);
    expect(metrics.knowledgeAccuracy, JSON.stringify(metrics.failures, null, 2)).toBe(1);
    expect(metrics.clarificationAccuracy, JSON.stringify(metrics.failures, null, 2)).toBe(1);
    expect(metrics.staleContextRepeatRate, JSON.stringify(metrics.failures, null, 2)).toBe(0);
    expect(metrics.failures).toEqual([]);
  });
});

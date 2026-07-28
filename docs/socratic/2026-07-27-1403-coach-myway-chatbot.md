# Socratic: 코치 마이:웨이 챗봇 초기 구축

- ID: 2026-07-27-1403-coach-myway-chatbot
- 상태: 완료
- 관련 Handoff: [2026-07-27-1403-coach-myway-chatbot](../handoff/2026-07-27-1403-coach-myway-chatbot.md)

## 질문과 확인된 사실

| 질문 | 답 | 상태 | 근거 |
| --- | --- | --- | --- |
| LLM 없이 FAQ 답변이 가능한가? | 가능하다. JSON `knowledge`를 검색·점수화해 답변 또는 fallback을 반환한다. | 확인됨 | `src/engine/searchKnowledge.ts`, `src/engine/rankKnowledge.ts` |
| 코치 마이:웨이의 초기 챗봇 이용자는 누구인가? | 학부모·학생이다. | 확인됨 | 사용자 결정 |
| 어떤 사실을 답변에 넣는가? | 대표 승인 자료와 사용자가 지정한 공식 블로그/공식 채널만 사용한다. | 확인됨 | 사용자 결정 |
| 미확인 운영 정보를 어떻게 처리하는가? | 가격·시간표·주소·환불·대상 과목은 확답하지 않고 상담 채널로 보낸다. | 확인됨 | 사용자 결정 및 `src/data/coach-myway.json` |
| fallback 상담 전환이 직접 채널을 열 수 있는가? | `handoff.channelId`가 지정되면 해당 연락 채널을 연다. | 확인됨 | `src/components/widget/ChatbotWidget.tsx` |

## 판단

- 확인됨: `coach-myway` config에 9개 초기 FAQ와 공식 블로그/상담 채널을 등록했다.
- 추론: Linktree는 공개적으로 노출된 카카오 채널 진입점이므로, 직접 카카오 URL이 제공되기 전의 안전한 임시 전환 주소로 사용했다.
- 미확인: 실제 카카오 `pf.kakao.com` 주소, 운영 시간, 지점·방문 정책, 대상 학년/과목, 가격 및 환불 규정.

## 다음 계획

1. 대표 승인 FAQ 패킷을 수령해 `src/data/coach-myway.json`의 상담 유도 답변을 확정 사실 답변으로 대체한다 — 의존성: 승인 자료 — 확인 방법: FAQ별 `source`와 `lastUpdated` 검토.
2. 실제 카카오 채널 URL을 받으면 `contactChannels`의 `kakao.value`만 교체한다 — 의존성: 공식 URL — 확인 방법: 위젯 handoff CTA 수동 클릭.
3. 운영 후 fallback·부정 피드백 로그를 검토해 별칭과 FAQ를 보강한다 — 의존성: 실제 대화 데이터 — 확인 방법: 관리자 검색 품질 화면 및 회귀 테스트 추가.

## 중단 또는 방향 전환 조건

- 대표가 실제 카카오 채널 대신 웹폼 또는 전화 상담을 우선 채널로 결정하면 `handoff.channelId`와 해당 버튼만 변경한다.
- 승인 자료가 현재의 보수적 안내와 충돌하면 승인 자료를 우선하고 관련 매칭 테스트를 갱신한다.

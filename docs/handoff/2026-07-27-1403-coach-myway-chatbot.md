# Handoff: 코치 마이:웨이 챗봇 초기 구축

- ID: 2026-07-27-1403-coach-myway-chatbot
- 상태: 완료
- 기록 시각: 2026-07-27 14:03 KST
- 관련 Socratic: [2026-07-27-1403-coach-myway-chatbot](../socratic/2026-07-27-1403-coach-myway-chatbot.md)

## 목표와 결과

- 목표: 코치 마이:웨이의 학부모·학생용 정적 FAQ 챗봇과 카카오 우선 상담 전환을 구축한다.
- 결과: `coach-myway` 봇과 9개 초기 FAQ를 등록했고, handoff CTA가 봇별 지정 연락 채널을 직접 열도록 구현했다.

## 변경 사항

- `src/data/coach-myway.json`: 보수적 FAQ, 출처·확인일, 공식 블로그·상담 채널, 카카오 우선 handoff를 추가했다.
- `src/types/chatbot.ts`, `src/components/widget/ChatbotWidget.tsx`: 봇별 `handoff` 설정과 연락 채널 직접 열기를 추가했다.
- `src/components/chat/ChatBubble.tsx`, `src/components/chat/ChatView.tsx`: bot별 CTA 라벨과 비-AI 입력 문구를 적용했다.
- `src/data/bots.ts`, `src/engine/searchKnowledge.test.ts`: 봇 등록과 코치 마이:웨이 검색 회귀 시나리오를 추가했다.

## 검증 증거

- `npm test` → 5개 테스트 파일, 19개 테스트 통과.
- `npm run build` → TypeScript 검사 및 관리자/위젯 production build 통과.
- `git diff --check` → 공백 오류 없음.

## 미검증 및 차단 요인

- 실제 카카오 채널의 직접 URL과 외부 브라우저 이동은 아직 확인하지 못했다. 현재 Linktree를 임시 진입점으로 사용한다.
- 대표 승인 FAQ 패킷이 없어 가격·시간표·주소·환불·대상 범위는 확답 데이터에 포함하지 않았다.

## 다음 세션 재개 순서

1. `src/data/coach-myway.json`의 `contactChannels`에서 실제 카카오 URL을 승인 URL로 바꾼다.
2. 대표 승인 FAQ 패킷을 바탕으로 `knowledge`의 상담 유도 항목을 갱신하고 `source`, `lastUpdated`를 기록한다.
3. `npm test && npm run build`를 실행하고 코치 마이:웨이 위젯을 수동 점검한다.

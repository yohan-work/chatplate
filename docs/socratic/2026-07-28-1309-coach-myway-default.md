# Socratic: 코치 마이:웨이 기본 노출 수정

- ID: 2026-07-28-1309-coach-myway-default
- 상태: 완료
- 관련 Handoff: [2026-07-28-1309-coach-myway-default](../handoff/2026-07-28-1309-coach-myway-default.md)

## 질문과 확인된 사실

| 질문 | 답 | 상태 | 근거 |
| --- | --- | --- | --- |
| 일반 화면에 왜 코치 마이:웨이가 보이지 않았는가? | 기본 bot ID가 `alf-demo`였다. | 확인됨 | `src/data/bots.ts` 변경 전 값 |
| 기존 브라우저 설정에 새 봇이 보이지 않을 수 있는가? | 가능하다. 저장된 전체 config가 bundled config를 완전히 대체했다. | 확인됨 | `src/app/App.tsx` 변경 전 초기화식 |
| 변경 후 신규·기존 브라우저에서 모두 보이는가? | 기본 bot을 `coach-myway`로 정하고, 저장된 config를 bundled config 위에 병합했다. | 확인됨 | `src/data/bots.ts`, `src/app/App.tsx` |

## 판단

- 확인됨: 기존에 수정한 bot은 유지하면서 새 `coach-myway` config만 자동 추가하는 병합이 안전하다.
- 추론: 사용자가 개발 화면에서 기대하는 봇은 현재 구축 대상인 코치 마이:웨이이므로 기본 bot을 교체한다.
- 미확인: 이미 배포된 외부 웹사이트가 이전 `widget.js`를 CDN 캐시하고 있는지 여부.

## 다음 계획

1. 개발 서버를 새로고침해 코치 마이:웨이가 기본 선택·표시되는지 확인한다 — 확인 방법: 관리자 선택 목록 및 위젯 홈 화면 관찰.
2. 배포 환경이 있으면 새 `dist/widget.js`를 배포한다 — 의존성: 배포 권한 — 확인 방법: 삽입 페이지 새로고침.

## 중단 또는 방향 전환 조건

- 한 화면에서 여러 데모 봇을 기본으로 보여야 하면 `defaultBotId`를 다시 `alf-demo`로 돌리고 URL 기반 봇 선택 기능을 별도 구현한다.

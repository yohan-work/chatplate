# Handoff: 코치 마이:웨이 기본 노출 수정

- ID: 2026-07-28-1309-coach-myway-default
- 상태: 완료
- 기록 시각: 2026-07-28 13:09 KST
- 관련 Socratic: [2026-07-28-1309-coach-myway-default](../socratic/2026-07-28-1309-coach-myway-default.md)

## 목표와 결과

- 목표: 개발 화면에서 코치 마이:웨이 챗봇이 보이지 않는 원인을 해결한다.
- 결과: 기본 봇을 `coach-myway`로 변경하고, 기존 localStorage config에도 신규 봇을 병합하도록 수정했다.

## 변경 사항

- `src/data/bots.ts`: `defaultBotId`를 `coach-myway`로 변경했다.
- `src/app/App.tsx`: 저장된 config를 bundled config에 덮어 병합해 신규 봇을 보존한다.
- `src/utils/botConfigStorage.test.ts`: 기존 저장 config와 신규 bundled bot의 병합 회귀 테스트를 추가했다.

## 검증 증거

- `npm test` → 5개 테스트 파일, 20개 테스트 통과.
- `npm run build` → TypeScript 검사 및 관리자/위젯 production build 통과.
- `git diff --check` → 공백 오류 없음.

## 미검증 및 차단 요인

- 실제 배포 페이지에서 새 번들을 반영하는 작업은 수행하지 않았다.

## 다음 세션 재개 순서

1. 개발 서버 또는 배포 페이지를 강력 새로고침해 코치 마이:웨이 기본 화면을 확인한다.
2. 실제 카카오 URL과 대표 승인 FAQ 패킷을 받아 `src/data/coach-myway.json`을 갱신한다.

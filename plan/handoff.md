# Chatplate Handoff

Last updated: 2026-07-30 15:14 KST

## 현재 제품 방향

Chatplate의 1차 목표는 채널톡 전체 복제가 아니다. 코치마이웨이 고객이 전화나 반복 문의 없이 등록된 FAQ 데이터로 즉시 답을 얻고, 자동응대로 해결되지 않은 질문만 같은 채팅 스레드에서 상담원에게 이어지는 비LLM 상담 MVP다.

핵심 상태 전이는 다음으로 확정했다.

```text
bot_active -> waiting -> human_active -> resolved
                                  ^          |
                                  |----------|
                            고객의 추가 메시지
```

- `bot_active`: 기존 JSON 지식과 결정론적 검색 엔진만 답변한다.
- `waiting`: 고객이 연락처·개인정보 동의를 제출했고 상담원 배정을 기다린다. 봇은 침묵한다.
- `human_active`: 담당 상담원만 고객에게 답변할 수 있다.
- `resolved`: 상담 완료 상태다. 고객이 메시지를 보내면 같은 스레드가 `human_active`로 재개된다.

## 이번 작업 결과

### 실제 운영 준비 하드닝

- 상담 repository가 cursor 검색, 미배정/내 상담 필터, 담당 이관, audit, 저장 답변, 알림 Outbox, 개인정보 익명화를 지원한다.
- bot config는 Zod schema로 검증하고 `초안 → 배포 → 이전 버전 롤백` 상태로 관리한다.
- production widget은 빌드에 전체 FAQ를 넣지 않고 published config를 조회한다.
- 외부 widget build는 gzip 1.21KB loader와 81.70KB 지연 로딩 앱으로 분리됐다.
- 고객 메시지는 전송 중·실패 상태와 재시도를 제공한다.
- 코치마이웨이 평일 운영시간과 휴무일을 기준으로 최초 응답 목표 시각을 계산한다.
- 연락 방법과 180일 개인정보 보관 동의를 명시적으로 수집한다.
- 상담원 초대·비활성화, 담당자 이관, 저장 답변, 상담 검색과 audit 이력을 관리자 화면에 추가했다.
- Supabase production hardening migration, Turnstile 검증, resume-token 교환, 상담원 초대, provider-neutral Outbox Edge Function을 준비했다.
- GitHub Actions에서 lint, test, build와 widget bundle budget을 검사한다.

### 서버 준비

- `src/services/chatRepository.ts`: UI와 저장소를 분리하는 `ChatRepository` 계약을 추가했다.
- `src/services/localChatRepository.ts`: 별도 서버 없이 전체 흐름을 검증할 수 있는 명시적 localStorage 어댑터를 추가했다.
- `src/services/supabaseChatRepository.ts`: 익명 고객 인증, 관리자 이메일 로그인, RPC, Realtime 구독을 사용하는 Supabase 어댑터를 추가했다.
- `src/services/getChatRepository.ts`: `VITE_CHAT_REPOSITORY=local|supabase`로 런타임을 명시적으로 선택한다.
- `supabase/migrations/202607300001_support_chat.sql`: 대화·메시지·관리자 프로필·내부 메모, RLS, 인계·선점·답변·완료·읽음 RPC, 기본 rate limit을 정의했다.

### 고객 채팅

- 브라우저를 다시 열어도 익명 방문자의 대화와 메시지를 복원한다.
- 자동 답변의 버튼·추천 FAQ·관련 질문·명확화 선택지를 메시지 metadata로 보존한다.
- 해결되지 않은 질문에서 상담원 연결 양식을 열고 이름·연락처·개인정보 동의를 받는다.
- 인계 후에는 FAQ 봇 응답을 중지하고 상담원 답변을 실시간으로 반영한다.
- 완료 후 고객 메시지는 새 티켓을 만들지 않고 같은 대화를 재개한다.
- 실제 대화 목록과 고객 읽지 않음 수를 위젯에 표시한다.

### 관리자 상담함

- Supabase 모드에서는 이메일·비밀번호 로그인과 활성 `profiles` 검사를 거친다.
- 인계된 대화를 `상담 대기 / 상담 중 / 완료`로 조회한다.
- 상담원 선점은 원자적 RPC로 충돌을 막는다.
- 담당 상담원만 고객 답변을 보낼 수 있고, owner는 다른 담당자의 대화를 종료할 수만 있다.
- 고객에게 보이지 않는 내부 메모, 읽지 않음 처리, 상담 완료, 고객 질문 기반 FAQ 초안 생성을 지원한다.

## 설정

로컬 검증은 기본값으로 바로 동작한다.

```env
VITE_CHAT_REPOSITORY=local
```

Supabase 운영 모드는 `.env.example`을 참고한다.

```env
VITE_CHAT_REPOSITORY=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

적용 순서:

1. `supabase/migrations/202607300001_support_chat.sql`을 프로젝트에 적용한다.
2. Supabase Auth의 anonymous sign-in을 활성화한다.
3. 관리자 Auth 사용자를 만든 뒤 `public.profiles`에 owner/operator 프로필을 등록한다.
4. 환경 변수를 설정하고 고객 위젯과 `/admin/`을 각각 확인한다.

## 검증 결과

- `npm test` → 12개 테스트 파일, 65개 테스트 통과.
- `npm run build` → TypeScript, 고객/관리자 앱, `dist/widget.js` 빌드 통과.
- `npm audit --json` → 취약점 0개.
- `git diff --check` → 공백 오류 없음.
- Playwright 수동 흐름 → 고객 질문, 상담 연결, 관리자 선점·답변, 고객 실시간 수신, 완료, 고객 메시지 재개까지 local 어댑터에서 확인.

## 미검증 및 남은 위험

- 실제 Supabase 프로젝트 URL·키와 로컬 Supabase CLI가 없어 두 migration, pgTAP, Edge Function, anonymous Auth, RLS, RPC, Realtime의 DB 통합은 실행하지 않았다.
- owner는 초기 한 명을 Supabase Auth와 SQL로 등록해야 한다. 이후 상담원 초대 UI는 준비됐다.
- 고객 알림은 위젯 읽지 않음 배지만 지원한다. 이메일·SMS·카카오 알림은 범위 밖이다.
- Outbox는 구조화 log adapter까지만 구현했다. 실제 이메일·SMS·카카오 provider와 cron secret은 홈페이지 구축 시 연결한다.
- 운영시간 schedule은 평일 10:00~18:00, 4 운영시간 목표로 초기화했다. 실제 계약 운영시간과 휴무일은 홈페이지 구축 시 확인해야 한다.
- 파일 첨부, 옴니채널, 결제, LLM은 범위 밖이다.
- 기존 localStorage `Ticket` 내보내기는 과거 데모 호환을 위해 데이터 패널에 남아 있지만 새 채팅 상담 흐름에서는 사용하지 않는다.

## 다음 단계

1. Supabase CLI 또는 staging 프로젝트에 migration을 적용하고 `supabase/tests`를 실행한다.
2. 익명 고객 2명과 owner/operator 2명으로 RLS 접근 격리, resume token, 동시 선점과 이관을 검증한다.
3. production bot config v1을 배포하고 외부 `widget.js`가 published config를 가져오는지 확인한다.
4. 실제 홈페이지 도메인의 Turnstile·allowed origin과 알림 provider·cron을 연결한다.
5. 코치마이웨이 실제 계약 영업시간과 휴무일로 schedule 값을 확정한다.

## 주요 파일

- `src/types/chatbot.ts`
- `src/services/chatRepository.ts`
- `src/services/localChatRepository.ts`
- `src/services/supabaseChatRepository.ts`
- `src/components/widget/ChatbotWidget.tsx`
- `src/components/admin/AdminWorkspace.tsx`
- `supabase/migrations/202607300001_support_chat.sql`
- `README.md`

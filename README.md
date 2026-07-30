# Chatplate

JSON knowledge 데이터를 교체해 여러 도메인에 붙일 수 있는 고객 상담 챗봇 위젯입니다. OpenAI API나 LLM을 호출하지 않고, 미리 등록된 질문/키워드/별칭 데이터를 scoring해서 답변합니다. 등록 데이터로 해결하지 못한 대화는 상담원이 같은 채팅 스레드를 이어받습니다.

## 실행

```bash
npm install
npm run dev
```

검증:

```bash
npm test
npm run build
```

## 구조

- `src/components/widget`: launcher, widget shell, bottom navigation
- `src/components/admin`: 관리자 콘솔, 데이터/검색 품질 관리
- `src/components/home`: 홈, 공지, 문의 채널, 추천 질문
- `src/components/chat`: 대화방, 메시지, 입력창, quick replies
- `src/components/settings`: 봇 정보, 운영시간, 문의 채널
- `src/data`: 도메인별 JSON 샘플
- `src/engine`: query 분석, search index, ranking, confidence 판정, fallback helper
- `src/types/chatbot.ts`: 위젯 데이터와 메시지 타입
- `src/widget-entry.tsx`: 외부 사이트 삽입용 위젯 런타임

## 데이터 추가

1. `src/data/{bot-id}.json`을 추가합니다.
2. `bot`, `theme`, `operation`, `notices`, `contactChannels`, `categories`, `quickReplies`, `knowledge`를 채웁니다.
3. `src/data/bots.ts`의 `botConfigs`에 새 데이터를 등록합니다.

각 `knowledge` 항목은 `question`, `keywords`, `aliases`, `answer`, `buttons`, `relatedIds`, `priority`를 가집니다. 검색은 질문 정확도, keyword 포함, alias 일치, priority를 합산합니다.

## MVP 확인 시나리오

- 관리자 오른쪽 preview에서 launcher 클릭 시 위젯이 열립니다.
- 홈에서 히어로, 최근 공지, 안 읽은 알림, 문의 채널, 하단 메뉴가 보입니다.
- 대화 탭에서 추천 질문과 입력창이 보입니다.
- `설치는 어떻게 하나요?`를 입력하면 `alf-demo` 설치 답변이 출력됩니다.
- 관리자에서 `포근동물병원`으로 변경 후 `주차 가능해요?`를 입력하면 주차 답변이 출력됩니다.
- 알 수 없는 질문은 fallback 메시지와 추천 질문을 보여주고 관리자 검색 품질/실패 질문 화면에 누적합니다.
- 낮은 신뢰도 답변, fallback, 상담원 연결 권장 FAQ, 부정 피드백은 상담 요청 CTA를 보여주고 `문의함` 탭에 티켓으로 저장됩니다.

## 외부 사이트 삽입

빌드하면 관리자 앱과 함께 외부 삽입용 위젯 파일이 생성됩니다.

```bash
npm run build
```

기본 삽입:

```html
<script type="module" src="/widget.js" data-bot-id="alf-demo"></script>
```

직접 초기화:

```html
<script type="module" src="/widget.js" data-auto-init="false"></script>
<script type="module">
  await window.ChatplateReady;
  window.Chatplate.init({ botId: "animal-hospital" });
</script>
```

`window.Chatplate.init({ config })`로 외부에서 직접 bot config 객체를 전달할 수도 있습니다.

## 데이터 이동

관리자 콘솔의 `데이터` 탭에서 다음 작업을 할 수 있습니다.

- 현재 bot config JSON 다운로드
- 전체 bot config JSON 다운로드
- JSON 파일 업로드로 bot config 가져오기
- conversation events JSON/CSV 다운로드
- 상담 티켓 JSON/CSV 다운로드
- 외부 삽입 코드 복사

## 상담 티켓 운영

기본 개발 모드는 `VITE_CHAT_REPOSITORY=local`입니다. 고객 대화가 브라우저 localStorage에 저장되므로 고객·관리자 흐름을 한 브라우저에서 시연할 수 있습니다.

실사용 환경은 Supabase adapter를 사용합니다.

```bash
cp .env.example .env.local
```

```env
VITE_CHAT_REPOSITORY=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`supabase/migrations`의 SQL을 순서대로 적용하고 Supabase Auth에서 anonymous sign-in을 활성화합니다. 최초 관리자는 Auth 사용자를 생성한 뒤 같은 UUID로 `profiles`에 owner를 등록합니다.

```sql
insert into public.profiles (id, display_name, email, role)
values ('AUTH_USER_UUID', '대표 관리자', 'owner@example.com', 'owner');
```

### 채팅상담 흐름

1. 익명 방문자는 등록 FAQ의 자동응답을 받습니다.
2. fallback, 낮은 신뢰도, 부정 피드백, 상담원 요청에서 연락처와 동의를 받고 `waiting`으로 전환합니다.
3. 관리자가 `문의함`에서 대화를 선점하면 `human_active`가 되고, 이때부터 봇은 응답하지 않습니다.
4. 상담원 답변은 같은 위젯에 실시간 표시됩니다.
5. 상담 완료 후 고객이 메시지를 보내면 같은 스레드가 다시 열립니다.

관리자 내부 메모는 고객 메시지와 별도 저장됩니다. 기존 localStorage `Ticket` 데이터는 호환 내보내기 용도로만 유지되며 새 채팅상담에는 사용하지 않습니다.

### 운영 준비 기능

- FAQ·공지 설정은 초안 저장 후 명시적으로 배포하며 이전 배포본으로 롤백할 수 있습니다.
- 외부 위젯은 전체 FAQ를 번들에 넣지 않고 published config를 조회합니다.
- 상담함은 고객·연락처·메시지 검색, 미배정/내 상담 필터, 담당 이관, audit 이력, 저장 답변을 지원합니다.
- 코치마이웨이 기본 schedule은 `Asia/Seoul`, 평일 10:00~18:00이며 최초 답변 목표 240분은 운영시간과 휴무일만 합산합니다.
- 상담원 답변은 2분 지연 Outbox에 들어가며 고객이 먼저 읽으면 취소됩니다.
- 알림 provider는 현재 `log` adapter이고, 실제 이메일·문자·카카오는 홈페이지 구축 시 연결합니다.
- 알림에 사용할 resume token은 hash만 저장하고 7일 후 만료되며 한 번만 사용할 수 있습니다.
- 개인정보 기본 보관기간은 180일이며 `anonymize_expired_support_contacts`로 익명화합니다.
- `verify-visitor` Edge Function은 Turnstile과 허용 origin을 검증할 수 있습니다. 로컬 `supabase/config.toml`에서는 CAPTCHA를 비활성화합니다.

Edge Function 배포 시 필요한 secret:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TURNSTILE_SECRET_KEY
OUTBOX_CRON_SECRET
```

`process-notification-outbox`는 1분 주기로 호출하도록 설정합니다. 실제 provider 연결 전에는 상담 내용을 외부로 전송하지 않고 구조화 로그만 남깁니다.

## 품질 검증

```bash
npm run lint
npm test
npm run build
npm run check:widget-budget
```

외부 widget build는 작은 `widget.js` loader와 클릭 후 로드되는 versioned chunk로 분리됩니다. CI는 loader 20KB gzip, widget app 150KB gzip, CSS 20KB gzip 예산을 검사합니다.

## 홈페이지 구축 시 남은 연결 작업

- 원격 Supabase migration과 RLS 통합 테스트
- production bot config 최초 배포
- 실제 도메인 allowed origin과 Turnstile key 설정
- owner/operator 실제 계정 및 MFA 설정
- 이메일·문자·카카오 중 알림 provider 선택
- Outbox cron, 개인정보 익명화 cron, 오류 모니터링 provider 연결

# Chatplate

JSON knowledge 데이터를 교체해 여러 도메인에 붙일 수 있는 고객 상담 챗봇 위젯 MVP입니다. OpenAI API나 LLM을 호출하지 않고, 미리 등록된 질문/키워드/별칭 데이터를 scoring해서 답변합니다.

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
<script src="/widget.js" data-bot-id="alf-demo"></script>
```

직접 초기화:

```html
<script src="/widget.js" data-auto-init="false"></script>
<script>
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

사용자가 상담 요청 폼을 제출하면 브라우저 localStorage에 티켓이 저장됩니다. 관리자 콘솔의 `문의함` 탭에서 상태, 우선순위, 관리자 메모를 관리하고 반복 문의는 FAQ 초안으로 전환할 수 있습니다.

## 향후 확장

- API에서 `botConfig` 로딩
- 서버 기반 conversation event 저장
- 로그인/권한 관리
- CDN 배포
- 도메인별 템플릿팩 배포

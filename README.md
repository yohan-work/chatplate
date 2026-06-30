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
- `src/components/home`: 홈, 공지, 문의 채널, 추천 질문
- `src/components/chat`: 대화방, 메시지, 입력창, quick replies
- `src/components/settings`: 봇 정보, 운영시간, 문의 채널, 개발용 bot selector
- `src/data`: 도메인별 JSON 샘플
- `src/engine`: normalize, scoring, search, fallback helper
- `src/types/chatbot.ts`: 위젯 데이터와 메시지 타입

## 데이터 추가

1. `src/data/{bot-id}.json`을 추가합니다.
2. `bot`, `theme`, `operation`, `notices`, `contactChannels`, `categories`, `quickReplies`, `knowledge`를 채웁니다.
3. `src/data/bots.ts`의 `botConfigs`에 새 데이터를 등록합니다.

각 `knowledge` 항목은 `question`, `keywords`, `aliases`, `answer`, `buttons`, `relatedIds`, `priority`를 가집니다. 검색은 질문 정확도, keyword 포함, alias 일치, priority를 합산합니다.

## MVP 확인 시나리오

- launcher 클릭 시 위젯이 열립니다.
- 홈에서 히어로, 최근 공지, 안 읽은 알림, 문의 채널, 하단 메뉴가 보입니다.
- 대화 탭에서 추천 질문과 입력창이 보입니다.
- `설치는 어떻게 하나요?`를 입력하면 `alf-demo` 설치 답변이 출력됩니다.
- 설정에서 `포근동물병원`으로 변경 후 `주차 가능해요?`를 입력하면 주차 답변이 출력됩니다.
- 알 수 없는 질문은 fallback 메시지와 추천 질문을 보여주고 설정 화면에 누적합니다.

## 향후 확장

- API에서 `botConfig` 로딩
- 관리자 페이지에서 knowledge 수정
- 답변 실패 질문 로그 저장
- `widget.js`와 `data-bot-id` 기반 외부 사이트 임베드
- 도메인별 템플릿팩 배포

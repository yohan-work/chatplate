너는 숙련된 프론트엔드/풀스택 개발자이자 제품 디자이너다.

목표:
어느 도메인, 어느 사이트에도 삽입 가능한 “고객 상담 챗봇 템플릿”을 만든다.
디자인 방향은 채널톡 같은 모바일 메신저/고객센터 위젯 느낌을 참고하되, 특정 서비스를 그대로 복제하지 말고 독립적인 SaaS 스타일의 디자인 시스템으로 구현한다.

이 챗봇은 OpenAI API나 LLM으로 답변을 생성하지 않는다.
관리자가 미리 등록한 도메인별 knowledge 데이터를 기반으로 사용자의 질문과 가장 가까운 답변을 찾아 보여주는 구조다.

핵심 컨셉:
- 공통 챗봇 엔진 1개
- 도메인별 knowledge.json 데이터 교체
- 사이트별 테마/공지/문의 채널/추천 질문 설정 가능
- 메인 홈, 대화, 설정 메뉴를 가진 All-in-One 고객 상담 위젯

기술 스택:
- React
- TypeScript
- Vite
- Fuse.js 또는 자체 scoring 기반 검색
- CSS Modules, Tailwind CSS, 또는 일반 CSS 중 하나를 선택해 깔끔하게 구성
- MVP에서는 백엔드 없이 JSON 데이터 기반으로 동작
- 향후 API 연동을 고려한 구조로 설계

전체 화면 구조:
1. Floating Launcher
2. Widget Home
3. Chat Room
4. Conversation List
5. Settings
6. Notice Detail
7. Fallback / Contact CTA

Floating Launcher 요구사항:
- 화면 우측 하단에 고정된 원형 버튼
- 알림 뱃지 표시 가능
- 클릭 시 위젯 패널 오픈
- 모바일에서는 전체 화면에 가까운 bottom sheet 또는 full panel처럼 보이게 처리
- 데스크톱에서는 380~420px 너비의 고정형 위젯 패널로 표시

Widget Home 화면 요구사항:
- 상단에 브랜드/봇 로고, 봇 이름 표시
- 큰 히어로 영역 제공
- 배경은 부드러운 그라데이션/블러 도형을 사용해 SaaS 고객센터 느낌 구현
- 메인 타이틀 예시:
  “Customer Driven”
  또는 bot config의 homeTitle 사용
- 공지 카드 표시
  - 최근 공지 1개를 크게 노출
  - 공지 제목, 요약, 작성자/봇명, CTA 버튼 포함
  - CTA 버튼 예시: “문의하기”, “자세히 보기”
- 안 읽은 알림 카드 표시
  - unread count 표시
  - 최근 공지/알림 요약
  - 썸네일 또는 작은 이미지 영역 optional
- 다른 방법으로 문의 영역
  - 카카오톡
  - 네이버톡톡
  - 전화
  - 이메일
  - 더보기
- 하단 메뉴바 표시
  - 홈
  - 대화
  - 설정
- 현재 활성 메뉴는 강조 표시
- 전체적으로 iOS 앱 같은 둥근 카드, 넉넉한 여백, 큰 타이포그래피 사용

Chat Room 화면 요구사항:
- 상단 헤더
  - 뒤로가기
  - 봇 아바타
  - 봇 이름
  - 상태 문구
- 첫 메시지 영역
  - 봇이 안내 메시지 출력
  - 운영시간 정보
  - 주요 공지 표시 가능
- 추천 질문 quick reply 버튼
  - 예: “채널톡 ALF는 무엇인가요?”
  - 예: “설치는 어떻게 하나요?”
- 사용자 입력창
  - placeholder: “AI에게 질문해 주세요.”
  - 파일 첨부 아이콘
  - 이모지 아이콘
  - 전송 버튼
- 하단 안내 문구
  - “AI는 한정된 데이터에 기반하니, 중요한 정보는 추가 확인을 권장해요.”
- 단, 실제 답변은 LLM 생성이 아니라 knowledge 데이터 검색 결과로만 출력

Conversation List 화면 요구사항:
- 사용자와 봇의 대화 목록 표시
- 최근 대화 카드
- 안 읽은 메시지 뱃지
- 클릭 시 해당 대화방 이동
- MVP에서는 실제 멀티 대화 저장까지 복잡하게 만들 필요는 없지만, 구조는 확장 가능하게 설계

Settings 화면 요구사항:
- 봇 정보
- 알림 설정
- 문의 채널 정보
- 운영시간
- 개인정보/이용 안내 링크
- 위젯 닫기 또는 초기화 버튼

디자인 시스템 요구사항:
아래 토큰을 기반으로 디자인 시스템을 구성한다.

Color Tokens:
- primary: #6C3BFF
- primaryDark: #4F27E8
- primaryLight: #EEE8FF
- secondary: #2F8CFF
- accent: #FF8A00
- success: #17C964
- danger: #F04452
- warning: #F5A524
- textPrimary: #202124
- textSecondary: #5F6368
- textTertiary: #9AA0A6
- border: #E8EAED
- surface: #FFFFFF
- surfaceSoft: #F7F8FA
- background: #F4F5F7

Gradient Tokens:
- mainGradient: linear-gradient(135deg, #5B2BFF 0%, #8A2BFF 100%)
- softHeroGradient: radial-gradient(circle at 20% 20%, rgba(255, 136, 255, 0.35), transparent 35%),
                    radial-gradient(circle at 70% 10%, rgba(47, 140, 255, 0.35), transparent 40%),
                    linear-gradient(180deg, #FFFFFF 0%, #F7F8FA 100%)

Typography:
- fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif
- h1: 40px / 700
- h2: 28px / 700
- h3: 22px / 700
- bodyLarge: 18px / 500
- body: 16px / 400
- bodySmall: 14px / 400
- caption: 12px / 400
- 버튼 텍스트는 16px 이상으로 명확하게

Radius:
- launcher: 999px
- card: 28px
- button: 18px
- input: 26px
- bubble: 22px

Shadow:
- widgetShadow: 0 24px 80px rgba(0, 0, 0, 0.18)
- cardShadow: 0 8px 24px rgba(0, 0, 0, 0.06)
- launcherShadow: 0 12px 32px rgba(108, 59, 255, 0.35)

Spacing:
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px
- 3xl: 48px

Component Design:
1. Button
   - primary
   - secondary
   - ghost
   - icon
   - fullWidth
2. Card
   - notice card
   - unread card
   - contact channel card
   - answer card
3. Badge
   - unread count
   - status
4. Avatar
   - bot avatar
   - user avatar
5. Chat Bubble
   - bot message
   - user message
   - system notice
6. Bottom Navigation
   - home
   - conversations
   - settings
7. Input Bar
   - text input
   - attachment button
   - emoji button
   - send button

데이터 구조:
아래와 같은 형태의 JSON 데이터를 기준으로 설계한다.

{
  "bot": {
    "id": "alf-demo",
    "name": "ALF",
    "title": "All-In-One AI 메신저, 채널톡",
    "description": "궁금한 점을 남겨주시면 빠르게 안내드리겠습니다.",
    "avatarUrl": "",
    "greeting": "안녕하세요, 고객님! 궁금한 점을 남겨주시면 빠르게 안내드리겠습니다.",
    "fallbackMessage": "정확한 답변을 찾지 못했어요. 아래 질문 중 찾으시는 내용이 있을까요?",
    "disclaimer": "AI는 한정된 데이터에 기반하니, 중요한 정보는 추가 확인을 권장해요."
  },
  "theme": {
    "primaryColor": "#6C3BFF",
    "position": "bottom-right",
    "homeTitle": "Customer Driven"
  },
  "operation": {
    "botHours": "24시간 연중무휴",
    "csHours": "평일 09:00 ~ 17:00 (주말 및 공휴일 휴무)"
  },
  "notices": [
    {
      "id": "notice-001",
      "title": "채널톡 계정 점검 가이드에 대해 문의 주셨군요!",
      "summary": "6월 29일 저녁부터 대규모 업데이트와 보안 점검이 진행되었습니다.",
      "content": "6/29(월) 밤 보안 업데이트로 자동 로그아웃이 진행되었습니다. 원활한 재로그인을 위해 계정 점검 가이드를 확인해 주세요.",
      "createdAt": "4일 전",
      "unread": true,
      "imageUrl": "",
      "buttons": [
        {
          "label": "계정 점검 가이드",
          "type": "url",
          "value": "https://example.com"
        }
      ]
    }
  ],
  "contactChannels": [
    {
      "id": "kakao",
      "label": "카카오톡",
      "type": "url",
      "value": "https://pf.kakao.com/example",
      "icon": "kakao"
    },
    {
      "id": "naver",
      "label": "네이버톡톡",
      "type": "url",
      "value": "https://talk.naver.com/example",
      "icon": "naver"
    },
    {
      "id": "phone",
      "label": "전화 문의",
      "type": "tel",
      "value": "02-0000-0000",
      "icon": "phone"
    }
  ],
  "categories": [
    {
      "id": "intro",
      "name": "서비스 소개"
    },
    {
      "id": "install",
      "name": "설치"
    },
    {
      "id": "account",
      "name": "계정"
    },
    {
      "id": "billing",
      "name": "요금"
    }
  ],
  "quickReplies": [
    {
      "label": "채널톡 ALF는 무엇인가요?",
      "knowledgeId": "intro-001"
    },
    {
      "label": "채널톡 설치는 어떻게 하나요?",
      "knowledgeId": "install-001"
    }
  ],
  "knowledge": [
    {
      "id": "intro-001",
      "categoryId": "intro",
      "question": "채널톡 ALF는 무엇인가요?",
      "keywords": ["ALF", "채널톡", "무엇", "소개", "기능"],
      "aliases": [
        "ALF가 뭐예요?",
        "이 서비스는 무엇인가요?",
        "채널톡 ALF 설명해줘"
      ],
      "answer": "ALF는 고객 문의를 빠르게 안내하기 위한 상담 도우미입니다. 자주 묻는 질문, 공지, 계정 안내, 설치 방법 등을 한 곳에서 확인할 수 있습니다.",
      "buttons": [
        {
          "label": "도입 상담받기",
          "type": "action",
          "value": "open-contact"
        }
      ],
      "relatedIds": ["install-001"],
      "priority": 10
    },
    {
      "id": "install-001",
      "categoryId": "install",
      "question": "채널톡 설치는 어떻게 하나요?",
      "keywords": ["설치", "도입", "스크립트", "사이트", "연동"],
      "aliases": [
        "사이트에 어떻게 붙이나요?",
        "설치 방법 알려줘",
        "스크립트 삽입은 어떻게 하나요?"
      ],
      "answer": "사이트에 제공된 설치 스크립트를 삽입하면 위젯을 사용할 수 있습니다. 관리자 설정에서 봇 ID와 테마를 지정할 수 있습니다.",
      "buttons": [
        {
          "label": "설치 가이드 보기",
          "type": "url",
          "value": "https://example.com/install"
        }
      ],
      "relatedIds": ["intro-001"],
      "priority": 9
    }
  ]
}

검색/매칭 엔진 요구사항:
- 사용자의 입력을 normalizeText 함수로 정규화한다.
- question, keywords, aliases를 대상으로 검색한다.
- Fuse.js를 사용할 수 있다.
- 또는 자체 scoring 함수를 만들어도 된다.
- 검색 결과는 score 기준으로 정렬한다.
- score가 높으면 즉시 답변한다.
- score가 애매하면 “혹시 이 질문을 찾으셨나요?” 후보 질문을 2~3개 보여준다.
- score가 낮으면 fallbackMessage와 quickReplies를 보여준다.
- 답변하지 못한 질문은 unknownQuestions 배열에 저장할 수 있는 구조를 준비한다.

검색 기준 예시:
- 정확한 질문 일치: 높은 점수
- keywords 포함: 중간 점수
- aliases 유사도: 중간 점수
- priority 가중치 반영
- 너무 낮은 점수는 fallback 처리

상태 관리:
- activeView: "home" | "chat" | "conversations" | "settings" | "notice"
- isOpen: boolean
- messages: ChatMessage[]
- selectedBotData
- unreadCount
- selectedNotice
- unknownQuestions

파일 구조:
src/
  app/
    App.tsx
  components/
    widget/
      ChatbotLauncher.tsx
      ChatbotWidget.tsx
      WidgetHeader.tsx
      BottomNavigation.tsx
    home/
      HomeView.tsx
      HeroSection.tsx
      NoticeCard.tsx
      UnreadNoticeCard.tsx
      ContactChannels.tsx
    chat/
      ChatView.tsx
      ChatHeader.tsx
      MessageList.tsx
      ChatBubble.tsx
      ChatInput.tsx
      QuickReplies.tsx
      AnswerCard.tsx
    conversations/
      ConversationsView.tsx
      ConversationCard.tsx
    settings/
      SettingsView.tsx
    common/
      Button.tsx
      Card.tsx
      Badge.tsx
      Avatar.tsx
      IconButton.tsx
  data/
    alf-demo.json
    animal-hospital.json
    law-office.json
    cafe.json
  engine/
    normalizeText.ts
    searchKnowledge.ts
    scoreKnowledge.ts
    getRelatedQuestions.ts
    getFallbackSuggestions.ts
  types/
    chatbot.ts
  styles/
    tokens.css
    global.css
    widget.css

필수 타입:
- BotConfig
- BotInfo
- ThemeConfig
- Notice
- ContactChannel
- Category
- KnowledgeItem
- AnswerButton
- ChatMessage
- SearchResult
- WidgetView

UI 디테일:
- 전체 위젯은 둥근 모서리와 부드러운 그림자를 가진 카드 형태
- 모바일 앱 같은 감성
- 공지 카드와 대화 카드의 여백은 넉넉하게
- 버튼은 큼직하고 명확하게
- 하단 네비게이션은 홈/대화/설정 3개 탭
- 대화 화면 입력창은 하단 fixed 느낌으로 배치
- 입력창 배경은 연한 회색
- 전송 버튼은 primary 컬러 사용
- quick reply는 pill 형태
- unread badge는 빨간색 원형 배지
- 공지/알림 영역에는 “안 읽은 알림”, “모두 읽기” 같은 텍스트 제공

반응형 요구사항:
- 데스크톱:
  - 위젯 최대 너비 400px
  - 최대 높이 720px
  - 우측 하단 fixed
- 모바일:
  - 화면 너비 거의 전체 사용
  - 높이 100dvh 또는 safe-area 고려
  - 하단 메뉴와 입력창이 모바일에서 잘리지 않게 처리

접근성 요구사항:
- 버튼에는 aria-label 제공
- Enter로 메시지 전송 가능
- ESC로 위젯 닫기 가능
- 포커스 스타일 제공
- 색상 대비 확보

MVP에서 제외할 것:
- 실제 LLM API 호출
- 로그인
- 실시간 상담원 연결
- 복잡한 관리자 페이지
- DB 저장
- 결제 기능
- 실제 푸시 알림

하지만 향후 확장 가능하도록 고려할 것:
- API에서 bot config 불러오기
- 관리자 페이지에서 knowledge 수정
- 사용자의 질문 로그 저장
- 답변 실패 질문 수집
- script 한 줄로 외부 사이트 삽입
- 여러 botId 지원
- 도메인별 템플릿팩 제공

외부 사이트 삽입을 고려한 향후 구조:
최종적으로는 아래처럼 사용할 수 있어야 한다.

<script
  src="https://your-domain.com/widget.js"
  data-bot-id="alf-demo">
</script>

이번 MVP에서는 실제 CDN 배포까지는 하지 않아도 되지만, 구조적으로 ChatbotWidget이 독립 컴포넌트로 동작해야 한다.

샘플 도메인 데이터:
최소 4개를 만든다.
1. alf-demo.json
   - 현재 고객센터/채널톡 스타일 샘플
2. animal-hospital.json
   - 동물병원 상담
3. law-office.json
   - 법률사무소 상담
4. cafe.json
   - 카페/식당 문의

각 샘플 데이터에는 최소 아래 항목을 포함한다.
- bot 정보
- theme
- operation
- notices 1~2개
- contactChannels 2~3개
- categories 4개 이상
- quickReplies 4개 이상
- knowledge 8개 이상

완료 기준:
1. Floating launcher를 클릭하면 챗봇 위젯이 열린다.
2. 홈 화면에는 히어로 영역, 공지 카드, 안 읽은 알림 카드, 다른 문의 채널, 하단 메뉴가 보인다.
3. 대화 탭으로 이동하면 봇 인사말과 추천 질문이 보인다.
4. 사용자가 “설치는 어떻게 하나요?”라고 입력하면 knowledge 데이터에서 설치 관련 답변을 찾아 보여준다.
5. 사용자가 “주차 가능해요?”라고 입력하고 animal-hospital 데이터가 선택되어 있으면 주차 관련 답변이 출력된다.
6. 답변이 없으면 fallback 메시지와 추천 질문을 보여준다.
7. bot data를 교체하면 이름, 색상, 공지, 카테고리, 답변이 바뀐다.
8. 모바일과 데스크톱에서 모두 자연스럽게 보인다.
9. 디자인은 채널톡 같은 고객 상담 위젯의 UX를 참고하되, 독립적인 브랜드 UI로 구현한다.
10. README에 프로젝트 목적, 실행 방법, 데이터 구조, 도메인 추가 방법, 향후 확장 계획을 작성한다.

추가 요청:
- 코드 품질을 위해 컴포넌트를 과도하게 한 파일에 몰아넣지 말고 역할별로 분리한다.
- 타입을 명확하게 정의한다.
- 임시 데이터와 UI 로직을 분리한다.
- 검색 엔진 로직은 components 안에 넣지 말고 engine 폴더에 분리한다.
- 스타일 토큰은 tokens.css 또는 별도 theme 파일로 관리한다.
- 추후 관리자 페이지와 API 연동이 쉬운 구조로 설계한다.
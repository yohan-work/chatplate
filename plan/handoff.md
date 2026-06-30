# Chatplate Handoff

Last updated: 2026-06-30

## Current Status

Chatplate is a React + TypeScript + Vite chatbot/admin MVP. The latest work implemented a customer-support handoff and ticket-operation flow on top of the existing JSON knowledge chatbot.

The workspace currently has uncommitted changes. Do not assume the working tree is clean before continuing.

Validation already completed:

```bash
npm test
npm run build
```

Both passed. A dev server was also started during the last session at:

```text
http://127.0.0.1:5173/
```

## Implemented Features So Far

### Core Chatbot

- User-facing widget with launcher, bottom navigation, home/chat/conversation/settings/notice views.
- Knowledge search based on registered JSON data, not an external LLM.
- Search quality supports aliases, keywords, tags, negative keywords, priority, typo/token scoring, confidence, alternatives, and fallback suggestions.
- Chat messages can show answer buttons, suggestions, related questions, confidence, feedback state, and now handoff CTA state.
- Widget preview behavior changes at `1100px`: preview collapses to a launcher and opens/closes like mobile instead of staying as a full visible panel.

### Admin Console

- Bot configuration editing: basic info, operation hours, notices, FAQ/knowledge, quick replies.
- Search quality panel: test queries, inspect confidence/score breakdown, add query as alias/keyword, create FAQ draft from failed query.
- Data panel: bot config import/export, conversation event export, embed code copy.
- Live preview for the selected bot.

### Data/Export

- Bot config JSON import/export.
- Conversation event JSON/CSV export and reset.
- External widget bundle build through `vite.widget.config.ts`, producing `dist/widget.js`.
- README documents embed usage:

```html
<script src="/widget.js" data-bot-id="alf-demo"></script>
```

### Handoff And Tickets

Newly implemented in the latest session:

- Added `Ticket` domain model:
  - `TicketStatus = 'new' | 'inProgress' | 'resolved' | 'onHold'`
  - `TicketPriority = 'low' | 'normal' | 'high'`
  - `TicketSource = 'fallback' | 'negativeFeedback' | 'manualContact' | 'handoffRecommended'`
- Added `handoffCta?: boolean` and `ticketId?: string` to `ChatMessage`.
- Added localStorage-backed ticket storage in `src/utils/ticketStorage.ts`.
- Added tests in `src/utils/ticketStorage.test.ts`.
- Added customer contact form at `src/components/chat/ContactRequestForm.tsx`.
- User widget now shows a "상담 요청 남기기" CTA when:
  - search confidence is low
  - result is fallback
  - result is suggestions
  - matched FAQ has `handoffRecommended`
  - user marks a bot answer as not helpful
- Submitting the form creates a ticket and appends a system message with the ticket id.
- Admin sidebar now has `문의함`.
- Admin ticket inbox supports:
  - status filter counts
  - ticket detail view
  - status update
  - priority update
  - admin memo update
  - matched FAQ display
  - creating a draft FAQ from a ticket
- Data panel now exports tickets as JSON/CSV and can clear ticket storage.

## Important Changed Files

- `README.md`: documents ticket flow and ticket data export.
- `src/types/chatbot.ts`: added ticket types and message handoff fields.
- `src/components/widget/ChatbotWidget.tsx`: connects search/feedback outcomes to handoff CTA and ticket creation.
- `src/components/chat/ChatView.tsx`: renders contact request form in the message flow.
- `src/components/chat/ChatBubble.tsx`: renders handoff CTA per message.
- `src/components/chat/ContactRequestForm.tsx`: new user-facing contact form.
- `src/components/admin/AdminWorkspace.tsx`: added `문의함` panel and ticket data export integration.
- `src/utils/ticketStorage.ts`: new ticket storage/create/update/export helpers.
- `src/utils/ticketStorage.test.ts`: new ticket tests.
- `src/utils/adminBotConfig.ts`: added `createKnowledgeFromTicket`.
- `src/styles/widget.css`: handoff CTA and contact form styles.
- `src/styles/admin.css`: ticket inbox styles.

Current git status from the last session:

```text
 M README.md
 M src/components/admin/AdminWorkspace.tsx
 M src/components/chat/ChatBubble.tsx
 M src/components/chat/ChatView.tsx
 M src/components/widget/ChatbotWidget.tsx
 M src/styles/admin.css
 M src/styles/widget.css
 M src/types/chatbot.ts
 M src/utils/adminBotConfig.ts
?? src/components/chat/ContactRequestForm.tsx
?? src/utils/ticketStorage.test.ts
?? src/utils/ticketStorage.ts
```

## Verification Notes

Last known passing output:

- `npm test`: 5 test files, 16 tests passed.
- `npm run build`: TypeScript build passed, Vite app build passed, widget build passed.

The dev server may still be running from the previous session. If port `5173` is occupied, use the existing server or start Vite on another port.

## Known Limitations

- Tickets are stored in browser localStorage only. This is enough for MVP/admin preview but not production.
- Ticket IDs use timestamp-based local generation.
- Contact form has basic required-field validation only.
- No authentication/authorization yet.
- No server-side ticket assignment, SLA, notifications, or multi-admin concurrency.
- Ticket export may include personal information. Production needs access control and retention policy.
- Admin ticket memo saves on every textarea change, which is simple but should be debounced or changed to explicit save once moved to an API.
- Creating FAQ draft from ticket does not navigate to the FAQ editor automatically yet.

## Recommended Next Phase

Focus on production-grade support operations, similar to Channel Talk-style workflows:

1. Server-backed tickets and conversation storage
   - Replace localStorage ticket/event storage with API persistence.
   - Add schema for bots, conversations, tickets, ticket events, admins, and customers.
   - Keep localStorage only as demo fallback.

2. Ticket lifecycle workflow
   - Add assignee, internal notes, public reply, status history, due date/SLA.
   - Separate customer-visible reply from internal memo.
   - Add reopen flow when a customer replies after resolution.

3. Customer identity and context
   - Capture page URL, referrer, device, selected bot, prior messages, matched FAQ ids.
   - Add optional user metadata through widget init:

```ts
window.Chatplate.init({
  botId: 'alf-demo',
  user: { id: 'user-1', name: '홍길동', email: 'user@example.com' },
});
```

4. Admin productivity
   - Ticket list search/sort.
   - Saved filters: 신규, 미배정, 내 담당, SLA 임박, 부정 피드백.
   - Canned replies and one-click FAQ draft from resolved tickets.
   - Merge duplicate tickets from the same question/customer.

5. User experience
   - Show submitted ticket status in the widget.
   - Let users add follow-up messages to an existing ticket.
   - Add clear expected response time based on operation hours.
   - Add privacy copy and consent text configurable per bot.

6. Quality loop
   - Link tickets, failed questions, feedback, and FAQ drafts into one improvement queue.
   - Track answer coverage, fallback rate, negative-feedback rate, and FAQ draft conversion.

## Suggested First Tasks For Next Session

1. Review the uncommitted diff and decide whether to commit the handoff/ticket work as one feature commit.
2. Manually test in browser:
   - fallback question creates handoff CTA
   - negative feedback opens contact form
   - form validation blocks empty fields and unchecked consent
   - successful submit appears in `문의함`
   - ticket status/priority/memo update persists
   - FAQ draft generation creates a draft knowledge item
   - ticket JSON/CSV export downloads
3. If manual QA passes, commit with a message like:

```text
feat: add chatbot handoff ticket workflow
```

4. Start the next phase by introducing server-ready repository interfaces for tickets/events before adding real API calls.

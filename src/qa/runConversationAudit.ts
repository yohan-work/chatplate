import { botConfigs } from '../data/bots';
import { createConversationAudit, renderConversationAuditMarkdown } from './conversationAuditReport';

const result = createConversationAudit(botConfigs['coach-myway']);

console.log(renderConversationAuditMarkdown(result));
console.log(JSON.stringify({ summary: result.summary }, null, 2));

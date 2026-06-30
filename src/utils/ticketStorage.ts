import type { Ticket, TicketPriority, TicketSource, TicketStatus } from '../types/chatbot';

export const TICKETS_STORAGE_KEY = 'chatplate:tickets:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TicketInput {
  botId: string;
  source: TicketSource;
  name: string;
  contact: string;
  message: string;
  originalQuestion?: string;
  matchedKnowledgeIds?: string[];
  conversationEventId?: string;
  priority?: TicketPriority;
}

export interface TicketValidationResult {
  ok: boolean;
  errors: string[];
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function validateTicketInput(input: TicketInput): TicketValidationResult {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('이름을 입력해 주세요.');
  if (!input.contact.trim()) errors.push('연락처 또는 이메일을 입력해 주세요.');
  if (!input.message.trim()) errors.push('문의 내용을 입력해 주세요.');
  return { ok: errors.length === 0, errors };
}

export function createTicket(input: TicketInput): Ticket {
  const now = new Date().toISOString();
  return {
    id: `T-${Date.now().toString(36).toUpperCase()}`,
    botId: input.botId,
    status: 'new',
    priority: input.priority ?? 'normal',
    source: input.source,
    name: input.name.trim(),
    contact: input.contact.trim(),
    message: input.message.trim(),
    originalQuestion: input.originalQuestion,
    matchedKnowledgeIds: input.matchedKnowledgeIds ?? [],
    conversationEventId: input.conversationEventId,
    adminMemo: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function loadTickets(storage: StorageLike | null = getBrowserStorage()): Ticket[] {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(TICKETS_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as Ticket[]) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: Ticket[], storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
}

export function appendTicket(input: TicketInput, storage: StorageLike | null = getBrowserStorage()): Ticket {
  const ticket = createTicket(input);
  saveTickets([ticket, ...loadTickets(storage)], storage);
  return ticket;
}

export function updateTicket(ticketId: string, patch: Partial<Pick<Ticket, 'status' | 'priority' | 'adminMemo'>>, storage: StorageLike | null = getBrowserStorage()): Ticket[] {
  const updatedTickets = loadTickets(storage).map((ticket) =>
    ticket.id === ticketId ? { ...ticket, ...patch, updatedAt: new Date().toISOString() } : ticket,
  );
  saveTickets(updatedTickets, storage);
  return updatedTickets;
}

export function clearTickets(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.removeItem(TICKETS_STORAGE_KEY);
}

function escapeCsvCell(value: unknown): string {
  const rawValue = String(value ?? '');
  if (/[",\n]/.test(rawValue)) return `"${rawValue.replace(/"/g, '""')}"`;
  return rawValue;
}

export function ticketsToCsv(tickets: Ticket[]): string {
  const headers = ['id', 'botId', 'status', 'priority', 'source', 'name', 'contact', 'message', 'originalQuestion', 'matchedKnowledgeIds', 'adminMemo', 'createdAt', 'updatedAt'];
  const rows = tickets.map((ticket) => [
    ticket.id,
    ticket.botId,
    ticket.status,
    ticket.priority,
    ticket.source,
    ticket.name,
    ticket.contact,
    ticket.message,
    ticket.originalQuestion ?? '',
    ticket.matchedKnowledgeIds.join('|'),
    ticket.adminMemo,
    ticket.createdAt,
    ticket.updatedAt,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function ticketStatusLabel(status: TicketStatus): string {
  if (status === 'new') return '신규';
  if (status === 'inProgress') return '확인 중';
  if (status === 'resolved') return '답변 완료';
  return '보류';
}

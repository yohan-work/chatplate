import type { KnowledgeItem } from '../types/chatbot';

export type KnowledgeRelationDirection = 'outbound' | 'inbound' | 'mutual';

export interface KnowledgeGraphNode {
  id: string;
  item: KnowledgeItem;
  direction: KnowledgeRelationDirection | 'center';
}

export interface KnowledgeGraphEdge {
  from: string;
  to: string;
  directFromCenter: boolean;
}

export interface KnowledgeGraph {
  centerId: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  missingRelatedIds: string[];
}

export function buildKnowledgeGraph(knowledge: KnowledgeItem[], centerId: string): KnowledgeGraph | undefined {
  const byId = new Map(knowledge.map((item) => [item.id, item]));
  const center = byId.get(centerId);
  if (!center) return undefined;
  const outboundIds = new Set(center.relatedIds);
  const inboundIds = new Set(knowledge.filter((item) => item.relatedIds.includes(centerId)).map((item) => item.id));
  const relatedIds = new Set([...outboundIds, ...inboundIds].filter((id) => id !== centerId && byId.has(id)));
  const visibleIds = new Set([centerId, ...relatedIds]);
  const nodes: KnowledgeGraphNode[] = [
    { id: centerId, item: center, direction: 'center' },
    ...[...relatedIds].sort().map((id) => ({
      id,
      item: byId.get(id)!,
      direction: (outboundIds.has(id) && inboundIds.has(id) ? 'mutual' : outboundIds.has(id) ? 'outbound' : 'inbound') as KnowledgeRelationDirection,
    })),
  ];
  const edges = knowledge.flatMap((item) => item.relatedIds
    .filter((relatedId) => visibleIds.has(item.id) && visibleIds.has(relatedId))
    .map((relatedId) => ({ from: item.id, to: relatedId, directFromCenter: item.id === centerId || relatedId === centerId })))
    .filter((edge, index, values) => values.findIndex((value) => value.from === edge.from && value.to === edge.to) === index);
  return {
    centerId,
    nodes,
    edges,
    missingRelatedIds: [...new Set(center.relatedIds.filter((id) => !byId.has(id)))],
  };
}

export function answerSummary(item: KnowledgeItem, maxLength = 88): string {
  const compact = item.answer.replace(/\s+/gu, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

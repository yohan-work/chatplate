import { useMemo } from 'react';
import { answerSummary, buildKnowledgeGraph } from '../../engine/knowledgeGraph';
import type { KnowledgeItem } from '../../types/chatbot';

interface KnowledgeRelationGraphProps {
  knowledge: KnowledgeItem[];
  selectedKnowledgeId: string;
  onSelect: (knowledgeId: string) => void;
  large?: boolean;
}

function position(index: number, total: number): { left: string; top: string } {
  if (total === 1) return { left: '50%', top: '50%' };
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return { left: `${50 + Math.cos(angle) * 37}%`, top: `${50 + Math.sin(angle) * 37}%` };
}

export function KnowledgeRelationGraph({ knowledge, selectedKnowledgeId, onSelect, large = false }: KnowledgeRelationGraphProps) {
  const graph = useMemo(() => buildKnowledgeGraph(knowledge, selectedKnowledgeId), [knowledge, selectedKnowledgeId]);
  if (!graph) return null;
  const selected = graph.nodes.find((node) => node.id === selectedKnowledgeId)?.item;
  const relatedNodes = graph.nodes.filter((node) => node.direction !== 'center');
  const positions = new Map(graph.nodes.map((node, index) => [node.id, node.direction === 'center' ? { left: '50%', top: '50%' } : position(index - 1, relatedNodes.length)]));

  return (
    <section className={`knowledge-graph${large ? ' knowledge-graph--large' : ''}`} aria-label="연관 FAQ 관계도">
      <div className="knowledge-graph__heading">
        <strong>연관 질문 관계도</strong>
        <span>화살표는 현재 질문에서 추천되는 방향입니다.</span>
      </div>
      <div className="knowledge-graph__canvas">
        <svg className="knowledge-graph__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="knowledge-graph-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" /></marker>
          </defs>
          {graph.edges.map((edge) => {
            const from = positions.get(edge.from)!;
            const to = positions.get(edge.to)!;
            return <line key={`${edge.from}-${edge.to}`} x1={from.left} y1={from.top} x2={to.left} y2={to.top} className={edge.directFromCenter ? 'is-direct' : ''} markerEnd="url(#knowledge-graph-arrow)" />;
          })}
        </svg>
        {graph.nodes.map((node) => {
          const nodePosition = positions.get(node.id)!;
          return (
            <button
              className={`knowledge-graph__node knowledge-graph__node--${node.direction}${node.id === selectedKnowledgeId ? ' is-selected' : ''}`}
              key={node.id}
              type="button"
              style={nodePosition}
              onClick={() => onSelect(node.id)}
              aria-pressed={node.id === selectedKnowledgeId}
            >
              {node.item.question}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="knowledge-graph__detail" aria-live="polite">
          <strong>{selected.question}</strong>
          <span>{answerSummary(selected)}</span>
          <p>{selected.answer}</p>
          <span>연결 ID: {selected.relatedIds.join(', ') || '없음'}</span>
        </div>
      ) : null}
      {graph.missingRelatedIds.length ? <p className="knowledge-graph__warning">존재하지 않는 연결 ID: {graph.missingRelatedIds.join(', ')}</p> : null}
    </section>
  );
}

import { botConfigs } from '../data/bots';
import { coachMywayPhase4Scenarios, validateCoachMywayPhase4Corpus } from '../data/coachMywayPhase4Corpus';
import { buildCoachMywayConversationIntents, validateCoachMywayConversationIntents } from '../data/coachMywayConversationIntents';
import { evaluatePhase4Conversation } from './evaluatePhase4Conversation';

const config = botConfigs['coach-myway'];
const corpusErrors = validateCoachMywayPhase4Corpus(new Set(config.knowledge.map((item) => item.id)));
const intentErrors = validateCoachMywayConversationIntents(buildCoachMywayConversationIntents(config));
const validationErrors = [...corpusErrors, ...intentErrors];
if (validationErrors.length) throw new Error(validationErrors.join('\n'));

const phase3 = evaluatePhase4Conversation(coachMywayPhase4Scenarios, config, 'phase3');
const candidate = evaluatePhase4Conversation(coachMywayPhase4Scenarios, config, 'candidate');

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

console.log('# Phase 4 deterministic conversation A/B');
console.log(`- corpus: ${coachMywayPhase4Scenarios.length} scenarios`);
console.log(`- Phase 3 resolution: ${percent(phase3.summary.scenarioResolution)} (${phase3.summary.passedScenarios}/${phase3.summary.scenarios})`);
console.log(`- Phase 4 resolution: ${percent(candidate.summary.scenarioResolution)} (${candidate.summary.passedScenarios}/${candidate.summary.scenarios})`);
console.log(`- hard-gate failures: Phase 3 ${phase3.hardGateFailures}, Phase 4 ${candidate.hardGateFailures}`);
console.log('\n| Category | Phase 3 | Phase 4 |');
console.log('|---|---:|---:|');
candidate.categories.forEach((category) => {
  const before = phase3.categories.find((entry) => entry.category === category.category)!;
  console.log(`| ${category.category} | ${percent(before.scenarioResolution)} | ${percent(category.scenarioResolution)} |`);
});

const failures = candidate.categories.flatMap((category) =>
  candidate.verdicts.filter((verdict) => verdict.category === category.category && !verdict.passed).slice(0, 5),
);
if (failures.length) {
  console.log('\n## Representative Phase 4 failures');
  failures.forEach((failure) => console.log(
    `- ${failure.scenarioId}#${failure.turnIndex + 1}: ${failure.query} / policy=${failure.policy} / ids=${failure.knowledgeIds.join(',') || '-'} / missing=${failure.missingKnowledgeIds.join(',') || '-'}`,
  ));
}

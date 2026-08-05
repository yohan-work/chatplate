export const COACH_MYWAY_APPROVAL_PRIORITY_IDS = [
  'consultation-002',
  'fit-001',
  'fit-002',
  'fit-003',
  'program-001',
  'program-002',
  'consultation-001',
  'consultation-003',
  'consultation-004',
  'consultation-007',
  'policy-001',
  'pricing-003',
  'policy-003',
  'policy-005',
  'privacy-001',
] as const;

export const coachMywayApprovalPrioritySet = new Set<string>(COACH_MYWAY_APPROVAL_PRIORITY_IDS);

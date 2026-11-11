export type VisualFeedbackKind = 'success' | 'failure' | 'victory' | 'draw';

const LABELS: Record<VisualFeedbackKind, string> = {
  success: 'SUCCESS',
  failure: 'FAILED',
  victory: 'WINNER',
  draw: 'DRAW',
};

export function getVisualFeedbackPlan(
  kind: VisualFeedbackKind,
  visualEffectsEnabled: boolean,
  reducedMotion: boolean
) {
  return {
    animate: visualEffectsEnabled && !reducedMotion,
    essentialLabel: LABELS[kind],
    kind,
  } as const;
}


export const RANDOM_WAIT_MIN_MS = 1_000;
export const RANDOM_WAIT_RANGE_MS = 4_000;

export type ReactionEvaluation =
  | { kind: 'false-start'; reactionTime: number }
  | { kind: 'valid'; reactionTime: number }
  | { kind: 'late'; reactionTime: number };

export function createRandomWait(random: () => number = Math.random) {
  return RANDOM_WAIT_MIN_MS + random() * RANDOM_WAIT_RANGE_MS;
}

export function evaluateReaction(
  signalTime: number,
  releaseTime: number,
  deadline: number
): ReactionEvaluation {
  const reactionTime = releaseTime - signalTime;

  if (reactionTime < 0) {
    return { kind: 'false-start', reactionTime };
  }

  if (reactionTime <= deadline) {
    return { kind: 'valid', reactionTime };
  }

  return { kind: 'late', reactionTime };
}

export function compareReactionTimes(first: number, second: number) {
  if (first === second) return 'draw' as const;
  return first < second ? ('first' as const) : ('second' as const);
}

export type PlayerReactionTimes = { p1: number | null; p2: number | null };

export function recordPlayerReaction(
  current: PlayerReactionTimes,
  player: keyof PlayerReactionTimes,
  reactionTime: number
) {
  if (current[player] !== null) return current;
  return { ...current, [player]: reactionTime };
}

export function isCorrectTarget<T>(target: T, released: T) {
  return target === released;
}

export function isHeldAfterInput(event: 'press' | 'release' | 'cancel') {
  return event === 'press';
}

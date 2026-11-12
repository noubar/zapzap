import type { StatisticsState } from './types';

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: (statistics: StatisticsState) => number;
};

const totalZaps = (state: StatisticsState) =>
  state.singlePlayer['one-finger-single'].zapsAvoided +
  state.singlePlayer['two-finger-single'].zapsAvoided;

const multiplayerMatches = (state: StatisticsState) =>
  state.multiplayer['one-finger-multiplayer'].p1.matchesPlayed +
  state.multiplayer['two-finger-multiplayer'].p1.matchesPlayed;

const multiplayerWins = (state: StatisticsState) =>
  state.multiplayer['one-finger-multiplayer'].p1.matchesWon +
  state.multiplayer['one-finger-multiplayer'].p2.matchesWon +
  state.multiplayer['two-finger-multiplayer'].p1.matchesWon +
  state.multiplayer['two-finger-multiplayer'].p2.matchesWon;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'first-zap', title: 'First Zap', description: 'Complete one successful reaction.', target: 1, progress: (state) => state.overall.successfulReactions },
  { id: 'getting-started', title: 'Getting Started', description: 'Avoid 10 zaps.', target: 10, progress: totalZaps },
  { id: 'experienced', title: 'Experienced', description: 'Avoid 100 zaps.', target: 100, progress: totalZaps },
  { id: 'veteran', title: 'Veteran', description: 'Avoid 1,000 zaps.', target: 1_000, progress: totalZaps },
  { id: 'quick-reflexes', title: 'Quick Reflexes', description: 'Record a valid reaction under 250 ms.', target: 1, progress: (state) => state.overall.fastestReactionMs !== null && state.overall.fastestReactionMs < 250 ? 1 : 0 },
  { id: 'lightning-reflexes', title: 'Lightning Reflexes', description: 'Record a valid reaction under 200 ms.', target: 1, progress: (state) => state.overall.fastestReactionMs !== null && state.overall.fastestReactionMs < 200 ? 1 : 0 },
  { id: 'ultra-reflexes', title: 'Ultra Reflexes', description: 'Record a valid reaction under 150 ms.', target: 1, progress: (state) => state.overall.fastestReactionMs !== null && state.overall.fastestReactionMs < 150 ? 1 : 0 },
  { id: 'survivor', title: 'Survivor', description: 'Reach a 10-round success streak.', target: 10, progress: (state) => Math.max(state.singlePlayer['one-finger-single'].longestStreak, state.singlePlayer['two-finger-single'].longestStreak) },
  { id: 'untouchable', title: 'Untouchable', description: 'Reach a 25-round success streak.', target: 25, progress: (state) => Math.max(state.singlePlayer['one-finger-single'].longestStreak, state.singlePlayer['two-finger-single'].longestStreak) },
  { id: 'first-duel', title: 'First Duel', description: 'Complete a multiplayer match.', target: 1, progress: multiplayerMatches },
  { id: 'duel-winner', title: 'Duel Winner', description: 'Win a multiplayer match.', target: 1, progress: multiplayerWins },
  { id: 'duel-champion', title: 'Duel Champion', description: 'Win 25 multiplayer matches.', target: 25, progress: multiplayerWins },
  { id: 'no-panic', title: 'No Panic', description: 'Complete 10 successful reactions with Fake Signals.', target: 10, progress: (state) => state.successfulFakeSignalReactions },
  { id: 'two-finger-master', title: 'Two-Finger Master', description: 'Complete 50 successful two-finger reactions.', target: 50, progress: (state) => state.successfulTwoFingerReactions },
];

export function getAchievementProgress(definition: AchievementDefinition, state: StatisticsState) {
  return Math.min(definition.target, Math.max(0, definition.progress(state)));
}

export function nextAchievementNotification(
  queue: readonly AchievementDefinition[],
  gameplayActive: boolean
) {
  return gameplayActive ? null : queue[0] ?? null;
}


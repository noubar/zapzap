import type { Difficulty, MatchFormat } from '../settings/gameSettings';
import type { MultiplayerRoundOutcome, PlayerRoundResult } from '../gameplay/multiplayer';

export const GAME_VARIANTS = [
  'one-finger-single',
  'two-finger-single',
  'one-finger-multiplayer',
  'two-finger-multiplayer',
] as const;

export type GameVariant = (typeof GAME_VARIANTS)[number];
export type SinglePlayerVariant = Extract<GameVariant, `${string}-single`>;
export type MultiplayerVariant = Extract<GameVariant, `${string}-multiplayer`>;
export type FailureKind = 'false-start' | 'timeout' | 'wrong-finger' | 'cancelled' | 'late';
export type PlayerPosition = 'p1' | 'p2';

export type StatisticsConfiguration = {
  variant: GameVariant;
  difficulty: Difficulty;
  fakeSignalsEnabled: boolean;
  matchFormat?: MatchFormat;
};

export type ReactionAggregate = {
  roundsAttempted: number;
  successfulReactions: number;
  failedReactions: number;
  validReactionCount: number;
  reactionTimeTotalMs: number;
  fastestReactionMs: number | null;
  falseStarts: number;
  timeouts: number;
  wrongFingerFailures: number;
  lastPlayedAt: string | null;
};

export type SinglePlayerStatistics = {
  gamesStarted: number;
  gamesCompleted: number;
  zapsAvoided: number;
  currentStreak: number;
  longestStreak: number;
  reactions: ReactionAggregate;
};

export type MultiplayerPositionStatistics = {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  roundsDrawn: number;
  reactions: ReactionAggregate;
};

export type AchievementUnlock = { unlockedAt: string };

export type MultiplayerMatchFormatStatistics = {
  matchesPlayed: number;
  player1Wins: number;
  player2Wins: number;
  draws: number;
};

export type StatisticsState = {
  overall: ReactionAggregate;
  configurations: Record<string, ReactionAggregate>;
  singlePlayer: Record<SinglePlayerVariant, SinglePlayerStatistics>;
  multiplayer: Record<MultiplayerVariant, Record<PlayerPosition, MultiplayerPositionStatistics>>;
  multiplayerMatchFormats: Record<string, MultiplayerMatchFormatStatistics>;
  achievements: Record<string, AchievementUnlock>;
  successfulFakeSignalReactions: number;
  successfulTwoFingerReactions: number;
  processedEventIds: string[];
};

type BaseEvent = {
  id: string;
  occurredAt: string;
  configuration: StatisticsConfiguration;
};

export type StatisticsEvent =
  | (BaseEvent & {
      type: 'single-game-started';
      configuration: StatisticsConfiguration & { variant: SinglePlayerVariant };
    })
  | (BaseEvent & {
      type: 'single-round-completed';
      configuration: StatisticsConfiguration & { variant: SinglePlayerVariant };
      result: { kind: 'valid'; reactionTimeMs: number } | { kind: 'invalid'; reason: FailureKind };
      gameCompleted: boolean;
    })
  | (BaseEvent & {
      type: 'multiplayer-round-completed';
      configuration: StatisticsConfiguration & { variant: MultiplayerVariant; matchFormat: MatchFormat };
      results: { p1: PlayerRoundResult | null; p2: PlayerRoundResult | null };
      outcome: MultiplayerRoundOutcome;
    })
  | (BaseEvent & {
      type: 'multiplayer-match-completed';
      configuration: StatisticsConfiguration & { variant: MultiplayerVariant; matchFormat: MatchFormat };
      winner: PlayerPosition | 'draw';
    });


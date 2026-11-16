import { Heart } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import type { FakeSignalEvent } from '../gameplay/fakeSignals';
import {
  type GeneralMultiplayerSession,
  type GeneralPlayerId,
  type GeneralRoundOutcome,
} from '../gameplay/multiplayerEngine';
import { formatPlayerRoundResult } from '../gameplay/multiplayer';
import type { MatchFormat } from '../settings/gameSettings';

interface GeneralMultiplayerArenaProps {
  session: GeneralMultiplayerSession;
  matchFormat: MatchFormat;
  fakeSignal: FakeSignalEvent | null;
  outcome: GeneralRoundOutcome | null;
  onPressIn: (playerId: GeneralPlayerId) => void;
  onPressOut: (playerId: GeneralPlayerId, releaseTime: number, cancelled: boolean) => void;
}

const playerColors = ['#00E5FF', '#FF6D00', '#D500F9', '#76FF03', '#FFD600', '#FF4081', '#40C4FF', '#B2FF59'];

export default function GeneralMultiplayerArena({
  session,
  matchFormat,
  fakeSignal,
  outcome,
  onPressIn,
  onPressOut,
}: GeneralMultiplayerArenaProps) {
  const gestures = session.players.map((player) =>
    Gesture.LongPress()
      .minDuration(0)
      .maxDistance(100_000)
      .shouldCancelWhenOutside(false)
      .onStart(() => scheduleOnRN(onPressIn, player.id))
      .onEnd((_, success) =>
        scheduleOnRN(onPressOut, player.id, performance.now(), !success)
      )
  );
  gestures.forEach((gesture) => {
    gesture.simultaneousWithExternalGesture(...gestures.filter((candidate) => candidate !== gesture));
  });

  const renderRegion = (index: number, rotated: boolean) => {
    const player = session.players[index];
    if (!player) return null;
    const color = playerColors[index % playerColors.length];
    const unresolved = player.isActive && player.roundResult === null;
    const isGo = session.phase === 'go' && unresolved;
    const isFake = session.phase === 'waiting' && unresolved && fakeSignal !== null;
    const isWinner = outcome?.winnerIds.includes(player.id) ?? false;
    const score = matchFormat === 'three-lives'
      ? `LIVES ${player.lives}`
      : `WINS ${player.roundWins}`;
    const status = player.isEliminated
      ? 'ELIMINATED'
      : session.phase === 'idle'
        ? player.isHolding ? 'READY' : 'HOLD'
        : session.phase === 'waiting'
          ? player.roundResult ? 'LOCKED OUT' : fakeSignal ? 'IGNORE' : 'KEEP HOLDING'
          : session.phase === 'go'
            ? player.roundResult ? formatPlayerRoundResult(player.roundResult) : 'GO!'
            : isWinner ? 'ROUND WIN' : formatPlayerRoundResult(player.roundResult);

    return (
      <GestureDetector gesture={gestures[index]} key={player.id}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Player ${player.number} reaction region${isGo ? ', GO now' : ''}`}
          accessibilityHint="Touch and hold in this region. Moving outside keeps ownership until release or cancellation."
          style={[
            styles.region,
            rotated && styles.rotated,
            player.isHolding && session.phase !== 'go' && styles.held,
            isFake && { backgroundColor: fakeSignal.color },
            isGo && styles.go,
            player.isEliminated && styles.eliminated,
          ]}
          testID={`player-region-${player.number}`}
        >
          <Text style={[styles.playerLabel, { color }]}>PLAYER {player.number}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color }]}>{score}</Text>
            {matchFormat === 'three-lives' ? <Heart size={16} color={color} fill={color} /> : null}
          </View>
          <Text style={[styles.status, (isGo || fakeSignal?.colorName === 'amber') && styles.signalText]}>
            {status}
          </Text>
        </View>
      </GestureDetector>
    );
  };

  const playerCount = session.players.length;
  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {playerCount === 2 ? (
          <>
            <View style={styles.half}>{renderRegion(1, true)}</View>
            <View style={styles.half}>{renderRegion(0, false)}</View>
          </>
        ) : playerCount === 3 ? (
          <>
            <View style={styles.third}>{renderRegion(2, true)}</View>
            <View style={styles.twoThirdsRow}>
              <View style={styles.halfWidth}>{renderRegion(0, false)}</View>
              <View style={styles.halfWidth}>{renderRegion(1, false)}</View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.halfRow}>
              <View style={styles.halfWidth}>{renderRegion(2, true)}</View>
              <View style={styles.halfWidth}>{renderRegion(3, true)}</View>
            </View>
            <View style={styles.halfRow}>
              <View style={styles.halfWidth}>{renderRegion(0, false)}</View>
              <View style={styles.halfWidth}>{renderRegion(1, false)}</View>
            </View>
          </>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: arcadeColors.background },
  safeArea: { flex: 1, gap: arcadeMetrics.spacing.sm, padding: arcadeMetrics.spacing.sm },
  half: { flex: 1 },
  third: { flex: 1 },
  twoThirdsRow: { flex: 2, flexDirection: 'row', gap: arcadeMetrics.spacing.sm },
  halfRow: { flex: 1, flexDirection: 'row', gap: arcadeMetrics.spacing.sm },
  halfWidth: { flex: 1 },
  region: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: arcadeMetrics.spacing.sm,
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
    overflow: 'hidden',
  },
  rotated: { transform: [{ rotate: '180deg' }] },
  held: { backgroundColor: arcadeColors.surfaceHeld },
  go: { backgroundColor: arcadeColors.signal, borderColor: arcadeColors.signal },
  eliminated: { opacity: 0.38 },
  playerLabel: { ...arcadeTypography.eyebrow, fontSize: 14 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: arcadeMetrics.spacing.xs,
    marginTop: arcadeMetrics.spacing.xs,
  },
  score: { ...arcadeTypography.caption, fontWeight: '900' },
  status: { ...arcadeTypography.heading, marginTop: arcadeMetrics.spacing.sm, textAlign: 'center' },
  signalText: { color: arcadeColors.signalText },
});

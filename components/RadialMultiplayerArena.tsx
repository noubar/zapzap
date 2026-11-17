/* eslint-disable react-hooks/refs -- Gesture callbacks use mutable pointer ownership outside render. */
import { Heart } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import type { FakeSignalEvent } from '../gameplay/fakeSignals';
import { formatPlayerRoundResult } from '../gameplay/multiplayer';
import {
  type GeneralMultiplayerSession,
  type GeneralPlayerId,
  type GeneralRoundOutcome,
} from '../gameplay/multiplayerEngine';
import {
  assignRadialPointer,
  createRadialPointerOwnership,
  releaseRadialPointer,
} from '../gameplay/radialPointerOwnership';
import { createRadialArenaGeometry } from '../gameplay/radialGeometry';
import type { MatchFormat } from '../settings/gameSettings';

interface RadialMultiplayerArenaProps {
  session: GeneralMultiplayerSession;
  matchFormat: MatchFormat;
  fakeSignal: FakeSignalEvent | null;
  outcome: GeneralRoundOutcome | null;
  width: number;
  height: number;
  onPressIn: (playerId: GeneralPlayerId) => void;
  onPressOut: (playerId: GeneralPlayerId, releaseTime: number, cancelled: boolean) => void;
}

const playerColors = ['#00E5FF', '#FF6D00', '#D500F9', '#76FF03', '#FFD600', '#FF4081', '#40C4FF', '#B2FF59'];

function placementFor(outcome: GeneralRoundOutcome | null, playerId: GeneralPlayerId) {
  return outcome?.placements.find((placement) => placement.playerIds.includes(playerId))?.rank ?? null;
}

function geometryGeneration(width: number, height: number, playerCount: number) {
  return Math.round(width * 1000) * 31 + Math.round(height * 1000) * 17 + playerCount;
}

export default function RadialMultiplayerArena({
  session,
  matchFormat,
  fakeSignal,
  outcome,
  width,
  height,
  onPressIn,
  onPressOut,
}: RadialMultiplayerArenaProps) {
  const geometry = useMemo(() => createRadialArenaGeometry({
    playerCount: session.players.length,
    width,
    height,
    padding: 8,
    centerRatio: session.players.length >= 7 ? 0.16 : 0.19,
    rotation: -90,
  }), [height, session.players.length, width]);
  const generation = geometryGeneration(width, height, session.players.length);
  const ownershipRef = useRef(createRadialPointerOwnership(generation));
  const playerIds = useMemo(() => session.players.map((player) => player.id), [session.players]);
  const activePlayerIds = useMemo(() => new Set(
    session.players.filter((player) => player.isActive).map((player) => player.id)
  ), [session.players]);
  const runtimeRef = useRef({ geometry, playerIds, activePlayerIds, onPressIn, onPressOut });

  useEffect(() => {
    ownershipRef.current = createRadialPointerOwnership(generation);
    runtimeRef.current = { geometry, playerIds, activePlayerIds, onPressIn, onPressOut };
  }, [activePlayerIds, generation, geometry, onPressIn, onPressOut, playerIds]);

  const handlePointerDown = useCallback((
    pointerId: number,
    x: number,
    y: number,
    eventGeneration: number
  ) => {
    const runtime = runtimeRef.current;
    const assignment = assignRadialPointer(
      ownershipRef.current,
      eventGeneration,
      pointerId,
      x,
      y,
      runtime.geometry,
      runtime.playerIds,
      runtime.activePlayerIds
    );
    ownershipRef.current = assignment.state;
    if (assignment.playerId) runtime.onPressIn(assignment.playerId);
  }, []);
  const handlePointerEnd = useCallback((
    pointerId: number,
    releaseTime: number,
    cancelled: boolean,
    eventGeneration: number
  ) => {
    const release = releaseRadialPointer(ownershipRef.current, eventGeneration, pointerId);
    ownershipRef.current = release.state;
    if (release.playerId) runtimeRef.current.onPressOut(release.playerId, releaseTime, cancelled);
  }, []);

  const gesture = useMemo(() => Gesture.Manual()
    .onTouchesDown((event, manager) => {
      manager.activate();
      event.changedTouches.forEach((touch) =>
        scheduleOnRN(handlePointerDown, touch.id, touch.x, touch.y, generation)
      );
    })
    .onTouchesUp((event, manager) => {
      // eslint-disable-next-line react-hooks/purity -- This callback executes on touch release, not during render.
      const timestamp = performance.now();
      event.changedTouches.forEach((touch) =>
        scheduleOnRN(handlePointerEnd, touch.id, timestamp, false, generation)
      );
      if (event.allTouches.length === 0) manager.end();
    })
    .onTouchesCancelled((event, manager) => {
      // eslint-disable-next-line react-hooks/purity -- This callback executes on touch cancellation, not during render.
      const timestamp = performance.now();
      event.changedTouches.forEach((touch) =>
        scheduleOnRN(handlePointerEnd, touch.id, timestamp, true, generation)
      );
      if (event.allTouches.length === 0) manager.end();
    }), [generation, handlePointerDown, handlePointerEnd]);

  const centerStatus = session.phase === 'idle'
    ? 'ALL HOLD'
    : session.phase === 'waiting'
      ? fakeSignal ? 'IGNORE' : 'WAIT'
      : session.phase === 'go'
        ? 'GO!'
        : outcome?.isRoundDraw
          ? 'DRAW'
          : outcome?.winnerIds.length === 1
            ? `P${session.players.find((player) => player.id === outcome.winnerIds[0])?.number} WINS`
            : 'RESULT';

  return (
    <GestureHandlerRootView style={[styles.root, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${session.players.length} player radial reaction arena`}
          style={[styles.arena, { width, height }]}
          testID="radial-multiplayer-arena"
        >
          <Svg pointerEvents="none" width={width} height={height}>
            {geometry.sectors.map((sector, index) => {
              const player = session.players[index];
              const unresolved = player.isActive && player.roundResult === null;
              const isWinner = outcome?.winnerIds.includes(player.id) ?? false;
              const isPenalized = outcome?.penalizedIds.includes(player.id) ?? false;
              const fill = player.isEliminated
                ? '#080808'
                : session.phase === 'go' && unresolved
                  ? arcadeColors.signal
                  : session.phase === 'waiting' && fakeSignal && unresolved
                    ? fakeSignal.color
                    : session.phase === 'result' && isWinner
                      ? arcadeColors.success
                      : session.phase === 'result' && isPenalized
                        ? arcadeColors.failure
                        : player.isHolding
                          ? arcadeColors.surfaceHeld
                          : arcadeColors.surface;
              return (
                <Path
                  key={player.id}
                  d={sector.path}
                  fill={fill}
                  opacity={player.isEliminated ? 0.45 : 1}
                  stroke={arcadeColors.outline}
                  strokeWidth={3}
                />
              );
            })}
            <Circle
              cx={geometry.center.x}
              cy={geometry.center.y}
              r={geometry.innerRadius}
              fill={arcadeColors.background}
              stroke={arcadeColors.outline}
              strokeWidth={3}
            />
          </Svg>

          {geometry.sectors.map((sector, index) => {
            const player = session.players[index];
            const color = playerColors[index % playerColors.length];
            const placement = placementFor(outcome, player.id);
            const score = matchFormat === 'three-lives'
              ? `LIVES ${player.lives}`
              : `WINS ${player.roundWins}`;
            const result = player.isEliminated
              ? 'ELIMINATED'
              : player.roundResult
                ? `${placement ? `#${placement} ` : ''}${formatPlayerRoundResult(player.roundResult)}`
                : player.isHolding ? 'READY' : 'HOLD';
            const signalText = session.phase === 'go' && player.isActive && player.roundResult === null;
            return (
              <View
                key={player.id}
                pointerEvents="none"
                accessible
                accessibilityLabel={`Player ${player.number}. ${score}. ${result}`}
                style={[
                  styles.playerLabel,
                  {
                    left: sector.labelPoint.x - 55,
                    top: sector.labelPoint.y - 36,
                    transform: [{ rotate: `${sector.labelRotation}deg` }],
                  },
                ]}
              >
                <Text style={[styles.player, { color }, signalText && styles.signalText]}>P{player.number}</Text>
                <View style={styles.scoreRow}>
                  <Text style={[styles.score, { color }, signalText && styles.signalText]}>{score}</Text>
                  {matchFormat === 'three-lives' ? (
                    <Heart size={13} color={signalText ? arcadeColors.signalText : color} fill={signalText ? arcadeColors.signalText : color} />
                  ) : null}
                </View>
                <Text style={[styles.result, signalText && styles.signalText]} numberOfLines={2}>{result}</Text>
              </View>
            );
          })}

          <View
            pointerEvents="none"
            style={[
              styles.center,
              {
                left: geometry.center.x - geometry.innerRadius,
                top: geometry.center.y - geometry.innerRadius,
                width: geometry.innerRadius * 2,
                height: geometry.innerRadius * 2,
                borderRadius: geometry.innerRadius,
              },
            ]}
          >
            <Text style={styles.brand}>ZAPZAP</Text>
            <Text accessibilityLiveRegion="polite" style={styles.centerStatus}>{centerStatus}</Text>
          </View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: arcadeColors.background },
  arena: { backgroundColor: arcadeColors.background },
  playerLabel: {
    position: 'absolute',
    width: 110,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  player: { ...arcadeTypography.eyebrow, fontSize: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  score: { ...arcadeTypography.caption, fontSize: 10, fontWeight: '900' },
  result: { ...arcadeTypography.caption, marginTop: 2, color: arcadeColors.text, fontSize: 9, textAlign: 'center' },
  signalText: { color: arcadeColors.signalText },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', padding: arcadeMetrics.spacing.xs },
  brand: { ...arcadeTypography.eyebrow, color: arcadeColors.text, fontSize: 9, letterSpacing: 1 },
  centerStatus: { ...arcadeTypography.caption, marginTop: 2, color: arcadeColors.victory, fontSize: 10, fontWeight: '900', textAlign: 'center' },
});

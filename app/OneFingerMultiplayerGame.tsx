import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import GeneralMultiplayerArena from '../components/GeneralMultiplayerArena';
import GameResultScreen from '../components/GameResultScreen';
import RadialMultiplayerArena from '../components/RadialMultiplayerArena';
import { useFeedback } from '../feedback/FeedbackProvider';
import { evaluateReaction, createRandomWait } from '../gameplay/core';
import {
  createFakeSignalSchedule,
  scheduleFakeSignalEvents,
  type FakeSignalEvent,
} from '../gameplay/fakeSignals';
import {
  areGeneralPlayersReady,
  beginGeneralRound,
  cancelGeneralRound,
  createGeneralMultiplayerSession,
  fillGeneralTimeouts,
  getGeneralPlayer,
  isGeneralRoundComplete,
  prepareNextGeneralRound,
  recordGeneralRoundResult,
  resetGeneralMultiplayerSession,
  setGeneralPlayerHolding,
  settleGeneralRound,
  startGeneralSignal,
  type GeneralMultiplayerSession,
  type GeneralPlayerId,
  type GeneralRoundOutcome,
} from '../gameplay/multiplayerEngine';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { MATCH_FORMAT_LABELS, getReactionDeadline } from '../settings/gameSettings';
import {
  SMARTPHONE_MAX_PLAYERS,
  calculateEffectivePlayerCapacity,
  calculateOneFingerPlayerCapacity,
  clampPlayerCount,
} from '../settings/playerCount';
import { useStatistics } from '../statistics/StatisticsProvider';
import { useGlobalSettings } from '../contexts/GlobalSettings';
import { useTouchCapacity } from '../contexts/TouchCapacity';

const RESULT_DISPLAY_MS = 1_400;

export default function OneFingerMultiplayerGameScreen() {
  const params = useLocalSearchParams<{ players?: string | string[] }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const { observedCapacity } = useTouchCapacity();
  const { beginFeedbackSession, cancelFeedback, emitFeedback } = useFeedback();
  const { setGameplayActive } = useStatistics();
  const rawPlayers = Array.isArray(params.players) ? params.players[0] : params.players;
  const screenSpaceCapacity = calculateOneFingerPlayerCapacity(width, height);
  const effectiveCapacity = calculateEffectivePlayerCapacity(screenSpaceCapacity, observedCapacity);
  const [playerCount] = useState(() => clampPlayerCount(rawPlayers, effectiveCapacity));
  const useRadialArena = screenSpaceCapacity > SMARTPHONE_MAX_PLAYERS;
  const arenaDiameter = Math.max(240, Math.min(
    width - insets.left - insets.right - 16,
    height - insets.top - insets.bottom - 16
  ));
  const [matchFormat, setMatchFormat] = useState(settings.matchFormat);
  const matchFormatRef = useRef(matchFormat);
  const [session, setSession] = useState(() =>
    createGeneralMultiplayerSession(playerCount, matchFormat)
  );
  const [fakeSignal, setFakeSignal] = useState<FakeSignalEvent | null>(null);
  const [outcome, setOutcome] = useState<GeneralRoundOutcome | null>(null);

  const sessionRef = useRef(session);
  const timersRef = useRef(new RoundTimerManager());
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const fakeSignalsEnabledRef = useRef(false);
  const feedbackSessionRef = useRef(0);
  const settlementGuardRef = useRef(false);
  const viewportRef = useRef({ width, height });

  const syncSession = useCallback((next: GeneralMultiplayerSession) => {
    sessionRef.current = next;
    setSession(next);
    setGameplayActive(next.phase === 'waiting' || next.phase === 'go');
  }, [setGameplayActive]);

  const settleCurrentRound = useCallback(() => {
    if (settlementGuardRef.current) return;
    const settled = settleGeneralRound(sessionRef.current);
    if (!settled) return;
    settlementGuardRef.current = true;
    const resultTimerId = timersRef.current.beginRound();
    setFakeSignal(null);
    setOutcome(settled.outcome);
    syncSession(settled.session);

    const feedbackEvent = settled.outcome.isMatchComplete
      ? settled.outcome.isMatchDraw ? 'match-draw' : 'match-won'
      : settled.outcome.isRoundDraw ? 'match-draw' : 'round-won';
    emitFeedback(feedbackEvent, {
      eventId: `${settled.session.roundId}:outcome`,
      session: feedbackSessionRef.current,
    });

    if (!settled.outcome.isMatchComplete) {
      timersRef.current.schedule(resultTimerId, () => {
        settlementGuardRef.current = false;
        setOutcome(null);
        syncSession(prepareNextGeneralRound(sessionRef.current));
      }, RESULT_DISPLAY_MS);
    }
  }, [emitFeedback, syncSession]);

  const beginWaiting = useCallback((readySession: GeneralMultiplayerSession) => {
    const roundId = timersRef.current.beginRound();
    const waitingSession = beginGeneralRound(readySession, roundId);
    if (waitingSession === readySession) return;

    settlementGuardRef.current = false;
    roundDeadlineRef.current = getReactionDeadline(settings.difficulty);
    fakeSignalsEnabledRef.current = settings.fakeSignalsEnabled;
    feedbackSessionRef.current = beginFeedbackSession();
    setOutcome(null);
    setFakeSignal(null);
    syncSession(waitingSession);

    const realSignalDelayMs = createRandomWait();
    if (fakeSignalsEnabledRef.current) {
      const fakeSchedule = createFakeSignalSchedule(realSignalDelayMs);
      scheduleFakeSignalEvents(
        timersRef.current,
        roundId,
        fakeSchedule.events,
        setFakeSignal,
        (event) => setFakeSignal((current) => current?.id === event.id ? null : current)
      );
    }

    timersRef.current.schedule(roundId, () => {
      const current = sessionRef.current;
      if (current.phase !== 'waiting' || !areGeneralPlayersReady(current)) return;
      setFakeSignal(null);
      timersRef.current.scheduleFrame(roundId, (signalTimestamp) => {
        const signaled = startGeneralSignal(sessionRef.current, signalTimestamp);
        if (signaled === sessionRef.current) return;
        syncSession(signaled);
        emitFeedback('go', {
          fakeSignalsEnabled: fakeSignalsEnabledRef.current,
          eventId: `${roundId}:go`,
          session: feedbackSessionRef.current,
        });

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (sessionRef.current.phase !== 'go') return;
            const timedOut = fillGeneralTimeouts(sessionRef.current);
            syncSession(timedOut);
            settleCurrentRound();
          });
        }, roundDeadlineRef.current);
      });
    }, realSignalDelayMs);
  }, [beginFeedbackSession, emitFeedback, settings.difficulty, settings.fakeSignalsEnabled, settleCurrentRound, syncSession]);

  const onPressIn = useCallback((playerId: GeneralPlayerId) => {
    if (sessionRef.current.phase !== 'idle') return;
    const next = setGeneralPlayerHolding(sessionRef.current, playerId, true);
    syncSession(next);
    if (areGeneralPlayersReady(next)) beginWaiting(next);
  }, [beginWaiting, syncSession]);

  const onPressOut = useCallback((
    playerId: GeneralPlayerId,
    releaseTime: number,
    cancelled: boolean
  ) => {
    const current = sessionRef.current;
    const player = getGeneralPlayer(current, playerId);
    if (!player || player.roundResult !== null || !player.isActive) return;

    let next = setGeneralPlayerHolding(current, playerId, false);
    if (current.phase === 'idle') {
      syncSession(next);
      return;
    }
    if (current.phase === 'result' || current.phase === 'finished') return;

    if (current.phase === 'waiting') {
      next = recordGeneralRoundResult(next, playerId, {
        kind: 'invalid',
        reason: cancelled ? 'cancelled' : 'false-start',
      });
    } else if (cancelled) {
      next = recordGeneralRoundResult(next, playerId, { kind: 'invalid', reason: 'cancelled' });
    } else if (current.signalTimestamp !== null) {
      const evaluation = evaluateReaction(
        current.signalTimestamp,
        releaseTime,
        roundDeadlineRef.current
      );
      next = recordGeneralRoundResult(
        next,
        playerId,
        evaluation.kind === 'valid'
          ? { kind: 'valid', reactionTime: evaluation.reactionTime }
          : { kind: 'invalid', reason: evaluation.kind === 'false-start' ? 'false-start' : 'late' }
      );
    }

    syncSession(next);
    if (isGeneralRoundComplete(next)) settleCurrentRound();
  }, [settleCurrentRound, syncSession]);

  const resetGame = useCallback(() => {
    timersRef.current.invalidate();
    cancelFeedback();
    matchFormatRef.current = settings.matchFormat;
    setMatchFormat(settings.matchFormat);
    settlementGuardRef.current = false;
    setFakeSignal(null);
    setOutcome(null);
    syncSession(resetGeneralMultiplayerSession({
      ...sessionRef.current,
      matchFormat: matchFormatRef.current,
    }));
  }, [cancelFeedback, settings.matchFormat, syncSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' || sessionRef.current.phase === 'finished') return;
      timersRef.current.invalidate();
      cancelFeedback();
      settlementGuardRef.current = false;
      setFakeSignal(null);
      setOutcome(null);
      syncSession(cancelGeneralRound(sessionRef.current));
    });
    return () => subscription.remove();
  }, [cancelFeedback, syncSession]);

  useEffect(() => {
    const previous = viewportRef.current;
    viewportRef.current = { width, height };
    if (previous.width === width && previous.height === height) return;
    if (sessionRef.current.phase === 'finished') return;
    timersRef.current.invalidate();
    cancelFeedback();
    settlementGuardRef.current = false;
    setFakeSignal(null);
    setOutcome(null);
    syncSession(cancelGeneralRound(sessionRef.current));
  }, [cancelFeedback, height, syncSession, width]);

  useEffect(() => () => {
    timersRef.current.invalidate();
    cancelFeedback();
    setGameplayActive(false);
  }, [cancelFeedback, setGameplayActive]);

  if (session.phase === 'finished') {
    const winner = outcome?.matchWinnerIds[0];
    const winnerPlayer = winner ? getGeneralPlayer(session, winner) : null;
    return (
      <>
        <Stack.Screen options={{ orientation: useRadialArena ? 'default' : 'portrait' }} />
        <GameResultScreen
          title={winnerPlayer ? `PLAYER ${winnerPlayer.number} WINS` : 'DRAW'}
          message={`${playerCount}-player ${MATCH_FORMAT_LABELS[matchFormat]} match complete`}
          tone={winnerPlayer ? 'victory' : 'draw'}
          stats={session.players.map((player) => ({
            label: `Player ${player.number}`,
            value: matchFormat === 'three-lives'
              ? `${player.lives} lives${player.isEliminated ? ' · eliminated' : ''}`
              : `${player.roundWins} wins`,
          }))}
          onPlayAgain={resetGame}
          onMainMenu={() => router.replace('/')}
          visualEffectsEnabled={settings.visualEffectsEnabled}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ orientation: useRadialArena ? 'default' : 'portrait' }} />
      <View style={styles.container}>
        {useRadialArena ? (
          <SafeAreaView style={styles.radialSafeArea} edges={['top', 'bottom', 'left', 'right']}>
            <RadialMultiplayerArena
              session={session}
              matchFormat={matchFormat}
              fakeSignal={fakeSignal}
              outcome={outcome}
              width={arenaDiameter}
              height={arenaDiameter}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            />
          </SafeAreaView>
        ) : (
          <GeneralMultiplayerArena
            session={session}
            matchFormat={matchFormat}
            fakeSignal={fakeSignal}
            outcome={outcome}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  radialSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
});

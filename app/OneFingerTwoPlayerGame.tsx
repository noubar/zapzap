import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import TwoPlayerGameContent from '../components/OneFingerTwoPlayerContent';
import {
  compareReactionTimes,
  createRandomWait,
  evaluateReaction,
  isHeldAfterInput,
  recordPlayerReaction,
} from '../gameplay/core';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { useGlobalSettings } from './GlobalSettings';

type Player = 'p1' | 'p2';
type GameState = 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';

const REACTION_DEADLINE_MS = 500;

export default function TwoPlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isFilled, setIsFilled] = useState(false);
  const [reactionTimes, setReactionTimes] = useState<{ p1: number | null; p2: number | null }>({
    p1: null,
    p2: null,
  });
  const [lives, setLives] = useState({ p1: 3, p2: 3 });
  const [roundWinner, setRoundWinner] = useState('');
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ p1: false, p2: false });

  const timersRef = useRef(new RoundTimerManager());
  const startTimeRef = useRef<number | null>(null);
  const touchHeldRef = useRef({ p1: false, p2: false });
  const reactionTimesRef = useRef<{ p1: number | null; p2: number | null }>({
    p1: null,
    p2: null,
  });
  const gameStateRef = useRef<GameState>('idle');
  const roundResolvedRef = useRef(false);

  useEffect(() => () => timersRef.current.invalidate(), []);

  useEffect(() => {
    if (lives.p1 <= 0 && lives.p2 > 0) {
      setRoundWinner('Player 2');
      updateGameState('game-over');
    } else if (lives.p2 <= 0 && lives.p1 > 0) {
      setRoundWinner('Player 1');
      updateGameState('game-over');
    } else if (lives.p1 <= 0 && lives.p2 <= 0) {
      setRoundWinner('Draw');
      updateGameState('game-over');
    }
  }, [lives]);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
  };

  const resetReadiness = () => {
    touchHeldRef.current = { p1: false, p2: false };
    setHasTouchedToStart({ p1: false, p2: false });
  };

  const resetGame = () => {
    timersRef.current.invalidate();
    startTimeRef.current = null;
    reactionTimesRef.current = { p1: null, p2: null };
    roundResolvedRef.current = false;
    resetReadiness();
    updateGameState('idle');
    setIsFilled(false);
    setReactionTimes({ p1: null, p2: null });
    setLives({ p1: 3, p2: 3 });
    setRoundWinner('');
    setBestReactionTime(null);
  };

  const finishRound = (roundId: number) => {
    updateGameState('round-result');
    setIsFilled(false);
    resetReadiness();
    timersRef.current.schedule(roundId, () => {
      if (gameStateRef.current !== 'game-over') updateGameState('idle');
    }, 1_000);
  };

  const resolveRound = (
    roundId: number,
    loser: Player | 'both' | 'none',
    winnerLabel: string
  ) => {
    if (roundResolvedRef.current || !timersRef.current.isCurrent(roundId)) return;
    roundResolvedRef.current = true;

    if (loser === 'both') {
      setLives((previous) => ({
        p1: Math.max(0, previous.p1 - 1),
        p2: Math.max(0, previous.p2 - 1),
      }));
    } else if (loser !== 'none') {
      setLives((previous) => ({
        ...previous,
        [loser]: Math.max(0, previous[loser] - 1),
      }));
    }

    setRoundWinner(winnerLabel);
    finishRound(roundId);
  };

  const beginWaitingForZap = () => {
    const roundId = timersRef.current.beginRound();
    roundResolvedRef.current = false;
    startTimeRef.current = null;
    reactionTimesRef.current = { p1: null, p2: null };
    setReactionTimes({ p1: null, p2: null });
    setRoundWinner('');
    setIsFilled(false);
    updateGameState('waiting');

    timersRef.current.schedule(roundId, () => {
      if (!touchHeldRef.current.p1 || !touchHeldRef.current.p2) return;

      setIsFilled(true);
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        startTimeRef.current = frameTime;
        updateGameState('zap');

        if (settings.vibrationEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap') return;
            const p1Valid = reactionTimesRef.current.p1 !== null;
            const p2Valid = reactionTimesRef.current.p2 !== null;

            if (!p1Valid && !p2Valid) {
              resolveRound(roundId, 'both', 'Both slow - draw');
            } else if (!p1Valid) {
              resolveRound(roundId, 'p1', 'Player 2');
            } else if (!p2Valid) {
              resolveRound(roundId, 'p2', 'Player 1');
            }
          });
        }, REACTION_DEADLINE_MS);
      });
    }, createRandomWait());
  };

  const onPlayerPressIn = (player: Player) => {
    if (gameStateRef.current !== 'idle') return;
    touchHeldRef.current[player] = isHeldAfterInput('press');
    setHasTouchedToStart((previous) => ({ ...previous, [player]: true }));

    if (touchHeldRef.current.p1 && touchHeldRef.current.p2) {
      beginWaitingForZap();
    }
  };

  const onPlayerPressOut = (player: Player, releaseTime: number, cancelled: boolean) => {
    const stateAtRelease = gameStateRef.current;
    touchHeldRef.current[player] = isHeldAfterInput(cancelled ? 'cancel' : 'release');
    setHasTouchedToStart((previous) => ({ ...previous, [player]: false }));

    if (stateAtRelease === 'idle' || stateAtRelease === 'round-result' || stateAtRelease === 'game-over') {
      return;
    }

    if (stateAtRelease === 'waiting') {
      const roundId = timersRef.current.beginRound();
      roundResolvedRef.current = false;
      resolveRound(roundId, player, player === 'p1' ? 'Player 2' : 'Player 1');
      return;
    }

    if (stateAtRelease !== 'zap' || startTimeRef.current === null) return;
    if (reactionTimesRef.current[player] !== null) return;
    const roundId = timersRef.current.beginRound();
    const evaluation = evaluateReaction(
      startTimeRef.current,
      releaseTime,
      REACTION_DEADLINE_MS
    );

    if (evaluation.kind !== 'valid') {
      roundResolvedRef.current = false;
      resolveRound(roundId, player, player === 'p1' ? 'Player 2' : 'Player 1');
      return;
    }

    reactionTimesRef.current = recordPlayerReaction(
      reactionTimesRef.current,
      player,
      evaluation.reactionTime
    );
    setReactionTimes(reactionTimesRef.current);

    const other: Player = player === 'p1' ? 'p2' : 'p1';
    const otherTime = reactionTimesRef.current[other];
    if (otherTime === null) {
      timersRef.current.schedule(roundId, () => {
        timersRef.current.scheduleFrame(roundId, () => {
          if (gameStateRef.current === 'zap') {
            resolveRound(roundId, other, player === 'p1' ? 'Player 1' : 'Player 2');
          }
        });
      }, Math.max(0, REACTION_DEADLINE_MS - evaluation.reactionTime));
      return;
    }

    const comparison = compareReactionTimes(evaluation.reactionTime, otherTime);
    const fastest = Math.min(evaluation.reactionTime, otherTime);
    setBestReactionTime((previous) => previous === null ? fastest : Math.min(previous, fastest));
    roundResolvedRef.current = false;

    if (comparison === 'draw') {
      resolveRound(roundId, 'none', 'Draw');
    } else if (comparison === 'first') {
      resolveRound(roundId, other, player === 'p1' ? 'Player 1' : 'Player 2');
    } else {
      resolveRound(roundId, player, other === 'p1' ? 'Player 1' : 'Player 2');
    }
  };

  return (
    <View style={styles.container}>
      <TwoPlayerGameContent
        isFilled={isFilled}
        lives={lives}
        onPlayerPressIn={onPlayerPressIn}
        onPlayerPressOut={onPlayerPressOut}
        roundWinner={roundWinner}
        gameState={gameState}
        reactionTime={reactionTimes}
        bestReactionTime={bestReactionTime}
        resetGame={resetGame}
        router={router}
        hasTouchedToStart={hasTouchedToStart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
});

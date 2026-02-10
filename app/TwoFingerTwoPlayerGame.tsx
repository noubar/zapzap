// TwoVsTwoGame.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TwoVsTwoGameContent from '../components/TwoFingerTwoPlayerContent';

type Player = 'p1' | 'p2';
type BoxIndex = 0 | 1;

type GameState = 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';

export default function TwoVsTwoGameScreen() {
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>('idle');

  // Which box zaps for each player during the current round (0=left, 1=right)
  const [targets, setTargets] = useState<{ p1: BoxIndex | null; p2: BoxIndex | null }>({
    p1: null,
    p2: null,
  });

  // Reaction time measured only when player releases the CORRECT (target) finger after zap
  const [reactionTimes, setReactionTimes] = useState<{ p1: number | null; p2: number | null }>({
    p1: null,
    p2: null,
  });

  const [lives, setLives] = useState<{ p1: number; p2: number }>({ p1: 3, p2: 3 });
  const [roundWinner, setRoundWinner] = useState<string>('');
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);

  // Whether each player is currently holding BOTH of their boxes (used for "waiting..." UI)
  const [hasTouchedToStart, setHasTouchedToStart] = useState<{ p1: boolean; p2: boolean }>({
    p1: false,
    p2: false,
  });

  // Timers & refs
  const timerRef = useRef<number | null>(null); // waiting -> zap delay
  const zapTimeoutRef = useRef<number | null>(null); // reaction limit window (punish slow holders)
  const startTimeRef = useRef<number | null>(null); // timestamp when zap happened
  const gameStateRef = useRef<GameState>(gameState);

  // per-box hold state: p1: [left,right], p2: [left,right]
  const touchHeldRef = useRef<{ p1: [boolean, boolean]; p2: [boolean, boolean] }>({
    p1: [false, false],
    p2: [false, false],
  });

  // Avoid stale captures inside timeouts
  const targetsRef = useRef<{ p1: BoxIndex | null; p2: BoxIndex | null }>(targets);
  const reactionTimesRef = useRef<{ p1: number | null; p2: number | null }>(reactionTimes);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    reactionTimesRef.current = reactionTimes;
  }, [reactionTimes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);
    };
  }, []);

  // game over when lives reach 0
  useEffect(() => {
    if (lives.p1 <= 0 && lives.p2 > 0) {
      setRoundWinner('Player 2');
      setGameState('game-over');
    } else if (lives.p2 <= 0 && lives.p1 > 0) {
      setRoundWinner('Player 1');
      setGameState('game-over');
    } else if (lives.p1 <= 0 && lives.p2 <= 0) {
      setRoundWinner('Draw');
      setGameState('game-over');
    }
  }, [lives]);

  const getRandomTime = () => Math.random() * 4000 + 1000; // 1s..5s
  const getReactionLimit = () => 500;

  const resetGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);

    setGameState('idle');
    setTargets({ p1: null, p2: null });
    setReactionTimes({ p1: null, p2: null });
    setLives({ p1: 3, p2: 3 });
    setRoundWinner('');
    setHasTouchedToStart({ p1: false, p2: false });
    touchHeldRef.current = { p1: [false, false], p2: [false, false] };
    startTimeRef.current = null;
    setBestReactionTime(null);

    // keep refs in sync immediately
    targetsRef.current = { p1: null, p2: null };
    reactionTimesRef.current = { p1: null, p2: null };
  };

  const endRoundAndReturnToIdle = () => {
    setTargets({ p1: null, p2: null });
    setHasTouchedToStart({ p1: false, p2: false });

    targetsRef.current = { p1: null, p2: null };

    setTimeout(() => {
      if (gameStateRef.current !== 'game-over') setGameState('idle');
    }, 1000);
  };

  const resolveRound = (loser: Player | 'draw', winnerLabel?: string) => {
    if (loser === 'draw') {
      setLives((prev) => ({
        p1: Math.max(0, prev.p1 - 1),
        p2: Math.max(0, prev.p2 - 1),
      }));
      setRoundWinner('Both slow - draw');
    } else {
      setLives((prev) => ({ ...prev, [loser]: Math.max(0, prev[loser] - 1) }));
      if (winnerLabel) setRoundWinner(winnerLabel);
    }

    setGameState('round-result');

    // stop timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (zapTimeoutRef.current) {
      clearTimeout(zapTimeoutRef.current);
      zapTimeoutRef.current = null;
    }

    endRoundAndReturnToIdle();
  };

  // Start waiting -> zap sequence (called when both players are holding BOTH their boxes)
  const beginWaitingForZap = () => {
    setGameState('waiting');
    setTargets({ p1: null, p2: null });
    setReactionTimes({ p1: null, p2: null });
    setRoundWinner('');
    startTimeRef.current = null;

    targetsRef.current = { p1: null, p2: null };
    reactionTimesRef.current = { p1: null, p2: null };

    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);

    const fillDelay = getRandomTime();
    timerRef.current = setTimeout(() => {
      if (gameStateRef.current === 'game-over') return;

      const t1: BoxIndex = Math.random() < 0.5 ? 0 : 1;
      const t2: BoxIndex = Math.random() < 0.5 ? 0 : 1;

      setTargets({ p1: t1, p2: t2 });
      targetsRef.current = { p1: t1, p2: t2 };

      startTimeRef.current = performance.now();
      setGameState('zap');

      // After reaction limit, punish any player who has NOT released the correct finger yet.
      zapTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'zap') return;

        const p1Target = targetsRef.current.p1;
        const p2Target = targetsRef.current.p2;

        const p1StillHoldingTarget =
          p1Target !== null ? touchHeldRef.current.p1[p1Target] : false;
        const p2StillHoldingTarget =
          p2Target !== null ? touchHeldRef.current.p2[p2Target] : false;

        const p1ReleasedCorrect = reactionTimesRef.current.p1 !== null;
        const p2ReleasedCorrect = reactionTimesRef.current.p2 !== null;

        // If both failed to release correct in time -> draw (both lose life)
        if (!p1ReleasedCorrect && !p2ReleasedCorrect && p1StillHoldingTarget && p2StillHoldingTarget) {
          resolveRound('draw');
          return;
        }

        // If one released correct, the other didn't -> other loses
        if (p1ReleasedCorrect && !p2ReleasedCorrect && p2StillHoldingTarget) {
          resolveRound('p2', 'Player 1');
          return;
        }
        if (p2ReleasedCorrect && !p1ReleasedCorrect && p1StillHoldingTarget) {
          resolveRound('p1', 'Player 2');
          return;
        }

        // Fallback: if state is odd, treat as no result (no life change) but end round
        setRoundWinner('No result');
        setGameState('round-result');
        endRoundAndReturnToIdle();
      }, getReactionLimit());
    }, fillDelay);
  };

  // Any release before zap (during waiting) means that player loses immediately.
  const resolveRoundOnWaitingRelease = (releasingPlayer: Player) => {
    resolveRound(releasingPlayer, releasingPlayer === 'p1' ? 'Player 2' : 'Player 1');
  };

  // Release during zap:
  // - if wrong finger: immediate loss
  // - if correct finger: record reaction time; if other already correct, compare
  const resolveRoundOnZapRelease = (player: Player, index: BoxIndex, releaseTime: number) => {
    const startTime = startTimeRef.current;
    if (startTime === null) {
      // zap hasn't happened yet (safety)
      resolveRoundOnWaitingRelease(player);
      return;
    }

    const target = targetsRef.current[player];
    if (target === null) return;

    // Wrong finger lifted -> immediate loss
    if (index !== target) {
      resolveRound(player, player === 'p1' ? 'Player 2' : 'Player 1');
      return;
    }

    // Correct finger lifted -> record time if not already recorded
    if (reactionTimesRef.current[player] === null) {
      const timeDiff = releaseTime - startTime;

      setReactionTimes((prev) => ({ ...prev, [player]: timeDiff }));
      reactionTimesRef.current = { ...reactionTimesRef.current, [player]: timeDiff };

      const other: Player = player === 'p1' ? 'p2' : 'p1';
      const otherTime = reactionTimesRef.current[other];

      // If other already released correct -> compare and resolve
      if (otherTime !== null && otherTime !== undefined) {
        if (timeDiff === otherTime) {
          setRoundWinner('Draw');
          setGameState('round-result');
        } else if (timeDiff > otherTime) {
          // player was slower -> player loses
          setLives((prev) => ({ ...prev, [player]: Math.max(0, prev[player] - 1) }));
          setRoundWinner(other === 'p1' ? 'Player 1' : 'Player 2');
          setGameState('round-result');
        } else {
          // other was slower -> other loses
          setLives((prev) => ({ ...prev, [other]: Math.max(0, prev[other] - 1) }));
          setRoundWinner(player === 'p1' ? 'Player 1' : 'Player 2');
          setGameState('round-result');
        }

        const fastest = Math.min(timeDiff, otherTime);
        setBestReactionTime((prev) => (prev === null ? fastest : Math.min(prev, fastest)));

        // stop zap timeout (round already decided)
        if (zapTimeoutRef.current) {
          clearTimeout(zapTimeoutRef.current);
          zapTimeoutRef.current = null;
        }

        endRoundAndReturnToIdle();
      }

      // otherwise: wait for other player's correct release or timeout
    }
  };

  const onBoxPressIn = (player: Player, index: BoxIndex) => {
    touchHeldRef.current[player][index] = true;
    const bothTouched = touchHeldRef.current[player][0] && touchHeldRef.current[player][1];
    setHasTouchedToStart((prev) => ({ ...prev, [player]: bothTouched }));

    const p1Both = touchHeldRef.current.p1[0] && touchHeldRef.current.p1[1];
    const p2Both = touchHeldRef.current.p2[0] && touchHeldRef.current.p2[1];

    // Start round only when BOTH players are holding BOTH boxes, while idle
    if (p1Both && p2Both && gameStateRef.current === 'idle') {
      beginWaitingForZap();
    }
  };

  const onBoxPressOut = (player: Player, index: BoxIndex) => {
    const releaseTime = performance.now();

    touchHeldRef.current[player][index] = false;
    setHasTouchedToStart((prev) => ({ ...prev, [player]: false }));

    if (gameStateRef.current === 'idle') return;

    if (gameStateRef.current === 'waiting') {
      // Any finger release before zap -> that player loses immediately
      resolveRoundOnWaitingRelease(player);
      return;
    }

    if (gameStateRef.current === 'zap') {
      resolveRoundOnZapRelease(player, index, releaseTime);
      return;
    }

    // round-result / game-over -> ignore
  };

  return (
    <View style={styles.container}>
      <TwoVsTwoGameContent
        targets={targets}
        lives={lives}
        onBoxPressIn={onBoxPressIn}
        onBoxPressOut={onBoxPressOut}
        roundWinner={roundWinner}
        gameState={gameState}
        reactionTimes={reactionTimes}
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



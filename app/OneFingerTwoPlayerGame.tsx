import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TwoPlayerGameContent from '../components/OneFingerTwoPlayerContent';
import { useGlobalSettings } from './GlobalSettings';


type Player = 'p1' | 'p2';

export default function TwoPlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const vibrationEnabled = settings.vibrationEnabled;

  const [gameState, setGameState] = useState<
    'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over'
  >('idle');

  const [isFilled, setIsFilled] = useState(false);
  const [reactionTimes, setReactionTimes] = useState<{ p1: number | null; p2: number | null }>({
    p1: null,
    p2: null,
  });
  const [lives, setLives] = useState<{ p1: number; p2: number }>({ p1: 3, p2: 3 });
  const [roundWinner, setRoundWinner] = useState<string>('');
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState<{ p1: boolean; p2: boolean }>({
    p1: false,
    p2: false,
  });


  // refs for timers & state used in callbacks
  const timerRef = useRef<number | null>(null);
  const zapTimeoutRef = useRef<number | null>(null); // timeout to punish holders after zap if they don't release within reactionLimit
  const startTimeRef = useRef<number | null>(null); // timestamp when zap occurred
  const touchHeldRef = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false }); // currently holding
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);
    };
  }, []);

  // check game-over when lives change
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

  const resetGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);
    setGameState('idle');
    setIsFilled(false);
    setReactionTimes({ p1: null, p2: null });
    setLives({ p1: 3, p2: 3 });
    setRoundWinner('');
    setHasTouchedToStart({ p1: false, p2: false });
    touchHeldRef.current = { p1: false, p2: false };
    startTimeRef.current = null;
    setBestReactionTime(null);
  };

  const getRandomTime = () => Math.random() * 4000 + 1000; // 1s to 5s
  
  // After the reactionLimit window, punish any player still holding (they are too slow)
  const getReactionLimit = () => {
    return 500; // default time in ms not changable in game
  };

  // start the timed "waiting" -> "zap" process (called when both players are holding)
  const beginWaitingForZap = () => {
    // set waiting state
    setGameState('waiting');
    setIsFilled(false);
    setReactionTimes({ p1: null, p2: null });
    setRoundWinner('');
    startTimeRef.current = null;

    // clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);

    const fillDelay = getRandomTime();
    timerRef.current = setTimeout(() => {
      // if game ended in the meantime, abort
      if (gameStateRef.current === 'game-over') return;

      // zap!
      setIsFilled(true);
      startTimeRef.current = performance.now();
      setGameState('zap');
      if (vibrationEnabled) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      zapTimeoutRef.current = setTimeout(() => {
        // if round already resolved, nothing to do
        if (gameStateRef.current !== 'zap') return;

        const p1Still = touchHeldRef.current.p1;
        const p2Still = touchHeldRef.current.p2;

        // If both still holding -> both lose a life (or draw)
        if (p1Still && p2Still) {
          setLives((prev) => ({ p1: Math.max(0, prev.p1 - 1), p2: Math.max(0, prev.p2 - 1) }));
          setRoundWinner('Both slow - draw');
        } else if (p1Still) {
          // p1 lost by not releasing
          setLives((prev) => ({ ...prev, p1: Math.max(0, prev.p1 - 1) }));
          setRoundWinner('Player 2');
        } else if (p2Still) {
          // p2 lost by not releasing
          setLives((prev) => ({ ...prev, p2: Math.max(0, prev.p2 - 1) }));
          setRoundWinner('Player 1');
        } else {
          // nobody is holding but we timed out - unlikely because releases set results
          setRoundWinner('No result');
        }

        setGameState('round-result');
        setIsFilled(false);
        setHasTouchedToStart({ p1: false, p2: false });
        // schedule next round if game not over
        setTimeout(() => {
          if (gameStateRef.current !== 'game-over') {
            setGameState('idle');
          }
        }, 1000);
      }, getReactionLimit());
    }, fillDelay);
  };

  // player pressed down (either before or after both started)
  const onPlayerPressIn = (player: Player) => {
    // mark player as holding
    touchHeldRef.current[player] = true;
    setHasTouchedToStart((prev) => ({ ...prev, [player]: true }));
    
    // if both players are holding and we're idle => start waiting -> zap sequence
    if (touchHeldRef.current.p1 && touchHeldRef.current.p2 && gameStateRef.current === 'idle') {
      beginWaitingForZap();
    }
  };

  const resolveRoundOnWaitingRelease = (releasingPlayer: Player) => {
    // If startTime is null, player released before zap -> premature release loses a life instantly
    // premature release -> this releasing player loses a life immediately
    setLives((prev) => ({ ...prev, [releasingPlayer]: Math.max(0, prev[releasingPlayer] - 1) }));
    setRoundWinner(releasingPlayer === 'p1' ? 'Player 2' : 'Player 1');
    setGameState('round-result');
    setIsFilled(false);
    setHasTouchedToStart({ p1: false, p2: false });

    // clear timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimeoutRef.current) clearTimeout(zapTimeoutRef.current);

    setTimeout(() => {
      if (gameStateRef.current !== 'game-over') setGameState('idle');
    }, 1000);
    return;
  };
  
  // helper to resolve round when one or both players released during zap or early
  const resolveRoundOnRelease = (releasingPlayer: Player, releaseTime: number) => {
    const startTime = startTimeRef.current;
    // If startTime is null, player released before zap -> premature release loses a life instantly
    if (startTime === null) {
      resolveRoundOnWaitingRelease(releasingPlayer);
      return;
    }
    // normal case: zap has happened and we compare reaction times
    const timeDiff = releaseTime - startTime;
    reactionTimes[releasingPlayer]= timeDiff;

    // If the other player already released earlier during this zap, compare times
    const other: Player = releasingPlayer === 'p1' ? 'p2' : 'p1';
    const otherTime = reactionTimes[other];

    // If otherTime is not null it means other has already released in this zap; compare
    if (otherTime !== null && otherTime !== undefined) {
      // both released -> determine slower
      const playerTime = timeDiff;
      const otherPlayerTime = otherTime;
      // whichever is bigger loses a life
      if (playerTime === otherPlayerTime) {
        setRoundWinner('Draw');
      } else if (playerTime > otherPlayerTime) {
        setLives((prev) => ({ ...prev, [releasingPlayer]: Math.max(0, prev[releasingPlayer] - 1) }));
        setRoundWinner(other === 'p1' ? 'Player 1' : 'Player 2'); // winner is the faster
      } else {
        setLives((prev) => ({ ...prev, [other]: Math.max(0, prev[other] - 1) }));
        setRoundWinner(releasingPlayer === 'p1' ? 'Player 1' : 'Player 2');
      }

      // update best reaction
      const fastest = Math.min(playerTime, otherPlayerTime);
      setBestReactionTime((prev) => (prev === null ? fastest : Math.min(prev, fastest)));

      // clear zap timeout
      if (zapTimeoutRef.current) {
        clearTimeout(zapTimeoutRef.current);
        zapTimeoutRef.current = null;
      }

      // finish round
      setGameState('round-result');
      setIsFilled(false);
      setHasTouchedToStart({ p1: false, p2: false });

      setTimeout(() => {
        if (gameStateRef.current !== 'game-over') setGameState('idle');
      }, 1000);

      return;
    }

    // Other has not released yet; we set this player's time and wait for other or timeout.
    setReactionTimes((prev) => ({ ...prev, [releasingPlayer]: timeDiff }));

    // if other doesn't release before zapTimeout (which is already scheduled in beginWaitingForZap),
    // that timeout will handle punishing the holder. If that timeout doesn't exist for some reason, schedule a fallback small timeout.
    // No extra immediate action needed.
  };

  const onPlayerPressOut = (player: Player) => {
    const releaseTime = performance.now();
    // update held ref
    touchHeldRef.current[player] = false;
    setHasTouchedToStart((prev) => ({ ...prev, [player]: false }));
    // Resolve based on current gameState
    if (gameStateRef.current === 'idle') {
      // player released without starting -> ignore (they never held)
      return;
    }

    if (gameStateRef.current === 'waiting') {
      // released before zap -> premature release loses life
      resolveRoundOnWaitingRelease(player);
      return;
    }

    if (gameStateRef.current === 'zap') {
      resolveRoundOnRelease(player, releaseTime);
      return;
    }

    // if round-result or game-over, just ignore
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

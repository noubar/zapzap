import { useLocalSearchParams } from 'expo-router';
import SinglePlayerGameScreen from './OneFingerSinglePlayerGame';
import TwoPlayerGameScreen from './OneFingerTwoPlayerGame';

export default function GameScreen() {
  const { players } = useLocalSearchParams();
  const isTwoPlayer = players === '2';

  return isTwoPlayer ? <TwoPlayerGameScreen /> : <SinglePlayerGameScreen />;
}


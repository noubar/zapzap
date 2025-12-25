import { useLocalSearchParams } from 'expo-router';
import SinglePlayerGameScreen from './SinglePlayerGame';
import TwoPlayerGameScreen from './TwoPlayerGame';

export default function GameScreen() {
  const { players } = useLocalSearchParams();
  const isTwoPlayer = players === '2';

  return isTwoPlayer ? <TwoPlayerGameScreen /> : <SinglePlayerGameScreen />;
}


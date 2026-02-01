import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SinglePlayerTutorialAnimation from '../components/SinglePlayerTutorialAnimation';

export default function TutorialScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How to Play</Text>
      <Text style={styles.subtitle}>Single Player Tutorial</Text>

      <SinglePlayerTutorialAnimation />

      <View style={styles.instructions}>
        <Text style={styles.instructionsText}>
          Hold the box. When it flashes ZAP, lift your finger before the timeout.
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
        <Text style={styles.buttonText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    gap: 18,
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
  },
  instructions: {
    maxWidth: 320,
  },
  instructionsText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  buttonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '700',
  },
});

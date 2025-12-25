import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { User, Users } from 'lucide-react-native';

export default function MenuScreen() {
  const navigateToGame = (playerCount: number) => {
    router.push({
      pathname: '/game',
      params: { players: playerCount.toString() }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zap Zap</Text>
      <Text style={styles.title}>A Reaction Game</Text>
      <Text style={styles.subtitle}>Choose Game Mode</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigateToGame(1)}
        >
          <User size={40} color="#fff" />
          <Text style={styles.buttonText}>Single Player</Text>
          <Text style={styles.buttonSubtext}>Test your reaction time</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => navigateToGame(2)}
        >
          <Users size={40} color="#fff" />
          <Text style={styles.buttonText}>Two Players</Text>
          <Text style={styles.buttonSubtext}>Challenge a friend</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.instructions}>
        HOW TO PLAY: Hold the rectangle until it fills white, then release as fast as you can!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 50,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
    marginBottom: 40,
  },
  menuButton: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
});
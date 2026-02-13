import { router } from 'expo-router';
import { User, Users, Vibrate } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGlobalSettings } from './GlobalSettings';

export default function MenuScreen() {
  const [fingerMode, setFingerMode] = useState<1 | 2>(1);
  const { settings, setSetting } = useGlobalSettings();
  const vibrationEnabled = settings.vibrationEnabled;

  const menuOptions = useMemo(
    () => [
      {
        id: 'single-1',
        label: 'Single Player',
        subtext: 'Test your reaction time',
        icon: <User size={40} color="#fff" />,
        onPress: () => router.push('/OneFingerSinglePlayerGame'),
        fingerMode: 1 as const,
      },
      {
        id: 'single-2',
        label: 'Single Player - 2 Fingers',
        subtext: 'Test your reaction time with two fingers',
        icon: <User size={40} color="#fff" />,
        onPress: () => router.push('/TwoFingerSinglePlayerGame'),
        fingerMode: 2 as const,
      },
      {
        id: 'two-1',
        label: 'Two Players',
        subtext: 'Classic (one box per player)',
        icon: <Users size={40} color="#fff" />,
        onPress: () => router.push('/OneFingerTwoPlayerGame'),
        fingerMode: 1 as const,
      },
      {
        id: 'two-2',
        label: 'Two Players - 2 Fingers',
        subtext: 'Each player holds two boxes',
        icon: <Users size={40} color="#fff" />,
        onPress: () => router.push('/TwoFingerTwoPlayerGame'),
        fingerMode: 2 as const,
      },
    ],
    []
  );

  const visibleOptions = useMemo(
    () => menuOptions.filter((option) => option.fingerMode === fingerMode),
    [fingerMode, menuOptions]
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.vibrationToggle}
        onPress={() => setSetting('vibrationEnabled', !vibrationEnabled)}
        accessibilityRole="radio"
        accessibilityState={{ checked: vibrationEnabled }}
      >
        <Vibrate size={16} color={vibrationEnabled ? '#22c55e' : '#9ca3af'} />
        <Text style={styles.vibrationLabel}>Vibration</Text>
        <View style={styles.radioOuter}>
          {vibrationEnabled ? <View style={styles.radioInner} /> : null}
        </View>
      </TouchableOpacity>

      <Text style={styles.title}>Zap Zap</Text>
      <Text style={styles.title}>A Reaction Game</Text>
      <Text style={styles.subtitle}>Choose Game Mode</Text>

      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[
            styles.switchButton,
            fingerMode === 1 && styles.switchButtonActive,
          ]}
          onPress={() => setFingerMode(1)}
          accessibilityRole="button"
          accessibilityState={{ selected: fingerMode === 1 }}
        >
          <Text
            style={[
              styles.switchButtonText,
              fingerMode === 1 && styles.switchButtonTextActive,
            ]}
          >
            1 Finger
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.switchButton,
            fingerMode === 2 && styles.switchButtonActive,
          ]}
          onPress={() => setFingerMode(2)}
          accessibilityRole="button"
          accessibilityState={{ selected: fingerMode === 2 }}
        >
          <Text
            style={[
              styles.switchButtonText,
              fingerMode === 2 && styles.switchButtonTextActive,
            ]}
          >
            2 Fingers
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        {visibleOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.menuButton}
            onPress={option.onPress}
          >
            {option.icon}
            <Text style={styles.buttonText}>{option.label}</Text>
            <Text style={styles.buttonSubtext}>{option.subtext}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.instructions}>
        HOW TO PLAY: Hold the rectangle until it fills white, then release as fast as you can!
      </Text>

      <TouchableOpacity style={styles.tutorialButton} onPress={() => router.push('/tutorial')}>
        <Text style={styles.tutorialText}>Tutorial</Text>
      </TouchableOpacity>
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
  vibrationToggle: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vibrationLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#22c55e',
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
    marginBottom: 24,
    textAlign: 'center',
  },
  switchContainer: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 30,
  },
  switchButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  switchButtonActive: {
    backgroundColor: '#fff',
  },
  switchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  switchButtonTextActive: {
    color: '#000',
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
    marginBottom: 18,
  },
  tutorialButton: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  tutorialText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

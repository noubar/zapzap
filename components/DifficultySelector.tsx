import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface DifficultyLevel {
  label: string;
  value: 'easy' | 'medium' | 'hard';
}

interface DifficultySelectorProps {
  difficulty: 'easy' | 'medium' | 'hard';
  setDifficulty: (level: 'easy' | 'medium' | 'hard') => void;
  hasTouchedToStart: boolean;
  levels: DifficultyLevel[];
}

export default function DifficultySelector({ difficulty, setDifficulty, hasTouchedToStart, levels }: DifficultySelectorProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 0 }}>
      {levels.map(level => (
        <Pressable
          key={level.value}
          style={{
            backgroundColor: difficulty === level.value ? 'white' : 'gray',
            paddingVertical: 8,
            paddingHorizontal: 18,
            borderRadius: 8,
            marginHorizontal: 8,
          }}
          onPress={() => setDifficulty(level.value)}
          disabled={hasTouchedToStart}
        >
          <Text style={{ color: difficulty === level.value ? 'black' : 'white', fontWeight: 'bold' }}>
            {level.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

import { StyleSheet } from 'react-native';

export const arcadeColors = {
  background: '#000000',
  surface: '#111111',
  surfaceHeld: '#202020',
  outline: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  signal: '#FFFFFF',
  signalText: '#000000',
  success: '#39FF14',
  failure: '#FF1744',
  victory: '#FFD600',
  player1: '#00E5FF',
  player2: '#FF6D00',
} as const;

export const reservedFakeSignalColors = {
  blue: '#2979FF',
  purple: '#9C27B0',
  amber: '#FFAB00',
} as const;

export const arcadeMetrics = {
  borderWidth: 4,
  radius: 14,
  radiusSmall: 10,
  maxContentWidth: 560,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;

export const arcadeTypography = StyleSheet.create({
  eyebrow: {
    color: arcadeColors.textMuted,
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: arcadeColors.text,
    fontFamily: 'SpaceMono',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heading: {
    color: arcadeColors.text,
    fontFamily: 'SpaceMono',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    color: arcadeColors.text,
    fontFamily: 'SpaceMono',
    fontSize: 15,
  },
  caption: {
    color: arcadeColors.textMuted,
    fontFamily: 'SpaceMono',
    fontSize: 12,
  },
  reaction: {
    color: arcadeColors.success,
    fontFamily: 'SpaceMono',
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});

export function formatReactionTime(value: number | null) {
  return value === null ? '--' : `${value.toFixed(2)} ms`;
}

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { GlobalSettingsProvider } from './GlobalSettings';


export default function RootLayout() {
    const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <GlobalSettingsProvider>
        <FeedbackProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="game" />
          </Stack>
          <StatusBar style="light" />
        </FeedbackProvider>
      </GlobalSettingsProvider>
    </SafeAreaProvider>
  );
}

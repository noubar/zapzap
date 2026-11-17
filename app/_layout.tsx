import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { FeedbackProvider } from '../feedback/FeedbackProvider';
import { StatisticsProvider } from '../statistics/StatisticsProvider';
import { GlobalSettingsProvider } from '../contexts/GlobalSettings';
import { TouchCapacityProvider } from '../contexts/TouchCapacity';


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
        <TouchCapacityProvider>
          <StatisticsProvider>
            <FeedbackProvider>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, orientation: 'portrait' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="game" />
                <Stack.Screen name="multitouch-test" options={{ orientation: 'default' }} />
              </Stack>
              <StatusBar style="light" />
            </FeedbackProvider>
          </StatisticsProvider>
        </TouchCapacityProvider>
      </GlobalSettingsProvider>
    </SafeAreaProvider>
  );
}

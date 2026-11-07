import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MascotToastProvider } from './src/components';
import { RootNavigator } from './src/navigation';

/**
 * Общий клиент react-query.
 *
 * Явные настройки вместо дефолтов важны для скорости: по умолчанию
 * `staleTime: 0` и `refetchOnWindowFocus: true` заставляют каждый экран
 * заново тянуть контент при монтировании и при возврате фокуса. Список
 * кейсов — это ~100 кейсов с 400 вариантами ответа, поэтому «мигающая»
 * перезагрузка выглядела как «кейсы и уроки долго грузятся».
 *
 * `retry: 1` вместо трёх попыток: при живом backend ошибка сети почти
 * всегда настоящая, а три повтора с задержкой держат спиннер заметно дольше.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <MascotToastProvider>
              <RootNavigator />
              <StatusBar style="auto" />
            </MascotToastProvider>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
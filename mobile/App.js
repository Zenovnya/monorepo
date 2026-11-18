import { NavigationContainer } from '@react-navigation/native';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MascotToastProvider } from './src/components';
import { OfflineBanner } from './src/components/OfflineBanner';
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
/**
 * Связываем react-query с реальным состоянием сети.
 *
 * Без этого onlineManager всегда считает сеть доступной: запросы уходят
 * в никуда при офлайне, а `refetchOnReconnect` не срабатывает никогда.
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
  })
);

/**
 * Deep links. Ссылка из письма о сбросе пароля приходит в виде
 * ``lapazakona://reset-password?token=...`` (в вебе — ``/reset-password?token=``).
 * Без этой настройки NavigationContainer не знает, какой экран открыть,
 * и токен терялся бы.
 */
const linking = {
  prefixes: ['lapazakona://', 'https://lapazakona.app'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      MainTabs: '',
    },
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      // При возвращении сети перезапрашиваем данные — иначе экран
      // остаётся с ошибкой, хотя интернет уже появился.
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer linking={linking}>
            <MascotToastProvider>
              <RootNavigator />
              <OfflineBanner />
              <StatusBar style="auto" />
            </MascotToastProvider>
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
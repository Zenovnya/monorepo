import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import apiClient from '../api/client';

/**
 * Настройка обработчика уведомлений.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Запрашивает разрешение и регистрирует push-токен устройства.
 * Возвращает токен или null, если не удалось.
 */
export async function registerForPushNotifications() {
  if (Platform.OS === 'web') return null;

  // Android требует зарегистрированный канал уведомлений, иначе пуши
  // не отображаются в собранном приложении.
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Уведомления',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch {
      // Настройка канала не критична для получения токена.
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    // ВАЖНО: для собранных (EAS) приложений getExpoPushTokenAsync требует
    // EAS projectId. Настройте его через `eas init` и пропишите в app.json:
    //   { "expo": { "extra": { "eas": { "projectId": "<ваш-projectId>" } } } }
    // В Expo Go projectId определяется автоматически.
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

/**
 * Отправляет push-токен на бэкенд для последующей рассылки.
 */
export async function syncPushToken() {
  try {
    const token = await registerForPushNotifications();
    if (!token) return null;
    await apiClient.post('/notifications/push-token', {
      token,
      platform: Platform.OS,
    });
    return token;
  } catch {
    return null;
  }
}

/**
 * Показывает локальное уведомление.
 */
export async function showLocalNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // показать сразу
  });
}
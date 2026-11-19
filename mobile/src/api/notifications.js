import apiClient from './client';

/**
 * Методы API для уведомлений.
 */
export const notificationsApi = {
  // Список уведомлений
  list: () => apiClient.get('/notifications').then((r) => r.data),

  // Настройки уведомлений (стрик / цель дня / повторения)
  getSettings: () => apiClient.get('/notifications/settings').then((r) => r.data),

  updateSettings: (patch) =>
    apiClient.patch('/notifications/settings', patch).then((r) => r.data),

  // Тестовый push на устройства пользователя
  sendTest: () => apiClient.post('/notifications/test').then((r) => r.data),

  // Регистрация push-токена
  registerPushToken: (token, platform) =>
    apiClient
      .post('/notifications/push-token', { token, platform })
      .then((r) => r.data),
};
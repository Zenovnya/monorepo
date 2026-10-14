import apiClient from './client';

/**
 * Методы API для уведомлений.
 */
export const notificationsApi = {
  // Список уведомлений
  list: () => apiClient.get('/notifications').then((r) => r.data),

  // Регистрация push-токена
  registerPushToken: (token, platform) =>
    apiClient
      .post('/notifications/push-token', { token, platform })
      .then((r) => r.data),
};
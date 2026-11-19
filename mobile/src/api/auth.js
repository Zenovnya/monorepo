import apiClient from './client';

/**
 * Методы API для аутентификации.
 */
export const authApi = {
  login: (payload) => apiClient.post('/auth/login', payload).then((r) => r.data),

  register: (payload) => apiClient.post('/auth/register', payload).then((r) => r.data),

  // Возвращает данные текущего пользователя по access-токену.
  me: (token) =>
    apiClient
      .get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),

  // Запрос письма со ссылкой сброса пароля. Ответ не раскрывает,
  // существует ли такой аккаунт.
  forgotPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  // Установка нового пароля по одноразовому токену из письма.
  resetPassword: (token, password) =>
    apiClient
      .post('/auth/reset-password', { token, password })
      .then((r) => r.data),

  // Обновляет пару токенов по refresh-токену.
  refresh: (refreshToken) =>
    apiClient
      .post('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data),
};
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
};
import apiClient from './client';

/**
 * Методы API для пользовательского профиля LexBear.
 */
export const userApi = {
  // Завершить онбординг
  onboard: (payload) =>
    apiClient.post('/user/onboard', payload).then((r) => r.data),

  // Профиль текущего пользователя
  getMe: () => apiClient.get('/user/me').then((r) => r.data),

  // Обновить профиль: имя и/или цель XP в день
  updateMe: (patch) =>
    apiClient
      .patch('/user/me', typeof patch === 'string' ? { name: patch } : patch)
      .then((r) => r.data),

  // Погладить мишку (повышает настроение)
  petBear: () => apiClient.post('/user/bear/pet').then((r) => r.data),

  // Удалить аккаунт и все данные. Пароль — подтверждение необратимого действия.
  deleteMe: (password) =>
    apiClient.delete('/user/me', { data: { password } }).then((r) => r.data),
};
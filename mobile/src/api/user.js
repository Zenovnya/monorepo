import apiClient from './client';

/**
 * Методы API для пользовательского профиля LexBear.
 */
export const userApi = {
  // Завершить онбординг
  onboard: (payload) =>
    apiClient.post('/user/onboard', payload).then((r) => r.data),

  // Погладить мишку (повышает настроение)
  petBear: () => apiClient.post('/user/bear/pet').then((r) => r.data),
};
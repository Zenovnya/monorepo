import apiClient from './client';

/**
 * Методы API для прогресса пользователя.
 */
export const progressApi = {
  // Сводка по прогрессу обучения
  overview: () => apiClient.get('/progress/overview').then((r) => r.data),

  // Ответ на кейс урока
  answer: (payload) => apiClient.post('/progress/answer', payload).then((r) => r.data),

  // Завершение урока
  complete: (payload) => apiClient.post('/progress/complete', payload).then((r) => r.data),

  // Текущее состояние прогресса пользователя
  me: () => apiClient.get('/progress/me').then((r) => r.data),
};
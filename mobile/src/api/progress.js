import apiClient from './client';

/**
 * Методы API для прогресса пользователя.
 */
export const progressApi = {
  // Сводка по прогрессу обучения (GET /progress)
  overview: () => apiClient.get('/progress').then((r) => r.data),

  // Ответ на кейс урока
  answer: (payload) => apiClient.post('/progress/answer', payload).then((r) => r.data),

  // Завершение урока
  complete: (payload) => apiClient.post('/progress/complete', payload).then((r) => r.data),

  // Кейсы, подлежащие повторению по SM-2 (GET /srs/reviews)
  reviews: () => apiClient.get('/srs/reviews').then((r) => r.data),
};
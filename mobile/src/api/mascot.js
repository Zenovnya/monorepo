import apiClient from './client';

/**
 * Методы API для маскота Lex.
 */
export const mascotApi = {
  // Список активных фраз маскота
  listPhrases: () => apiClient.get('/mascot/phrases').then((r) => r.data),

  // Случайная фраза по триггеру
  phrase: (trigger) => apiClient.get(`/mascot/phrase/${trigger}`).then((r) => r.data),

  // Погладить маскота
  pet: () => apiClient.post('/mascot/pet').then((r) => r.data),

  // Текущий счётчик поглаживаний
  petCount: () => apiClient.get('/mascot/pet-count').then((r) => r.data),
};
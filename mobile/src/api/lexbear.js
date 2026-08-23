import apiClient from './client';

/**
 * Методы API для контента LexBear (юниты, уроки, статьи, завершение урока).
 */
export const lexbearApi = {
  // Карта обучения (юниты + уроки + прогресс)
  learnPath: () => apiClient.get('/lexbear/learn').then((r) => r.data),

  // Список кейсов (вкладка «Кейсы»)
  cases: () => apiClient.get('/lexbear/cases').then((r) => r.data),

  // Детали урока (теория + вопросы)
  getLesson: (lessonId) =>
    apiClient.get(`/lexbear/lessons/${lessonId}`).then((r) => r.data),

  // Завершение урока (XP, короны, стрик, разблокировка статей)
  completeLesson: (lessonId, { correct, total }) =>
    apiClient
      .post(`/lexbear/lessons/${lessonId}/complete`, { correct, total })
      .then((r) => r.data),

  // Статьи со статусом изучения
  articles: () => apiClient.get('/lexbear/articles').then((r) => r.data),
};
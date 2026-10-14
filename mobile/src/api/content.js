import apiClient from './client';

/**
 * Методы API для контента (ветки, уроки, кейсы).
 */
export const contentApi = {
  // Список веток обучения
  listBranches: () => apiClient.get('/content/branches').then((r) => r.data),

  // Уроки конкретной ветки
  listLessons: (branchId) =>
    apiClient.get(`/content/branches/${branchId}/lessons`).then((r) => r.data),

  // Детали урока (теория)
  getLesson: (lessonId) =>
    apiClient.get(`/content/lessons/${lessonId}`).then((r) => r.data),

  // Кейсы урока
  listCases: (lessonId) =>
    apiClient.get(`/content/lessons/${lessonId}/cases`).then((r) => r.data),
};
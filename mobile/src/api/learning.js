import apiClient from './client';

/** Server-owned adaptive learning flow. Correctness is never returned by next(). */
export const learningApi = {
  startAssessment: () => apiClient.post('/learning/assessment/start').then((r) => r.data),
  nextAssessment: (sessionId) => apiClient.get('/learning/assessment/next', { params: { session_id: sessionId } }).then((r) => r.data),
  /**
   * Следующий кейс под пользователя.
   *
   * `exclude` — id версий кейсов, уже показанных в текущей сессии. Без него
   * ранжирование детерминировано и сервер всегда возвращает один и тот же
   * кейс, поэтому клиент обязан передавать показанные.
   */
  next: (exclude = []) =>
    apiClient
      .get('/learning/next', {
        params: exclude.length ? { exclude: exclude.join(',') } : undefined,
      })
      .then((r) => {
        const data = r.data;
        // Сервер отдаёт `null`, когда показывать нечего, и объясняет причину
        // заголовком: кейсов нет вовсе (`no_content`) или они не прошли
        // юридическую проверку (`awaiting_review`). Без этого экран не мог
        // отличить «всё пройдено» от «контента нет» и поздравлял зря.
        if (data == null) {
          return { case: null, unavailableReason: r.headers['x-learning-unavailable'] || null };
        }
        return { case: data, unavailableReason: null };
      }),
  submitAttempt: (payload) => apiClient.post('/learning/attempts', payload).then((r) => r.data),
  submitAssessmentAnswer: (payload) =>
    apiClient.post('/learning/assessment/answer', payload).then((r) => r.data),
  progress: () => apiClient.get('/learning/progress').then((r) => r.data),
};
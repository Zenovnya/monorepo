import apiClient from './client';

/**
 * Адаптивное обучение «Лапы Закона».
 *
 * Сервер сам решает, какой кейс показать: клиент присылает только желание
 * (тема или урок), а `attempt_id`, режим и источник выдачи приходят в ответе.
 * Поэтому здесь нет метода «открой вот эту карточку как свежий кейс» — если бы
 * он был, клиент мог бы выдать себе засчитанную попытку на уже показанный
 * разбор, и приоритеты тем перестали бы отражать реальные знания.
 */
export const adaptiveApi = {
  /** Темы и пометка о редакционном статусе контента. */
  meta: () => apiClient.get('/adaptive').then((r) => r.data),

  /**
   * Следующий кейс.
   *
   * `topicId`/`lessonId` — осознанный выбор пользователя; без них сервер
   * выбирает по приоритету тем. `openAttempt=false` — только посмотреть
   * решение, не занимая единственную открытую попытку.
   */
  next: ({ topicId, lessonId, openAttempt = true } = {}) =>
    apiClient
      .get('/adaptive/next', {
        params: {
          ...(topicId ? { topic_id: topicId } : {}),
          ...(lessonId ? { lesson_id: lessonId } : {}),
          ...(openAttempt ? {} : { open_attempt: false }),
        },
      })
      .then((r) => r.data),

  /** Прогресс по темам: приоритет практики и последние ответы. */
  overview: () => apiClient.get('/adaptive/overview').then((r) => r.data),

  /** Теория урока, шаги и разбор. */
  lesson: (lessonId) => apiClient.get(`/adaptive/lessons/${lessonId}`).then((r) => r.data),

  /** Открыть повтор уже виденного кейса (или практику по разбору). */
  openAttempt: ({ itemId, mode = 'practice', origin = 'manual' }) =>
    apiClient
      .post('/adaptive/attempts', { item_id: itemId, mode, origin })
      .then((r) => r.data),

  /** Ответ, подсказка, пропуск или показ разбора. */
  act: (attemptId, { action = 'answer', optionId } = {}) =>
    apiClient
      .post(`/adaptive/attempts/${attemptId}/actions`, {
        action,
        ...(optionId ? { option_id: optionId } : {}),
      })
      .then((r) => r.data),
};

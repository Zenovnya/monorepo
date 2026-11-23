/**
 * Оптимистичное обновление кэша после прохождения урока/кейса.
 *
 * Сервер в ответе `act()` отдаёт только xp_gained / lives_spent / assistance /
 * status / counted — полный обновлённый `adaptive-overview` не вычисляется
 * и приходит лишь при следующем запросе. Без локального пересчёта прогресс
 * тем и уроков «подвисал» на прежних значениях до refetch.
 *
 * Здесь — единая функция, которая применяет изменения из ответа сразу:
 *
 * - `gamification-me`: XP и жизни меняются по ответу act().
 * - `gamification-daily-goal`: done = XP за сегодня, поэтому поднимается на
 *   xp_gained (и пересчитывается remaining/completed).
 * - `adaptive-overview`: урок отмечается practised, lessons_practised и
 *   progress_pct темы пересчитываются так, как считает сервер
 *   (round(done / lessons * 100, 1)).
 *
 * Если с последующим refetch что-то не совпало, серверный ответ
 * перезаписывает кэш — оптимистичный пересчёт просто заменяется.
 */

/**
 * Отметить урок пройденным в кэше `adaptive-overview`.
 *
 * Урок ищется по lesson_id по всей плоскости тем: темы рендерятся с
 * развёрнутой тропой (LearnScreen) и в профиле (ProfileScreen) — оба
 * должны видеть обновление сразу.
 */
export function markLessonPractised(queryClient, lessonId) {
  if (!lessonId) return;
  queryClient.setQueryData(['adaptive-overview'], (prev) => {
    if (!prev?.topics?.length) return prev;
    const topic = prev.topics.find((t) =>
      (t.lessons ?? []).some((lesson) => lesson.lesson_id === lessonId)
    );
    if (!topic) return prev;
    const lessons = (topic.lessons ?? []).map((lesson) =>
      lesson.lesson_id === lessonId ? { ...lesson, practised: true } : lesson
    );
    const practised = lessons.filter((lesson) => lesson.practised).length;
    const total = lessons.length || 1;
    const progressPct = Math.round((practised / total) * 1000) / 10;
    return {
      ...prev,
      topics: prev.topics.map((t) =>
        t === topic
          ? {
              ...t,
              lessons,
              lessons_practised: practised,
              progress_pct: progressPct,
            }
          : t
      ),
    };
  });
}

/**
 * Применить полученный XP к счётчикам.
 *
 * `gamification-me` — это общий счётчик, а `gamification-daily-goal.done`
 * по определению XP за сегодня, поэтому оба ключа меняются вместе.
 */
export function applyXpGained(queryClient, xpGained) {
  const amount = xpGained || 0;
  if (!amount) return;
  queryClient.setQueryData(['gamification-me'], (prev) =>
    prev ? { ...prev, xp: prev.xp + amount } : prev
  );
  queryClient.setQueryData(['gamification-daily-goal'], (prev) => {
    if (!prev) return prev;
    const done = prev.done + amount;
    const goal = prev.goal || 0;
    return {
      ...prev,
      done,
      remaining: Math.max(0, goal - done),
      completed: goal > 0 && done >= goal,
    };
  });
}

/**
 * Списать жизни по ответу act().
 */
export function applyLivesSpent(queryClient, livesSpent) {
  const amount = livesSpent || 0;
  if (!amount) return;
  queryClient.setQueryData(['gamification-me'], (prev) =>
    prev ? { ...prev, lives: Math.max(0, (prev.lives ?? 0) - amount) } : prev
  );
}

/**
 * Полный оптимистичный апгрейд после act().
 *
 * `lessonId` — урок, который был засчитан (из route-params на LessonScreen
 * или из choice в NextRead на AdaptiveLearningScreen). `counted` из ответа
 * говорит, что сервер засчитал попытку — только тогда урок переходит в
 * «пройденные».
 */
export function applyActResult(queryClient, data, lessonId) {
  if (!data) return;
  if (data.counted && lessonId) {
    markLessonPractised(queryClient, lessonId);
  }
  applyXpGained(queryClient, data.xp_gained);
  applyLivesSpent(queryClient, data.lives_spent);
}

/**
 * Геометрия «змейки» урока: чистые функции, без React и react-native.
 *
 * Зачем отдельный файл:
 *
 * 1. Раскладку тропы можно посчитать и проверить без отрисовки. Ошибка вида
 *    «узлы налезли друг на друга» или «тропа вышла за экран» — это арифметика,
 *    и её видно числом, а не только глазами на телефоне.
 * 2. Компонент отвечает только за вид. Когда формула и вёрстка в одном файле,
 *    любая правка отступа заставляет перепроверять расчёты вручную.
 */

/** Диаметр узла. 64 — палец попадает уверенно, но тропа не «съедает» экран. */
export const NODE = 64;
/** Горизонтальный отступ тропы: узел не должен касаться края экрана. */
export const PADDING_X = 34;
/** Расстояние между центрами узлов по вертикали. */
export const STEP_Y = 96;
/** Насколько сильно тропа уходит влево-вправо от центра. */
export const AMPLITUDE = 0.34;
/** Шаг точек-соединителей. Меньше диаметра — иначе видно разрывы. */
export const DOT_STEP = 7;
/** Ширина подписи под узлом: заголовок урока в две строки. */
export const LABEL_WIDTH = 140;

/**
 * Центры узлов тропы.
 *
 * Фаза инкрементируется на π/2: полный период синуса приходится на четыре
 * узла, то есть тропа идёт «влево — центр — вправо — центр» и читается как
 * волна. При шаге π на каждый узел получился бы зигзаг, который на карте из
 * тридцати уроков выглядит как шум.
 *
 * @param {number} count  Сколько уроков.
 * @param {number} width  Доступная ширина.
 * @returns {Array<{x: number, y: number}>} Координаты центров в px.
 */
export function snakePoints(count, width) {
  if (!count || count < 1) return [];
  const inner = Math.max(width - PADDING_X * 2, NODE);
  const center = width / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: center + Math.sin((index * Math.PI) / 2) * inner * AMPLITUDE,
    y: NODE / 2 + index * STEP_Y,
  }));
}

/** Высота полотна под `count` узлов. */
export function pathHeight(count) {
  if (!count || count < 1) return 0;
  return NODE / 2 + (count - 1) * STEP_Y + NODE / 2;
}

/**
 * Точки-соединители между двумя центрами.
 *
 * `count` берётся через Math.max(1, …): на очень коротком отрезке деление на
 * ноль давало NaN и точка пропадала — визуально «тропа рвалась».
 */
export function connectorDots(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const count = Math.max(1, Math.floor(length / DOT_STEP));
  return Array.from({ length: count }, (_, index) => {
    const t = index / count;
    return {
      left: from.x + dx * t - DOT_STEP / 2,
      top: from.y + dy * t - DOT_STEP / 2,
    };
  });
}

/**
 * Индекс «следующего» урока: первый непройденный.
 *
 * Возвращает `-1`, если пройдено всё: подсвечивать тогда нечего, и любой
 * выбор выглядел бы произвольным.
 */
export function nextLessonIndex(lessons) {
  if (!Array.isArray(lessons)) return -1;
  return lessons.findIndex((lesson) => !lesson.practised);
}

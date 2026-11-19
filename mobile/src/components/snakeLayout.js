/**
 * Геометрия карты уроков: чистая математика, без React и react-native.
 *
 * Зачем отдельный файл: раскладку тропы можно посчитать и проверить без
 * отрисовки. «Узлы налезли друг на друга» и «тропа вышла за экран» — это
 * арифметика, и её видно числом, а не только глазами на телефоне.
 *
 * Схема — как в Duolingo: тропа идёт волной сверху вниз, уроки сидят на ней
 * через равные промежутки, а между ними — точки-«шаги».
 */

/** Диаметр медальона урока. */
export const NODE = 72;
/** Горизонтальный отступ: медальон не касается края экрана. */
export const PADDING_X = 30;
/** Расстояние между центрами по вертикали. */
export const STEP_Y = 104;
/** Насколько тропа уходит влево-вправо от центра (доля свободной ширины). */
export const AMPLITUDE = 0.3;
/** Шаг точек-«шагов» вдоль тропы. */
export const DOT_STEP = 9;
/** Размер точки-шага. */
export const DOT_SIZE = 7;
/**
 * Ширина подписи под медальоном.
 *
 * 132, а не 150: при ширине полотна 256px (iPhone SE минус отступы) подпись
 * крайнего медальона выходила за экран на 18px и обрезалась. Число проверяется
 * тестом, а не подбирается на глаз.
 */
export const LABEL_WIDTH = 132;

/**
 * Центры медальонов.
 *
 * Фаза растёт на π/2: полный период синуса приходится на четыре урока, тропа
 * идёт «центр — вправо — центр — влево». Шаг π дал бы зигзаг, который на карте
 * из тридцати уроков выглядит как шум, а не как путь.
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

/** Высота полотна под `count` медальонов (с местом под подпись последнего). */
export function pathHeight(count) {
  if (!count || count < 1) return 0;
  return NODE / 2 + (count - 1) * STEP_Y + NODE / 2 + 34;
}

/**
 * Точки-«шаги» между центрами двух медальонов.
 *
 * count через Math.max(1, …): на коротком отрезке деление на ноль давало NaN,
 * и точка пропадала — визуально тропа рвалась.
 */
export function connectorDots(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const count = Math.max(1, Math.floor(length / DOT_STEP));
  return Array.from({ length: count }, (_, index) => {
    const t = index / count;
    return {
      left: from.x + dx * t - DOT_SIZE / 2,
      top: from.y + dy * t - DOT_SIZE / 2,
    };
  });
}

/**
 * Индекс «следующего» урока — первый непройденный.
 *
 * `-1`, если пройдено всё: подсвечивать тогда нечего, и любой выбор выглядел бы
 * произвольным.
 */
export function nextLessonIndex(lessons) {
  if (!Array.isArray(lessons)) return -1;
  return lessons.findIndex((lesson) => !lesson.practised);
}

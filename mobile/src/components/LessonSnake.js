/**
 * «Змейка» пути: уроки идут не ровным списком, а волнистой тропой вниз.
 *
 * Как это устроено и почему именно так:
 *
 * 1. **Геометрия, а не иллюстрация.** Путь — это синусоида, посчитанная из
 *    ширины экрана и номера урока. Никаких картинок: тропа перестраивается под
 *    любую ширину (телефон, планшет, веб) и не растягивается.
 * 2. **Соединитель — точки, а не линия.** В проекте нет `react-native-svg`, а
 *    тянуть зависимость ради декоративной линии — лишний вес в бандле. Цепочка
 *    окружностей той же толщины, что и обводка узла, читается как тропа и
 *    рисуется обычными `View`. Шаг точек меньше их диаметра, поэтому между ними
 *    нет просветов.
 * 3. **Узлы — настоящие Pressable с hitSlop.** Раскладка через `left`, а не
 *    `transform`: при абсолютном позиционировании кнопка остаётся там, где
 *    нарисована, и в неё можно попасть пальцем. Промахи по «кривой» тропе —
 *    самая частая жалоба в таких картах.
 * 4. **Пройденное и следующее различаются формой, а не только цветом.**
 *    Галочка против номера: цвет на солнце и при слабом зрении читается хуже,
 *    чем форма.
 * 5. **Ничего не заблокировано.** Узел без `onPress` (урок недоступен по
 *    данным сервера) выглядит приглушённо и не притворяется нажимаемым.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { brand, serifFamily } from './KhokhlomaOrnament';
import { colors } from '../theme/colors';
import {
  DOT_STEP,
  LABEL_WIDTH,
  NODE,
  connectorDots,
  nextLessonIndex,
  pathHeight,
  snakePoints,
} from './snakeLayout';


/**
 * Точки между двумя узлами.
 *
 * `key` собирается из индекса: без него React переиспользовал бы точки при
 * смене числа уроков и тропа «дёргалась» бы.
 */
function Connector({ from, to, done }) {
  const dots = useMemo(() => connectorDots(from, to), [from, to]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map((dot, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            // Пройденный отрезок — золотой, оставшийся — светлый. Так видно,
            // где ты находишься, не читая номер.
            { backgroundColor: done ? brand.gold : brand.ruleStrong },
            dot,
          ]}
        />
      ))}
    </View>
  );
}

/**
 * @param {Array}    lessons  Уроки темы: { lesson_id, title, order, practised }.
 * @param {number}   width    Доступная ширина (ширина окна минус отступы).
 * @param {Function} onPick   (lesson) => void
 */
export function LessonSnake({ lessons, width = 320, onPick }) {
  // `?? []` внутри useMemo: новый пустой массив на каждый рендер заставлял бы
  // пересчитывать точки тропы всегда.
  const items = useMemo(() => lessons ?? [], [lessons]);

  // Пересчёт на каждый рендер давал бы новую ссылку на массив и лишние
  // ре-рендеры узлов.
  const points = useMemo(() => snakePoints(items.length, width), [items.length, width]);
  const nextIndex = useMemo(() => nextLessonIndex(items), [items]);

  if (!items.length) return null;

  return (
    <View style={[styles.canvas, { height: pathHeight(items.length), width }]}>
      {/* Соединитель — отрезок на каждый шаг, чтобы цвет менялся по
          пройденности: тёмный там, где урок уже позади. */}
      {points.slice(0, -1).map((point, index) => (
        <Connector
          key={`seg-${items[index].lesson_id}`}
          from={point}
          to={points[index + 1]}
          done={Boolean(items[index].practised)}
        />
      ))}

      {items.map((lesson, index) => {
        const point = points[index];
        const done = Boolean(lesson.practised);
        // «Следующий» — только первый непройденный. Подсвечивать все
        // непройденные значит убрать смысл подсветки.
        const isNext = index === nextIndex;
        return (
          <View
            key={lesson.lesson_id}
            style={[styles.nodeWrap, { left: point.x - NODE / 2, top: point.y - NODE / 2 }]}
          >
            {isNext ? <View style={styles.nextHalo} pointerEvents="none" /> : null}
            <PressableScale
              onPress={onPick ? () => onPick(lesson) : undefined}
              // hitSlop расширяет цель за пределы круга: тропа кривая, и палец
              // часто попадает рядом с узлом, а не в него.
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              scale={0.9}
              haptic
              accessibilityRole="button"
              accessibilityLabel={
                done ? `Урок ${lesson.order}, пройден` : `Урок ${lesson.order}: ${lesson.title}`
              }
              style={[
                styles.node,
                done && styles.nodeDone,
                isNext && styles.nodeNext,
                !done && !isNext && styles.nodeTodo,
              ]}
            >
              <Text
                style={[styles.nodeText, done && styles.nodeTextDone, isNext && styles.nodeTextNext]}
              >
                {done ? '✓' : lesson.order}
              </Text>
            </PressableScale>
          </View>
        );
      })}

      {/* Подписи под узлами. Отдельным слоем: текст выходит за круг, а внутри
          узла он не помещается и ломал бы центровку номера. */}
      {items.map((lesson, index) => {
        const point = points[index];
        return (
          <View
            key={`label-${lesson.lesson_id}`}
            pointerEvents="none"
            style={[
              styles.labelWrap,
              { left: point.x - LABEL_WIDTH / 2, top: point.y + NODE / 2 + 4 },
            ]}
          >
            <Text style={styles.label} numberOfLines={2}>
              {lesson.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative' },
  dot: { position: 'absolute', width: DOT_STEP, height: DOT_STEP, borderRadius: DOT_STEP / 2 },
  nodeWrap: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderBottomWidth: 5,
  },
  nodeTodo: { backgroundColor: colors.card, borderColor: brand.ruleStrong },
  nodeDone: { backgroundColor: brand.pine, borderColor: brand.pineDark },
  nodeNext: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
    // Ширина обводки, а не transform: `PressableScale` сам пишет transform
    // (проседание под пальцем), и статический scale здесь был бы затёрт —
    // «следующий» узел выглядел бы как все. Обводка этого не касается.
    borderWidth: 4,
  },
  nodeText: { fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: serifFamily },
  nodeTextDone: { color: brand.goldLight },
  nodeTextNext: { color: brand.ink },
  nextHalo: {
    position: 'absolute',
    width: NODE + 16,
    height: NODE + 16,
    borderRadius: (NODE + 16) / 2,
    borderWidth: 2,
    borderColor: brand.goldBorder,
    opacity: 0.85,
  },
  labelWrap: { position: 'absolute', width: LABEL_WIDTH, alignItems: 'center' },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: brand.subtext,
    textAlign: 'center',
  },
});

export default LessonSnake;

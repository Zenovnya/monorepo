/**
 * Карта уроков темы: волнистая тропа с медальонами, как в Duolingo.
 *
 * Решения и их причины:
 *
 * 1. **Тропа — фон, медальоны — поверх.** Тропа рисуется точками-«шагами» и
 *    уходит под узлы. Если бы узлы были частью тропы, при добавлении урока
 *    пришлось бы пересобирать всю линию.
 * 2. **Точки, а не линия.** В проекте нет `react-native-svg`; тянуть
 *    зависимость ради декоративной линии — вес в бандле. Цепочка окружностей с
 *    шагом меньше диаметра читается как пунктирная тропа и рисуется обычными
 *    `View`.
 * 3. **Три состояния различаются формой и насыщенностью, а не только цветом.**
 *    Пройдено — галочка, следующий — номер на золоте с обводкой-«пульсом»,
 *    закрыто-впереди — номер на приглушённом фоне. Цвет сам по себе на солнце
 *    и при слабом зрении читается хуже формы.
 * 4. **Раскладка через `left/top`, а не `transform`.** Абсолютное
 *    позиционирование оставляет нажимаемую область там, где нарисован
 *    медальон: в кривую тропу иначе невозможно попасть пальцем.
 * 5. **Медальон чуть «проседает» вниз тенью** — нижняя граница толще верхней.
 *    Это игровой приём Duolingo: кнопка выглядит физической, и нажимать её
 *    приятнее.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './PressableScale';
import { brand, serifFamily } from './KhokhlomaOrnament';
import {
  DOT_SIZE,
  LABEL_WIDTH,
  NODE,
  connectorDots,
  nextLessonIndex,
  pathHeight,
  snakePoints,
} from './snakeLayout';

/** Цвет тропы в трёх состояниях: пройдено / идём / впереди. */
const TRAIL_DONE = brand.gold;
const TRAIL_AHEAD = brand.ruleStrong;
const TRAIL_ACTIVE = brand.goldBorder;

function Connector({ from, to, state }) {
  const dots = useMemo(() => connectorDots(from, to), [from, to]);
  const color =
    state === 'done' ? TRAIL_DONE : state === 'active' ? TRAIL_ACTIVE : TRAIL_AHEAD;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map((dot, index) => (
        <View key={index} style={[styles.dot, { backgroundColor: color }, dot]} />
      ))}
    </View>
  );
}

/**
 * @param {Array}    lessons  Уроки темы: { lesson_id, title, order, practised }.
 * @param {number}   width    Доступная ширина.
 * @param {Function} onPick   (lesson) => void
 */
export function LessonSnake({ lessons, width = 320, onPick }) {
  const items = useMemo(() => lessons ?? [], [lessons]);
  const points = useMemo(() => snakePoints(items.length, width), [items.length, width]);
  const nextIndex = useMemo(() => nextLessonIndex(items), [items]);

  if (!items.length) return null;

  return (
    <View style={[styles.canvas, { height: pathHeight(items.length), width }]}>
      {/* Тропа: отрезок на каждый шаг, своим цветом по состоянию. */}
      {points.slice(0, -1).map((point, index) => (
        <Connector
          key={`seg-${items[index].lesson_id}`}
          from={point}
          to={points[index + 1]}
          state={
            items[index].practised
              ? 'done'
              : index === nextIndex - 1
              ? 'active'
              : 'ahead'
          }
        />
      ))}

      {items.map((lesson, index) => {
        const point = points[index];
        const done = Boolean(lesson.practised);
        const isNext = index === nextIndex;
        return (
          <View
            key={lesson.lesson_id}
            style={[styles.nodeWrap, { left: point.x - NODE / 2, top: point.y - NODE / 2 }]}
          >
            {isNext ? <View style={styles.halo} pointerEvents="none" /> : null}
            <PressableScale
              onPress={onPick ? () => onPick(lesson) : undefined}
              // hitSlop расширяет цель за пределы круга: тропа кривая, и палец
              // часто попадает рядом с медальоном, а не в него.
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              scale={0.9}
              haptic
              accessibilityRole="button"
              accessibilityLabel={
                done ? `Урок ${lesson.order}, пройден` : `Урок ${lesson.order}: ${lesson.title}`
              }
              style={[styles.node, done && styles.nodeDone, isNext && styles.nodeNext]}
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

      {/* Подписи под медальонами: отдельным слоем, потому что текст выходит за
          круг и ломал бы центровку номера. */}
      {items.map((lesson, index) => {
        const point = points[index];
        const isNext = index === nextIndex;
        return (
          <View
            key={`label-${lesson.lesson_id}`}
            pointerEvents="none"
            style={[
              styles.labelWrap,
              { left: point.x - LABEL_WIDTH / 2, top: point.y + NODE / 2 + 2 },
            ]}
          >
            <Text
              style={[styles.label, isNext && styles.labelNext]}
              numberOfLines={2}
            >
              {lesson.title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative', alignSelf: 'center' },
  dot: { position: 'absolute', width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
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
    // Впереди — приглушённый «камень»: видно, что урок есть, но он не зовёт.
    backgroundColor: brand.paperSoft,
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: brand.ruleStrong,
  },
  nodeDone: {
    backgroundColor: brand.pine,
    borderColor: brand.pineDark,
  },
  nodeNext: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
  },
  nodeText: { fontSize: 26, fontWeight: '900', color: brand.muted, fontFamily: serifFamily },
  nodeTextDone: { color: brand.goldLight },
  nodeTextNext: { color: brand.ink },
  halo: {
    position: 'absolute',
    width: NODE + 18,
    height: NODE + 18,
    borderRadius: (NODE + 18) / 2,
    borderWidth: 2,
    borderColor: brand.goldBorder,
    opacity: 0.9,
  },
  labelWrap: { position: 'absolute', width: LABEL_WIDTH, alignItems: 'center' },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: brand.muted,
    textAlign: 'center',
  },
  labelNext: { color: brand.ink, fontWeight: '800' },
});

export default LessonSnake;

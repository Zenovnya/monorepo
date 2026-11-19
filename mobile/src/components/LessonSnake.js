/**
 * Карта уроков темы: волнистая тропа с 3D-кружками, как в Duolingo.
 *
 * Редизайн (техзадание §2):
 *
 * 1. **Тропа — SVG-линия, кружки — поверх.** Линия рисуется через
 *    react-native-svg, кружки — через View с TactilePressable.
 * 2. **3D-кружки диаметром 72px** с borderBottomWidth: 6 — каждая
 *    кнопка выглядит физической.
 * 3. **Пульсация активного уровня** через react-native-reanimated
 *    (withRepeat, withSequence) и яркий золотой цвет.
 * 4. **Поповер вместо обрезанного текста** (паттерн Duolingo): при
 *    тапе на кружок открывается всплывающая карточка с полным
 *    названием, наградой и кнопкой «НАЧАТЬ КЕЙС».
 * 5. **Краткая подпись под кружком** (short_title) — видна при
 *    внимательном взгляде, как в Duolingo.
 *
 * Раскладка через left/top: абсолютное позиционирование оставляет
 * нажимаемую область там, где нарисован кружок.
 */

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TactilePressable } from './TactilePressable';
import { brand, serifFamily } from './KhokhlomaOrnament';
import { colors } from '../theme/colors';
import {
  LABEL_WIDTH,
  NODE,
  nextLessonIndex,
  pathHeight,
  snakePoints,
} from './snakeLayout';

/** Цвет тропы в трёх состояниях: пройдено / идём / впереди. */
const TRAIL_DONE = brand.gold;
const TRAIL_AHEAD = brand.ruleStrong;
const TRAIL_ACTIVE = brand.goldBorder;

/**
 * SVG-линия тропы: соединяет центры кружков волнистой линией.
 * Линия уходит под кружки — рисуется первой в Z-порядке.
 *
 * @param {Array} points   Центры кружков.
 * @param {Array} items    Уроки (для состояния сегмента).
 */
function Trail({ points, items }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${Math.max(points[0]?.x * 2 || 1, 1)} ${pathHeight(points.length)}`}
      preserveAspectRatio="none"
    >
      {points.slice(0, -1).map((_, index) => {
        const from = points[index];
        const to = points[index + 1];
        // Состояние сегмента: пройдено, если уроки до этого пройдены,
        // активно, если следующий урок, впереди — иначе.
        const isDone = Boolean(items[index]?.practised);
        const isActive = !isDone && index === items.findIndex((l) => !l.practised) - 1;
        const color = isDone ? TRAIL_DONE : isActive ? TRAIL_ACTIVE : TRAIL_AHEAD;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        // Волна: середина отрывается от прямой линии
        const ctrlX = midX + (to.x - from.x) * 0.15;
        const ctrlY = midY;
        return (
          <Path
            key={`seg-${index}`}
            d={`M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`}
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}

/**
 * Пульсирующее кольцо для активного уровня.
 *
 * Анимация на UI-потоке Reanimated: свечение растёт и убывает
 * через withRepeat + withSequence.
 */
function Halo({ active }) {
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (!active) {
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Animated.Easing.inOut(Animated.Easing.quad) }),
        withTiming(0, { duration: 800, easing: Animated.Easing.inOut(Animated.Easing.quad) })
      ),
      -1,
      true
    );
  }, [active, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.5 * pulse.value,
    borderWidth: 2 + pulse.value * 2,
    transform: [{ scale: 1 + 0.08 * pulse.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          borderColor: brand.goldBorder,
        },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Поповер с полным названием урока (паттерн Duolingo).
 *
 * При тапе на кружок открывается модальное окно с полным названием,
 * наградой (+10 XP) и кнопкой «НАЧАТЬ КЕЙС».
 */
function LessonPopover({ lesson, onStart, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.popover}>
          <Text style={styles.popoverEyebrow}>УРОК {lesson.order}</Text>
          <Text style={styles.popoverTitle}>{lesson.title}</Text>
          {lesson.short_title ? (
            <Text style={styles.popoverShort}>{lesson.short_title}</Text>
          ) : null}
          <View style={styles.rewardRow}>
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardText}>+10 XP</Text>
            </View>
          </View>
          <TactilePressable
            style={styles.popoverBtn}
            onPress={() => {
              onStart();
              onClose();
            }}
            haptic
            scale={0.95}
          >
            <Text style={styles.popoverBtnText}>НАЧАТЬ КЕЙС</Text>
          </TactilePressable>
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * @param {Array}    lessons  Уроки темы: { lesson_id, title, order, practised, short_title }.
 * @param {number}   width    Доступная ширина.
 * @param {Function} onPick   (lesson) => void
 */
export function LessonSnake({ lessons, width = 320, onPick }) {
  const items = useMemo(() => lessons ?? [], [lessons]);
  const points = useMemo(() => snakePoints(items.length, width), [items.length, width]);
  const nextIndex = useMemo(() => nextLessonIndex(items), [items]);
  const [popoverLesson, setPopoverLesson] = useState(null);

  if (!items.length) return null;

  return (
    <View style={[styles.canvas, { height: pathHeight(items.length), width }]}>
      {/* Тропа: SVG-линия под кружками. */}
      <Trail points={points} items={items} />

      {items.map((lesson, index) => {
        const point = points[index];
        const done = Boolean(lesson.practised);
        const isNext = index === nextIndex;
        return (
          <View
            key={lesson.lesson_id}
            style={[styles.nodeWrap, { left: point.x - NODE / 2, top: point.y - NODE / 2 }]}
          >
            {isNext ? <Halo active /> : null}
            <TactilePressable
              onPress={() => {
                if (!onPick) return;
                if (done) {
                  onPick(lesson);
                } else {
                  setPopoverLesson(lesson);
                }
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              scale={0.9}
              haptic
              borderDepth={6}
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
            </TactilePressable>
          </View>
        );
      })}

      {/* Краткие подписи под каждым кружком. */}
      {items.map((lesson, index) => {
        const point = points[index];
        const isNext = index === nextIndex;
        return (
          <View
            key={`label-${lesson.lesson_id}`}
            pointerEvents="none"
            style={[styles.labelWrap, labelPos(point, width)]}
          >
            <Text
              style={[
                styles.label,
                isNext && styles.labelNext,
              ]}
              numberOfLines={2}
            >
              {lesson.short_title ?? lesson.title}
            </Text>
          </View>
        );
      })}

      {popoverLesson ? (
        <LessonPopover
          lesson={popoverLesson}
          onStart={() => onPick?.(popoverLesson)}
          onClose={() => setPopoverLesson(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * Позиция краткой подписи: под кружком, по центру.
 *
 * Кружок не касается края полотна (PADDING_X), но подпись шире
 * кружка: если поставить её по центру, она выйдет за край.
 * Сдвигаем внутрь полотна, чтобы текст не обрезался.
 */
function labelPos(point, width) {
  const left = Math.max(
    4,
    Math.min(width - LABEL_WIDTH - 4, point.x - LABEL_WIDTH / 2),
  );
  const top = point.y + NODE / 2 + 6;
  return { left, top };
}

const styles = StyleSheet.create({
  canvas: { position: 'relative', alignSelf: 'center' },
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
    borderBottomWidth: 6,
    borderColor: brand.ruleStrong,
    backgroundColor: brand.paperSoft,
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
  labelWrap: {
    position: 'absolute',
    width: LABEL_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: brand.card,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: brand.muted,
    textAlign: 'center',
  },
  labelNext: {
    color: brand.ink,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 37, 32, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popover: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: brand.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 5,
    borderColor: brand.gold,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  popoverEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
  },
  popoverTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  popoverShort: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.subtext,
    textAlign: 'center',
  },
  rewardRow: { marginTop: 4 },
  rewardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.5,
    borderColor: brand.gold,
  },
  rewardText: { fontSize: 14, fontWeight: '900', color: brand.goldInk },
  popoverBtn: {
    marginTop: 8,
    width: '100%',
    backgroundColor: brand.red,
    borderRadius: 16,
    borderBottomWidth: 5,
    borderBottomColor: brand.redDark,
    paddingVertical: 15,
    alignItems: 'center',
  },
  popoverBtnText: { fontSize: 15.5, fontWeight: '900', color: brand.creamText },
});

export default LessonSnake;

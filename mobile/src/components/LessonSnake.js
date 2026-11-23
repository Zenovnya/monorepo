/**
 * Карта уроков темы: S-образная тропа с тактическими кружками.
 *
 * Техзадание §2 (редизайн змейки):
 *
 * 1. **Траектория — S-образная кривая** «центр → вправо → центр →
 *    влево → центр». Координаты считаются в `snakeLayout` — без
 *    жестко заданных позиций.
 * 2. **Тропа — react-native-svg `<Path>` кубической Безье.** Два слоя:
 *    фоновый участок пунктирный (`strokeDasharray="6, 6"`, `#D6CCB8`),
 *    пройденный — сплошная золотая линия (`#C99A3E`, `strokeWidth={3}`),
 *    которая анимированно вырастает до активного узла.
 * 3. **Узлы — только номера** (1–4), без подписей с многоточиями.
 *    Финальный 5-й узел — золотая иконка весов (финальный кейс темы).
 *    Нижняя 3D-граница `borderBottomWidth: 4`: темно-золотая `#9A7225`
 *    для активного, серо-бежевая `#C7BFA9` для закрытых — анимированно
 *    вдавливается при нажатии через Reanimated (TactilePressable).
 * 4. **Пульсирующее кольцо** у активного узла (`withRepeat`).
 * 5. **Tooltip-бабл** над выбранным/активным узлом: карточка-облачко
 *    с полным названием урока и кнопкой «Изучить». При нажатии на другой
 *    узел бабл плавно перемещается через `withSpring`; для закрытых уроков
 *    — замок и «Откроется после урока X».
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Scale, Lock } from 'lucide-react-native';
import Animated, {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Reanimated 4 не exports Animated.Path — react-native-svg оборачиваем
// через createAnimatedComponent (обёртка создана вне компонента, чтобы
// Reanimated не пересоздавал её на каждый рендер).
const AnimatedPath = createAnimatedComponent(Path);

import { TactilePressable } from './TactilePressable';
import { brand, serifFamily } from './KhokhlomaOrnament';
import {
  NODE,
  nextLessonIndex,
  pathHeight,
  snakePoints,
} from './snakeLayout';

/** Палитра тропы по техзаданию §2. */
const TRAIL_DASH = '#D6CCB8'; // пунктир — участок впереди
const TRAIL_GOLD = '#C99A3E'; // сплошная золотая — пройденный участок
const BORDER_ACTIVE = '#9A7225'; // темно-золотая нижняя грань (активный)
const BORDER_CLOSED = '#C7BFA9'; // серо-бежевая нижняя грань (закрытый)
const CARD = '#FCF9F2'; // цвет карточки-облачка
const CARD_BORDER = '#E4DCCB'; // тонкая рамка облачка

/**
 * Построить кубическую Безье через все точки тропы.
 *
 * Из каждой точки — прямой вылет, в следующую — плавный вход.
 * Для одной точки — просто маркер, для двух — прямая.
 */
function buildTrailPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const span = Math.max(Math.abs(dx), Math.abs(dy)) * 0.55;
    const c1x = start.x + dx * 0.45;
    const c1y = start.y;
    const c2x = end.x - dx * 0.45;
    const c2y = end.y - dy * 0.1;
    // Горизонтальный разворот учитывает изгиб S-кривой.
    const spread = Math.abs(dx) > 0 ? Math.sign(dx) * span * 0.35 : 0;
    d += ` C ${c1x + spread} ${c1y}, ${c2x + spread} ${c2y}, ${end.x} ${end.y}`;
  }
  return d;
}

/** Оценка длины тропы для strokeDasharray (кубические контроллы чуть длиннее прямой). */
function estimateLength(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return Math.max(len * 1.4, 1);
}

/**
 * Тропа: фоновый пунктир + анимированная золотая линия прогресса.
 *
 * Золотой слой ведёт себя как лента: strokeDashoffset уменьшается от
 * полной длины к нулю по числу пройденных сегментов.
 */
function Trail({ points, progressIndex }) {
  const pathData = buildTrailPath(points);
  const totalLength = useMemo(() => estimateLength(points), [points]);
  const progress = useSharedValue(0);

  useEffect(() => {
    const segments = Math.max(points.length - 1, 1);
    const ratio = Math.min(Math.max(progressIndex / segments, 0), 1);
    progress.value = withTiming(ratio, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [points.length, progressIndex, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: totalLength,
    strokeDashoffset: totalLength * (1 - progress.value),
  }));

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${Math.max(points[0]?.x * 2 || 1, 1)} ${pathHeight(points.length)}`}
      preserveAspectRatio="none"
    >
      {/* Фон: пунктир — участок, который ещё не пройдён. */}
      <Path
        d={pathData}
        stroke={TRAIL_DASH}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="6, 6"
        fill="none"
      />
      {/* Пройденный участок: сплошная золотая линия, вырастает до активного узла. */}
      <AnimatedPath
        d={pathData}
        animatedProps={animatedProps}
        stroke={TRAIL_GOLD}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Пульсирующее кольцо активного узла.
 *
 * Анимация на UI-потоке: свечение растёт и убывает через withRepeat.
 */
function Halo() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.5 * pulse.value,
    borderWidth: 2 + pulse.value * 2,
    transform: [{ scale: 1 + 0.08 * pulse.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { borderColor: TRAIL_GOLD }, animatedStyle]}
    />
  );
}

/**
 * Tooltip-бабл: карточка-облачко с названием урока.
 *
 * Позиция — абсолютная, перемещение на UI-потоке через withSpring.
 * Для открытых уроков — кнопка «Изучить»; для закрытых — замок и
 * надпись «Откроется после урока X».
 */
function TooltipBubble({ lesson, prevLesson, x, y, onStudy }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const bubbleX = useSharedValue(0);
  const bubbleY = useSharedValue(0);

  useEffect(() => {
    if (!size.w || !size.h) return;
    // Перемещение к узлу: спринг, а не скачок.
    bubbleX.value = withSpring(x - size.w / 2, {
      damping: 16,
      stiffness: 200,
    });
    bubbleY.value = withSpring(y, { damping: 16, stiffness: 200 });
  }, [x, y, size.w, size.h, bubbleX, bubbleY]);

  const locked = lesson && !lesson.practised && prevLesson;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.bubbleWrap,
        {
          transform: [{ translateX: bubbleX }, { translateY: bubbleY }],
        },
      ]}
    >
      <View
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ w: width, h: height });
        }}
        style={[styles.bubble, { borderColor: CARD_BORDER, backgroundColor: CARD }]}
      >
        {locked ? (
          <View style={styles.lockedRow}>
            <Lock size={16} color={brand.muted} />
            <Text style={styles.lockedText}>
              Откроется после урока {prevLesson.order}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.bubbleTitle}>{lesson?.title}</Text>
            {onStudy && lesson ? (
              <TactilePressable
                style={styles.studyBtn}
                onPress={() => onStudy(lesson)}
                haptic
                scale={0.94}
                hapticStyle="medium"
              >
                <Text style={styles.studyText}>Изучить</Text>
              </TactilePressable>
            ) : null}
          </>
        )}
      </View>
      {/* Острие облачка вниз — к узлу. */}
      <View style={[styles.tail, { borderColor: CARD_BORDER, backgroundColor: CARD }]} />
    </Animated.View>
  );
}

/**
 * @param {Array}    lessons  Уроки темы: { lesson_id, title, order, practised }.
 * @param {number}   width    Доступная ширина полотна.
 * @param {Function} onPick   (lesson) => void — открыть урок.
 */
export function LessonSnake({ lessons, width = 320, onPick }) {
  const items = useMemo(() => lessons ?? [], [lessons]);
  const points = useMemo(() => snakePoints(items.length, width), [items.length, width]);
  const nextIndex = useMemo(() => nextLessonIndex(items), [items]);
  // Выбранный узел: по умолчанию — активный (первый непройденный).
  const [selectedIndex, setSelectedIndex] = useState(
    nextIndex >= 0 ? nextIndex : items.length - 1,
  );

  if (!items.length) return null;

  const selected = items[selectedIndex];
  const prevLesson = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const isLockedSelected =
    selectedIndex > nextIndex && nextIndex >= 0 && !selected.practised;

  // Позиция бабла: над выбранным узлом, по центру, с кропом по краям.
  const point = points[selectedIndex];
  const bubbleY = point.y - NODE / 2 - 96; // высота облачка + отступ
  const bubbleX = Math.max(
    40,
    Math.min(width - 40, point.x),
  );

  return (
    <View style={[styles.canvas, { height: pathHeight(items.length), width }]}>
      {/* Тропа: SVG-линия под кружками. */}
      <Trail points={points} progressIndex={Math.max(nextIndex, 0)} />

      {items.map((lesson, index) => {
        const pt = points[index];
        const done = Boolean(lesson.practised);
        const isNext = index === nextIndex;
        const isLast = index === items.length - 1;

        return (
          <View
            key={lesson.lesson_id}
            style={[styles.nodeWrap, { left: pt.x - NODE / 2, top: pt.y - NODE / 2 }]}
          >
            {isNext ? <Halo /> : null}
            <TactilePressable
              onPress={() => setSelectedIndex(index)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              scale={0.9}
              haptic
              borderDepth={4}
              accessibilityRole="button"
              accessibilityLabel={`Урок ${lesson.order}: ${lesson.title}`}
              style={[
                styles.node,
                done && styles.nodeDone,
                isNext && styles.nodeNext,
                {
                  borderColor: isNext ? TRAIL_GOLD : BORDER_CLOSED,
                  borderBottomColor: isNext ? BORDER_ACTIVE : BORDER_CLOSED,
                },
              ]}
            >
              {isLast ? (
                <Scale size={30} color={done ? '#FFFDF9' : TRAIL_GOLD} />
              ) : (
                <Text
                  style={[
                    styles.nodeText,
                    done && styles.nodeTextDone,
                    isNext && styles.nodeTextNext,
                  ]}
                >
                  {lesson.order}
                </Text>
              )}
            </TactilePressable>
          </View>
        );
      })}

      {/* Tooltip-бабл над выбранным узлом. */}
      <TooltipBubble
        lesson={isLockedSelected ? null : selected}
        prevLesson={isLockedSelected ? prevLesson : null}
        x={bubbleX}
        y={bubbleY}
        onStudy={(lesson) => {
          onPick?.(lesson);
        }}
      />
    </View>
  );
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
    backgroundColor: brand.paperSoft,
  },
  nodeDone: {
    backgroundColor: TRAIL_GOLD,
    borderColor: TRAIL_GOLD,
    borderBottomColor: BORDER_ACTIVE,
  },
  nodeNext: {
    backgroundColor: brand.card,
  },
  nodeText: {
    fontSize: 26,
    fontWeight: '900',
    color: brand.muted,
    fontFamily: serifFamily,
  },
  nodeTextDone: { color: '#FFFDF9' },
  nodeTextNext: { color: brand.ink },
  halo: {
    position: 'absolute',
    width: NODE + 18,
    height: NODE + 18,
    borderRadius: (NODE + 18) / 2,
    borderWidth: 2,
    opacity: 0.9,
  },
  bubbleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  bubble: {
    width: 240,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bubbleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.ink,
    lineHeight: 17,
  },
  studyBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: TRAIL_GOLD,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderBottomColor: BORDER_ACTIVE,
  },
  studyText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFDF9',
    letterSpacing: 0.5,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: brand.muted,
    lineHeight: 16,
  },
  tail: {
    position: 'absolute',
    left: '50%',
    bottom: -7,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});

export default LessonSnake;

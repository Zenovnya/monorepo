/**
 * PathConnector — соединительная линия змейки уроков.
 *
 * Два слоя через react-native-svg <Path>:
 * - фоновая дорожка (track) — приглушённая;
 * - анимированная линия прогресса — бегает до текущего активного
 *   урока через strokeDashoffset (useAnimatedProps, UI-поток).
 *
 * Линия проходит через середины узлов: каждый сегмент — кубическая
 * Безье с прямым уходом из точки и плавным входом в следующую.
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

/** Анимированный Path: Reanimated 4 не exports Animated.Path, поэтому
 *  react-native-svg оборачиваем через createAnimatedComponent. */
const AnimatedPath = createAnimatedComponent(Path);

/** Тип для animatedProps useAnimatedProps. */
type DashPathProps = {
  strokeDasharray: string | number;
  strokeDashoffset: number;
};

/** Размер узла PathNode — совпадает с PathNode. */
const NODE_SIZE = 56;

interface PathConnectorProps {
  /** Координаты центров узлов в px. */
  points: Array<{ x: number; y: number }>;
  /** До какого узла (по индексу) нарисован прогресс. */
  progressIndex: number;
}

/**
 * Превращает цепочку точек в кубические Безье:
 * из каждой точки — прямой вылет, в следующую — плавный вход.
 * Для двух точек ведёт себя как прямая линия.
 */
export function buildSnakePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Контрольные точки кубической Безье. Отбой горизонтали
    // учитывает горизонтальный сдвиг синусоиды — излом следует
    // за изгибом змейки, а не идёт по диагонали между узлами.
    const controlSpan = Math.max(Math.abs(dx), Math.abs(dy)) * 0.55;
    const c1x = start.x + dx * 0.45 + (Math.abs(dx) > 0 ? Math.sign(dx) * controlSpan * 0.35 : 0);
    const c1y = start.y;
    const c2x = end.x - dx * 0.45 + (Math.abs(dx) > 0 ? Math.sign(dx) * controlSpan * 0.35 : 0);
    const c2y = end.y - dy * 0.1;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  }
  return d;
}

export function PathConnector({ points, progressIndex }: PathConnectorProps) {
  const pathData = buildSnakePath(points);
  const totalLength = 1400;
  const progress = useSharedValue(0);

  useEffect(() => {
    const ratio = points.length > 1 ? progressIndex / (points.length - 1) : 0;
    progress.value = withTiming(ratio, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [points.length, progressIndex, progress]);

  const animatedProps = useAnimatedProps<DashPathProps>(() => ({
    strokeDasharray: totalLength,
    strokeDashoffset: totalLength * (1 - progress.value),
  }));

  const height =
    points.length > 0 ? points[points.length - 1].y - points[0].y + NODE_SIZE : 0;

  return (
    <Svg
      width="100%"
      height={height}
      style={styles.svg}
    >
      <Path
        d={pathData}
        fill="none"
        stroke={colors.track}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <AnimatedPath
        d={pathData}
        animatedProps={animatedProps}
        fill="none"
        stroke={colors.success}
        strokeWidth={7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: {
    marginTop: -NODE_SIZE / 2 - 10,
    marginHorizontal: -8,
  },
});

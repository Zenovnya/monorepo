/**
 * Дизайн-токены LexBear.
 *
 * Единственный источник визуальных значений: цвета, типографика, отступы,
 * радиусы, глубина. Экраны и компоненты не задают размеры и цвета числами —
 * только через токены, иначе экраны снова начнут «расходиться» (см.
 * docs/design/visual-audit.md, где зафиксированы 15 экранов с хардкодом).
 *
 * Палитра остаётся прежней (cream / ink / gold) — токены её систематизируют.
 */

import { colors as palette } from './colors';

export const colors = {
  ...palette,

  // --- Поверхности ---
  surface: palette.background,
  surfaceAlt: palette.paper,
  surfaceRaised: palette.card,

  // --- Полутона, которые раньше хардкодились в экранах ---
  goldTint: '#FFF7DE', // выбранный вариант / акцентный фон
  successTint: '#EAF8EE', // фон успеха
  errorTint: '#FFF0F0', // фон ошибки
  overlay: 'rgba(31, 42, 68, 0.35)', // затемнение модалок

  // --- Медали таблицы лидеров ---
  gold: '#C9A227',
  silver: '#C0C0C0',
  bronze: '#CD7F32',

  // --- Дополнительные поверхности, которые раньше хардкодились ---
  goldSoft: '#E6C75A',
  skyTint: '#DFF1FB', // чип с гемами
  streakTint: '#FFF4D1', // чип со стриком
  roomFloor: '#EFE3C8', // пол комнаты мишки
  roomWood: '#5A3620', // деревянный плинтус комнаты

  // --- Границы ---
  border: palette.border,
  borderSoft: '#E4D9C8', // мягкая граница карточек и «подошва» кнопок

  // --- Глубина ---
  shadow: 'rgba(31, 42, 68, 0.16)',
};

/**
 * Типографика: 6 ролей вместо произвольных размеров от 11 до 32.
 * Каждая роль — готовый объект для StyleSheet (size/weight/lineHeight/spacing).
 */
export const typography = {
  display: { fontSize: 32, fontWeight: '900', lineHeight: 38, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '900', lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '800', lineHeight: 24, letterSpacing: 0 },
  body: { fontSize: 15, fontWeight: '600', lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, fontWeight: '800', lineHeight: 22, letterSpacing: 0 },
  caption: { fontSize: 13, fontWeight: '700', lineHeight: 18, letterSpacing: 0 },
  micro: { fontSize: 11, fontWeight: '800', lineHeight: 14, letterSpacing: 1 },
};

/** Шкала отступов: только эти значения. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

/** Шкала радиусов. */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

/**
 * Глубина в стиле Duolingo: не размытая тень, а плотная «подошва» снизу.
 * Используется кнопками и нажимаемыми карточками.
 *
 * В RN 0.81+ пропсы `shadow*` объявлены устаревшими и пишут предупреждение
 * в консоль. Используем CSS-подобный `boxShadow` — он работает и на вебе.
 * Ключ `elevation` оставлен для Android API < 28, где `boxShadow` игнорируется.
 */
export const elevation = {
  none: {},
  press: (color) => ({
    boxShadow: `0px 4px 0px ${color}`,
    elevation: 4,
  }),
  card: {
    boxShadow: `0px 2px 8px ${colors.shadow}`,
    elevation: 2,
  },
  floating: {
    boxShadow: `0px 8px 20px ${colors.shadow}`,
    elevation: 8,
  },
};

/** Высота основных интерактивных элементов и таб-бара. */
export const sizes = {
  button: 56,
  buttonHeight: 58,
  buttonDepth: 6,
  iconButton: 38,
  tabBar: 64,
  minTouchTarget: 44,
};

export default { colors, typography, spacing, radius, elevation, sizes };

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

/**
 * Расширенная палитра дизайн-системы LexBear
 * («Хохлома · Старинные документы · Современная графика»).
 *
 * Главная пара бренда — лаковый красный (#C9362B) и золотой (#D9A849)
 * на сливочной бумаге (#F7EFDF) с чернильным текстом (#302820).
 * Хвойный (#315B46) отвечает за верные ответы, приглушённый синий (#7298BC) —
 * строго за подсказки, ссылки и справочную информацию.
 */
export const brand = {
  // Сливочная бумага и слои документа
  cream: '#F7EFDF',
  paper: '#EDE1CA',
  paperSoft: '#F2E7D3',
  card: '#FCF8F0',
  rule: '#E2D3B8',
  ruleStrong: '#D3C0A1',

  // Лаковый красный — главные действия, ягодки хохломы, сургуч, закладки
  red: '#C9362B',
  redDark: '#99241B',
  redDeep: '#7C1D16',
  redSoft: '#FAECE9',
  redBorder: '#E5B5AE',

  // Золотой — XP, награды, рамки достижений, особые кейсы, завитки и листья
  gold: '#D9A849',
  goldDark: '#AE7F26',
  goldInk: '#8A6218',
  goldLight: '#F1D999',
  goldSoft: '#FAF1DC',
  goldBorder: '#E2C175',

  // Чернильный — основной текст и тёмный лак парадных карточек
  ink: '#302820',
  inkDeep: '#221C16',
  subtext: '#6E5F4F',
  muted: '#968571',
  locked: '#B2A189',

  // Хвойный — правильные ответы и подтверждённые статусы
  pine: '#315B46',
  pineDark: '#214031',
  pineSoft: '#E6F0EB',
  pineBorder: '#9DBAA9',

  // Приглушённый синий — только подсказки и информация
  info: '#7298BC',
  infoInk: '#4A6F91',
  infoSoft: '#ECF2F7',
  infoBorder: '#BFD1E2',

  creamText: '#FCF8F0',
};

/**
 * Аккуратный антиквенный шрифт для параграфов (§), римских цифр глав,
 * сургучных печатей и коротких архивных акцентов (не спорит с современным UI).
 */
export const serifFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

/* ============================================================================
 * 1. МИНИАТЮРНЫЕ БОТАНИЧЕСКИЕ ЭЛЕМЕНТЫ ХОХЛОМЫ (ягодка, листок, завиток)
 *    Чистые React Native View — 0 КБ, идеальная резкость на любом DPI.
 * ========================================================================== */

function Berry({ size = 5.5, color = brand.red, dotColor = brand.goldLight, style }) {
  const dot = Math.max(1.5, size * 0.28);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: size * 0.18,
          left: size * 0.2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: dotColor,
          opacity: 0.9,
        }}
      />
    </View>
  );
}

function Leaf({ w = 8.5, h = 4.2, rotate = '0deg', color = brand.gold, style }) {
  const r = Math.max(w, h);
  return (
    <View
      style={[
        {
          width: w,
          height: h,
          backgroundColor: color,
          borderTopLeftRadius: r,
          borderBottomRightRadius: r,
          borderTopRightRadius: 1,
          borderBottomLeftRadius: 1,
          transform: [{ rotate }],
        },
        style,
      ]}
    />
  );
}

/**
 * Гроздь хохломской рябинки с парой золотых листочков (центральный мотив).
 */
export function KhokhlomaSprig({ variant = 'light', compact = false, style }) {
  const leafColor = variant === 'onRed' ? brand.goldLight : brand.gold;
  const berryColor =
    variant === 'onRed' ? '#FCF3DE' : brand.red;
  const berryDot =
    variant === 'onRed' ? brand.red : brand.goldLight;
  const k = compact ? 0.82 : 1;

  return (
    <View style={[styles.sprigWrap, style]} pointerEvents="none">
      {/* Левый завиток-травка */}
      <View
        style={[
          styles.curlLeft,
          {
            width: 11 * k,
            height: 7 * k,
            borderColor: leafColor,
          },
        ]}
      />
      {/* Левый золотой листок */}
      <Leaf
        w={8.5 * k}
        h={4.2 * k}
        rotate="-24deg"
        color={leafColor}
        style={{ marginRight: -1 }}
      />

      {/* Тройная гроздь ягодок */}
      <View style={[styles.berryTrio, { width: 14 * k, height: 11 * k }]}>
        <Berry
          size={4.4 * k}
          color={berryColor}
          dotColor={berryDot}
          style={{ position: 'absolute', left: 0, bottom: 0.5 }}
        />
        <Berry
          size={4.4 * k}
          color={berryColor}
          dotColor={berryDot}
          style={{ position: 'absolute', right: 0, bottom: 0.5 }}
        />
        <Berry
          size={5.6 * k}
          color={berryColor}
          dotColor={berryDot}
          style={{ position: 'absolute', left: 4.2 * k, top: 0 }}
        />
      </View>

      {/* Правый золотой листок */}
      <Leaf
        w={8.5 * k}
        h={4.2 * k}
        rotate="24deg"
        color={leafColor}
        style={{ marginLeft: -1 }}
      />
      {/* Правый завиток-травка */}
      <View
        style={[
          styles.curlRight,
          {
            width: 11 * k,
            height: 7 * k,
            borderColor: leafColor,
          },
        ]}
      />
    </View>
  );
}

/* ============================================================================
 * 2. ДЕКОРАТИВНЫЕ УГОЛКИ ХОХЛОМЫ (KhokhlomaCorners)
 *    Для рамок достижений, особых кейсов, наград, заголовков глав и финала урока.
 * ========================================================================== */

function SingleCorner({ pos, arm, lineColor, berryColor, dotColor, compact }) {
  const isTop = pos.startsWith('t');
  const isLeft = pos.endsWith('l');
  const sx = isLeft ? 1 : -1;
  const sy = isTop ? 1 : -1;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: arm + 4,
          height: arm + 4,
          transform: [{ scaleX: sx }, { scaleY: sy }],
        },
        isTop ? { top: 0 } : { bottom: 0 },
        isLeft ? { left: 0 } : { right: 0 },
      ]}
    >
      {/* Тонкие золотые усики уголка */}
      <View
        style={{
          position: 'absolute',
          top: 1,
          left: 5,
          width: arm - 4,
          height: 1.3,
          backgroundColor: lineColor,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 5,
          left: 1,
          width: 1.3,
          height: arm - 4,
          backgroundColor: lineColor,
          opacity: 0.85,
        }}
      />
      {/* Капельки на концах усиков */}
      <View
        style={{
          position: 'absolute',
          top: 0.2,
          left: arm,
          width: 2.8,
          height: 2.8,
          borderRadius: 2,
          backgroundColor: lineColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: arm,
          left: 0.2,
          width: 2.8,
          height: 2.8,
          borderRadius: 2,
          backgroundColor: lineColor,
        }}
      />
      {/* Два маленьких золотых листочка вдоль лучей */}
      {!compact ? (
        <>
          <Leaf
            w={6.5}
            h={3}
            rotate="14deg"
            color={lineColor}
            style={{ position: 'absolute', top: 2.4, left: 7 }}
          />
          <Leaf
            w={6.5}
            h={3}
            rotate="76deg"
            color={lineColor}
            style={{ position: 'absolute', top: 8.5, left: 1 }}
          />
          {/* Внутренний тонкий завиток кудрины */}
          <View
            style={{
              position: 'absolute',
              top: 5.5,
              left: 5.5,
              width: 7,
              height: 7,
              borderTopLeftRadius: 6,
              borderTopWidth: 1.1,
              borderLeftWidth: 1.1,
              borderColor: lineColor,
              opacity: 0.65,
            }}
          />
        </>
      ) : null}
      {/* Лаково-красная ягодка в вершине уголка */}
      <Berry
        size={compact ? 4.4 : 5.4}
        color={berryColor}
        dotColor={dotColor}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
    </View>
  );
}

/**
 * Четыре тонких красно-золотых уголка внутри карточки.
 * variant: 'light' | 'onDark' | 'onRed'
 * size: 'sm' | 'md'
 */
export function KhokhlomaCorners({
  variant = 'light',
  size = 'md',
  inset = 7,
}) {
  const compact = size === 'sm';
  const arm = compact ? 13 : 21;
  const lineColor =
    variant === 'onRed' || variant === 'onDark' ? brand.goldLight : brand.gold;
  const berryColor =
    variant === 'onRed' ? '#FCF3DE' : brand.red;
  const dotColor =
    variant === 'onRed' ? brand.red : brand.goldLight;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: inset,
        right: inset,
        bottom: inset,
        left: inset,
      }}
    >
      <SingleCorner
        pos="tl"
        arm={arm}
        lineColor={lineColor}
        berryColor={berryColor}
        dotColor={dotColor}
        compact={compact}
      />
      <SingleCorner
        pos="tr"
        arm={arm}
        lineColor={lineColor}
        berryColor={berryColor}
        dotColor={dotColor}
        compact={compact}
      />
      <SingleCorner
        pos="bl"
        arm={arm}
        lineColor={lineColor}
        berryColor={berryColor}
        dotColor={dotColor}
        compact={compact}
      />
      <SingleCorner
        pos="br"
        arm={arm}
        lineColor={lineColor}
        berryColor={berryColor}
        dotColor={dotColor}
        compact={compact}
      />
    </View>
  );
}

/* ============================================================================
 * 3. ТОНКИЙ РАЗДЕЛИТЕЛЬ ХОХЛОМЫ (KhokhlomaDivider)
 * ========================================================================== */

export function KhokhlomaDivider({ variant = 'light', label, style }) {
  const lineColor =
    variant === 'onRed' || variant === 'onDark'
      ? 'rgba(241, 217, 153, 0.42)'
      : 'rgba(217, 168, 73, 0.55)';
  const beadColor =
    variant === 'onRed' || variant === 'onDark' ? brand.goldLight : brand.gold;

  return (
    <View style={[styles.dividerRow, style]} pointerEvents="none">
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
      <View style={[styles.dividerBead, { backgroundColor: beadColor }]} />
      {label ? (
        <Text
          style={[
            styles.dividerLabel,
            variant !== 'light' && { color: brand.goldLight },
          ]}
        >
          {label}
        </Text>
      ) : (
        <KhokhlomaSprig variant={variant} compact />
      )}
      <View style={[styles.dividerBead, { backgroundColor: beadColor }]} />
      <View style={[styles.dividerLine, { backgroundColor: lineColor }]} />
    </View>
  );
}

/* ============================================================================
 * 4. ТОНКИЙ БОРДЮР-ФРИЗ ДЛЯ ЗАГОЛОВКОВ ГЛАВ (KhokhlomaGarland)
 * ========================================================================== */

export function KhokhlomaGarland({ variant = 'onRed', count = 5, style }) {
  const vineColor =
    variant === 'onRed'
      ? 'rgba(241, 217, 153, 0.65)'
      : variant === 'onDark'
      ? 'rgba(217, 168, 73, 0.78)'
      : 'rgba(217, 168, 73, 0.72)';
  const leafColor =
    variant === 'onRed' ? brand.goldLight : brand.gold;
  const berryColor =
    variant === 'onRed' ? '#911E16' : brand.red;
  const berryRim =
    variant === 'onRed' ? brand.goldLight : 'transparent';
  const dotColor = brand.goldLight;
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={[styles.garlandWrap, style]} pointerEvents="none">
      <View style={[styles.garlandHairline, { backgroundColor: vineColor }]} />
      <View style={styles.garlandNodes}>
        {items.map((idx) => (
          <React.Fragment key={idx}>
            <View style={styles.garlandMotif}>
              <Leaf w={6.5} h={3.2} rotate="-22deg" color={leafColor} />
              <View
                style={[
                  variant === 'onRed' && {
                    padding: 0.8,
                    borderRadius: 6,
                    backgroundColor: berryRim,
                  },
                ]}
              >
                <Berry
                  size={variant === 'onRed' ? 4.8 : 5.2}
                  color={variant === 'onRed' ? brand.red : berryColor}
                  dotColor={dotColor}
                />
              </View>
              <Leaf w={6.5} h={3.2} rotate="22deg" color={leafColor} />
            </View>
            {idx < items.length - 1 ? (
              <View
                style={[
                  styles.garlandArc,
                  {
                    borderColor: vineColor,
                    transform: [{ scaleY: idx % 2 === 0 ? 1 : -1 }],
                  },
                ]}
              />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/* ============================================================================
 * 5. ПРАЗДНИЧНЫЙ МЕДАЛЬОН НАГРАДЫ / ФИНАЛА ОБУЧЕНИЯ (KhokhlomaMedallion)
 * ========================================================================== */

export function KhokhlomaMedallion({
  size = 196,
  variant = 'light',
  muted = false,
  children,
  style,
}) {
  const outerBg = muted
    ? brand.paperSoft
    : variant === 'onDark'
    ? '#3B2F24'
    : brand.goldSoft;
  const innerBg = muted
    ? brand.card
    : variant === 'onDark'
    ? '#292018'
    : brand.card;
  const ringColor = muted ? brand.ruleStrong : brand.gold;
  const berryColor = muted ? brand.locked : brand.red;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: outerBg,
          borderWidth: 2,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* Внутреннее тонкое лаково-золотое кольцо */}
      <View
        style={{
          width: size - 14,
          height: size - 14,
          borderRadius: (size - 14) / 2,
          backgroundColor: innerBg,
          borderWidth: 1.2,
          borderColor: muted
            ? brand.rule
            : variant === 'onDark'
            ? 'rgba(217, 168, 73, 0.55)'
            : brand.redBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>

      {/* Деликатные хохломские акценты сверху, снизу и по бокам медальона */}
      {!muted ? (
        <>
          <View
            style={[
              styles.medallionCrown,
              {
                top: -5,
                backgroundColor: variant === 'onDark' ? brand.ink : brand.cream,
              },
            ]}
            pointerEvents="none"
          >
            <KhokhlomaSprig compact />
          </View>
          <View style={[styles.medallionSide, { left: -3 }]} pointerEvents="none">
            <Leaf w={6} h={3} rotate="-72deg" color={brand.gold} style={{ marginBottom: 1 }} />
            <Berry size={5} color={berryColor} />
            <Leaf w={6} h={3} rotate="72deg" color={brand.gold} style={{ marginTop: 1 }} />
          </View>
          <View style={[styles.medallionSide, { right: -3 }]} pointerEvents="none">
            <Leaf w={6} h={3} rotate="72deg" color={brand.gold} style={{ marginBottom: 1 }} />
            <Berry size={5} color={berryColor} />
            <Leaf w={6} h={3} rotate="-72deg" color={brand.gold} style={{ marginTop: 1 }} />
          </View>
          <View
            style={[
              styles.medallionBottom,
              {
                bottom: -3,
                backgroundColor: variant === 'onDark' ? brand.ink : brand.cream,
              },
            ]}
            pointerEvents="none"
          >
            <Leaf w={6.5} h={3} rotate="-16deg" color={brand.gold} />
            <Berry size={5} color={berryColor} />
            <Leaf w={6.5} h={3} rotate="16deg" color={brand.gold} />
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ============================================================================
 * 6. АТМОСФЕРА СТАРИННЫХ ДОКУМЕНТОВ: СУРГУЧНАЯ ПЕЧАТЬ, ЗАКЛАДКА, РУБРИКА
 * ========================================================================== */

/**
 * Круглая сургучная печать старинной грамоты / кодекса.
 * tone: 'red' | 'gold' | 'pine' | 'locked'
 */
export function WaxSeal({
  label,
  sub,
  size = 50,
  tone = 'red',
  style,
}) {
  const paletteMap = {
    red: {
      bg: brand.red,
      rim: brand.redDark,
      ring: 'rgba(252, 248, 240, 0.5)',
      fg: brand.creamText,
    },
    gold: {
      bg: brand.gold,
      rim: brand.goldDark,
      ring: 'rgba(252, 248, 240, 0.6)',
      fg: brand.ink,
    },
    pine: {
      bg: brand.pine,
      rim: brand.pineDark,
      ring: 'rgba(252, 248, 240, 0.45)',
      fg: brand.creamText,
    },
    locked: {
      bg: brand.paper,
      rim: brand.ruleStrong,
      ring: 'rgba(150, 133, 113, 0.4)',
      fg: brand.muted,
    },
  };
  const p = paletteMap[tone] || paletteMap.red;
  const inner = size - 9;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: p.bg,
          borderWidth: 2,
          borderBottomWidth: 3.5,
          borderColor: p.rim,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: 1,
          borderColor: p.ring,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sub ? (
          <Text
            style={{
              fontSize: Math.max(8.5, size * 0.18),
              fontWeight: '700',
              fontFamily: serifFamily,
              color: p.fg,
              opacity: 0.88,
              lineHeight: Math.max(10, size * 0.2),
            }}
          >
            {sub}
          </Text>
        ) : null}
        <Text
          style={{
            fontSize: sub ? Math.max(13, size * 0.3) : Math.max(15, size * 0.36),
            fontWeight: '900',
            fontFamily: serifFamily,
            color: p.fg,
            lineHeight: sub ? Math.max(15, size * 0.33) : Math.max(18, size * 0.4),
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * Шёлковая закладка-ляссе старинного кодекса с вырезом «ласточкин хвост».
 * Крепится к верхнему краю карточки документа/главы/особого кейса.
 */
export function RibbonBookmark({
  color = brand.red,
  symbol = '§',
  right = 16,
  height = 30,
  width = 22,
  cutoutColor = brand.card,
  style,
}) {
  const half = width / 2;
  const notch = Math.round(width * 0.34);

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -1,
          right,
          width,
          height,
          backgroundColor: color,
          alignItems: 'center',
          paddingTop: 4,
          zIndex: 4,
        },
        style,
      ]}
    >
      {symbol ? (
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            fontFamily: serifFamily,
            color: color === brand.gold ? brand.ink : brand.goldLight,
            lineHeight: 12,
          }}
        >
          {symbol}
        </Text>
      ) : null}
      {/* Вырез «ласточкин хвост» снизу ленты */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 0,
          height: 0,
          borderLeftWidth: half,
          borderRightWidth: half,
          borderBottomWidth: notch,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: cutoutColor,
        }}
      />
    </View>
  );
}

/**
 * Типографический заголовок раздела в духе старинного свода законов:
 * аккуратный знак §, заголовок чернильным цветом и тонкая двойная линейка с ягодкой.
 */
export function DocumentSectionHeader({ title, meta, right, style }) {
  return (
    <View style={[styles.docSecWrap, style]}>
      <View style={styles.docSecRow}>
        <View style={styles.docSecLeft}>
          <Text style={styles.docSecSign}>§</Text>
          <Text style={styles.docSecTitle}>{title}</Text>
        </View>
        {right ? (
          right
        ) : meta ? (
          <Text style={styles.docSecMeta}>{meta}</Text>
        ) : null}
      </View>
      <View style={styles.docSecRuleRow}>
        <View style={styles.docSecRuleMain} />
        <View style={styles.docSecDot} />
      </View>
    </View>
  );
}

/**
 * Едва заметные тёплые волокна/водяные линии сливочной бумаги на фоне документа.
 * Не создают шума и не влияют на читаемость и клики.
 */
export function PaperGrain() {
  return (
    <View pointerEvents="none" style={styles.grainOverlay}>
      <View style={[styles.grainLine, { top: 54, opacity: 0.28 }]} />
      <View style={[styles.grainLine, { top: 148, opacity: 0.2 }]} />
      <View style={[styles.grainLine, { top: 264, opacity: 0.22 }]} />
      <View style={[styles.grainLine, { top: 392, opacity: 0.18 }]} />
      <View style={[styles.grainLine, { top: 528, opacity: 0.2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  sprigWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  berryTrio: {
    position: 'relative',
  },
  curlLeft: {
    borderTopWidth: 1.3,
    borderLeftWidth: 1.3,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 6,
    opacity: 0.78,
    marginRight: 1,
  },
  curlRight: {
    borderTopWidth: 1.3,
    borderRightWidth: 1.3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 6,
    opacity: 0.78,
    marginLeft: 1,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1.2,
  },
  dividerBead: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: brand.muted,
    paddingHorizontal: 3,
  },

  garlandWrap: {
    width: '100%',
    paddingBottom: 6,
  },
  garlandNodes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  garlandMotif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  garlandArc: {
    flex: 1,
    height: 5,
    marginHorizontal: 3,
    borderTopWidth: 1.2,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  garlandHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    opacity: 0.45,
  },

  medallionCrown: {
    position: 'absolute',
    backgroundColor: brand.cream,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
  },
  medallionSide: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionBottom: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    backgroundColor: brand.cream,
    paddingHorizontal: 4,
    borderRadius: 999,
  },

  docSecWrap: {
    gap: 6,
  },
  docSecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  docSecLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  docSecSign: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: serifFamily,
    color: brand.red,
  },
  docSecTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: brand.ink,
    letterSpacing: -0.2,
  },
  docSecMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.muted,
  },
  docSecRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  docSecRuleMain: {
    flex: 1,
    height: 1,
    backgroundColor: brand.rule,
  },
  docSecDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: brand.gold,
  },

  grainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  grainLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: '#E5D7BE',
  },
});

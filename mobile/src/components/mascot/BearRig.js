/**
 * BearRig — программный «риг» медведя-маскота на react-native-svg + reanimated.
 *
 * Заменяет статичную PNG-картинку слоёной моделью с независимыми частями
 * (голова, уши, глаза, брови, рот, руки, оверлеи) и конечным автоматом
 * состояний из плана маскота. Каждая часть — SVG-компонент из ./parts.js.
 *
 * Публичный API — одна компонента:
 *   <BearRig
 *     size={220}                  // ширина в px (высота считается пропорционально)
 *     state="correct_small"       // см. STATES ниже — что показывает мордочка
 *     mood="happy"                // модификатор поверх idle (см. MOODS)
 *     isTalking={false}           // включает цикл рта Talk_Loop
 *     onAnimationEnd={() => {}}   // колбек, когда one-shot состояние завершилось
 *   />
 *
 * Все анимации гоняются через reanimated shared values на UI-потоке
 * (без setState) — стабильные 60fps даже при нескольких one-shot параллельно.
 *
 * Внутри — три уровня движения:
 *  1) Idle-фон: дыхание тела + случайное моргание + случайный look-around.
 *     Работает всегда, чтобы персонаж не выглядел «мёртвым».
 *  2) Mood-модификатор: медленное состояние (happy/sleepy/…).
 *  3) One-shot реакции: nod, головной наклон, celebration и т.д.
 *
 * Точки поворота (pivot) головы/ушей вынесены в ./parts.js (const PIVOTS).
 * Вращение вокруг pivot реализовано через классический "translate → rotate →
 * translate back" паттерн — RN по умолчанию поворачивает вокруг центра View,
 * пре- и пост-сдвиги переносят pivot в центр на время поворота.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import * as P from './parts';
import { PIVOTS, MASCOT_CANVAS } from './parts';

// ---------- Каталог состояний (конечный автомат) ----------
/**
 * Каждое состояние — «что показывает мордочка».
 * Пресеты идут парой: набор частей (mouth/brow/blush/overlays) +
 * one-shot анимация головы/тела. Всё остальное (idle-моргание, дыхание)
 * работает поверх независимо.
 */
const STATES = {
  // === Idle / базовые ===
  idle: { mouth: 'closed', brow: 'neutral' },
  idle_bored: { mouth: 'sad', brow: 'neutral' },
  idle_look_around: { mouth: 'closed', brow: 'neutral', lookAround: true },

  // === Реакции на ответы ===
  correct_small: { mouth: 'smile_small', brow: 'up', blush: 0.7, oneShot: 'nod' },
  correct_big: {
    mouth: 'smile_big',
    brow: 'up',
    blush: 1,
    sparkles: true,
    oneShot: 'jump',
  },
  wrong_soft: { mouth: 'sad', brow: 'down', oneShot: 'head_tilt_left' },
  wrong_sad: {
    mouth: 'sad',
    brow: 'down',
    tear: true,
    oneShot: 'slump',
  },
  perfect_lesson: {
    mouth: 'smile_big',
    brow: 'up',
    blush: 1,
    starEyes: true,
    sparkles: true,
    oneShot: 'celebrate',
  },

  // === Речь / talking (мимика при рассказе) ===
  talking: { mouth: 'closed', brow: 'up' }, // рот перебивается циклом isTalking

  // === Системные / UX ===
  onboarding_wave: { mouth: 'smile_big', brow: 'up', oneShot: 'wave' },
  streak_celebrate: {
    mouth: 'smile_big',
    brow: 'up',
    hearts: true,
    oneShot: 'jump',
  },
  streak_broken: { mouth: 'sad', brow: 'down', tear: true },
  achievement_unlock: {
    mouth: 'smile_big',
    brow: 'up',
    sparkles: true,
    oneShot: 'nod',
  },
  level_up: { mouth: 'smile_big', brow: 'up', sparkles: true, oneShot: 'celebrate' },
  loading: { mouth: 'o', brow: 'neutral' },
  error_network: { mouth: 'closed', brow: 'down', questionMark: true },
  notification_reminder: { mouth: 'smile_small', brow: 'up' },
  goodbye: { mouth: 'smile_small', brow: 'neutral', oneShot: 'wave' },
};

/**
 * Mood — медленный модификатор поверх idle. Влияет мягко: румянец,
 * приподнятые брови и т.п. Может сочетаться с любым state.
 */
const MOODS = {
  happy: { blush: 0.4, brow: 'up' },
  neutral: {},
  concerned: { brow: 'down' },
  excited: { blush: 0.6, brow: 'up' },
  sleepy: { zzz: true, eyesClosed: true },
};

// ---------- Универсальный «слой» ----------
/** Абсолютно позиционированный слой поверх canvas. */
const Layer = ({ children, opacity = 1, animatedStyle }) => (
  <Animated.View
    style={[StyleSheet.absoluteFill, { opacity }, animatedStyle]}
    pointerEvents="none"
  >
    {children}
  </Animated.View>
);

/**
 * RotatingGroup — оборачивает содержимое, вращая его вокруг заданной pivot-точки
 * в координатах canvas (400×520). Использует паттерн pre/post translate.
 */
function RotatingGroup({ pivot, rotation, children }) {
  const halfW = MASCOT_CANVAS.width / 2;
  const halfH = MASCOT_CANVAS.height / 2;
  const offX = pivot.x - halfW;
  const offY = pivot.y - halfH;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offX },
      { translateY: offY },
      { rotate: `${rotation.value}deg` },
      { translateX: -offX },
      { translateY: -offY },
    ],
  }));
  return <Layer animatedStyle={style}>{children}</Layer>;
}

/** Простая обёртка с translateY/translateX/scale/opacity анимациями. */
function AnimatedTransformLayer({ tx, ty, scale, opacity, children }) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity ? opacity.value : 1,
    transform: [
      { translateX: tx ? tx.value : 0 },
      { translateY: ty ? ty.value : 0 },
      { scale: scale ? scale.value : 1 },
    ],
  }));
  return <Layer animatedStyle={style}>{children}</Layer>;
}

// ---------- Выбор частей по имени (для рта и бровей) ----------
const MOUTHS = {
  closed: P.MouthClosed,
  smile_small: P.MouthSmileSmall,
  smile_big: P.MouthSmileBig,
  open: P.MouthOpen,
  sad: P.MouthSad,
  o: P.MouthO,
};

const BROWS_L = { neutral: P.BrowLNeutral, up: P.BrowLUp, down: P.BrowLDown };
const BROWS_R = { neutral: P.BrowRNeutral, up: P.BrowRUp, down: P.BrowRDown };

// ---------- Talk-цикл (кадры рта, чередующиеся при isTalking) ----------
const TALK_MOUTHS = ['closed', 'open', 'smile_small', 'o'];
const TALK_FRAME_MS = 130;

// ---------- Sparkle частицы (позиции внутри face canvas) ----------
const SPARKLE_POSITIONS = [
  { dx: -80, dy: -140, size: 0.4, delay: 0 },
  { dx: 90, dy: -160, size: 0.5, delay: 120 },
  { dx: -110, dy: 60, size: 0.35, delay: 240 },
  { dx: 120, dy: 50, size: 0.45, delay: 360 },
  { dx: 0, dy: -190, size: 0.6, delay: 60 },
];

// ---------- Основной компонент ----------
export default function BearRig({
  size = 240,
  state = 'idle',
  mood = 'neutral',
  isTalking = false,
  onAnimationEnd,
}) {
  const scale = size / MASCOT_CANVAS.width;
  const height = MASCOT_CANVAS.height * scale;

  // Разрешаем итоговый набор частей (state ⊕ mood).
  const stateCfg = STATES[state] || STATES.idle;
  const moodCfg = MOODS[mood] || {};

  const mouthKey = stateCfg.mouth || moodCfg.mouth || 'closed';
  const browKey = stateCfg.brow || moodCfg.brow || 'neutral';
  const blushLevel =
    stateCfg.blush != null ? stateCfg.blush : moodCfg.blush || 0;
  const showTear = !!stateCfg.tear;
  const showSparkles = !!stateCfg.sparkles;
  const showStarEyes = !!stateCfg.starEyes;
  const showQuestion = !!stateCfg.questionMark;
  const showZzz = !!(stateCfg.zzz || moodCfg.zzz);
  const showHearts = !!stateCfg.hearts;
  const eyesClosed = !!moodCfg.eyesClosed;

  // ---------- Reanimated shared values ----------
  // Idle:
  const breathScale = useSharedValue(1);
  const blinkScaleY = useSharedValue(1); // 1 — глаза открыты, 0 — закрыты
  const pupilX = useSharedValue(0);
  const pupilY = useSharedValue(0);

  // Head / body one-shots:
  const headRotation = useSharedValue(0);
  const bodyTranslateY = useSharedValue(0);
  const armLRotation = useSharedValue(0);
  const armRRotation = useSharedValue(0);

  // Overlays:
  const tearOpacity = useSharedValue(0);
  const tearY = useSharedValue(0);
  const sparklesOpacity = useSharedValue(0);
  const questionOpacity = useSharedValue(0);
  const zzzOpacity = useSharedValue(0);
  const heartsOpacity = useSharedValue(0);
  const blushOpacity = useSharedValue(0);
  const starEyesOpacity = useSharedValue(0);

  // Live talking mouth (перебивает mouthKey при isTalking).
  const [talkMouth, setTalkMouth] = React.useState(null);
  const talkTimer = useRef(null);

  // ---------- Idle: дыхание + моргание + look-around ----------
  useEffect(() => {
    // Плавное «дыхание» тела (медленный scale ±1%).
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1800 }),
        withTiming(1, { duration: 1800 })
      ),
      -1
    );

    // Случайные моргания каждые 3–6 сек.
    let blinkTimeout;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 3000;
      blinkTimeout = setTimeout(() => {
        blinkScaleY.value = withSequence(
          withTiming(0, { duration: 80 }),
          withTiming(1, { duration: 100 })
        );
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();

    // Случайный look-around каждые 8–15 сек.
    let lookTimeout;
    const scheduleLook = () => {
      const delay = 8000 + Math.random() * 7000;
      lookTimeout = setTimeout(() => {
        const dx = (Math.random() - 0.5) * 6;
        const dy = (Math.random() - 0.5) * 4;
        pupilX.value = withSequence(
          withTiming(dx, { duration: 400 }),
          withDelay(700, withTiming(0, { duration: 400 }))
        );
        pupilY.value = withSequence(
          withTiming(dy, { duration: 400 }),
          withDelay(700, withTiming(0, { duration: 400 }))
        );
        scheduleLook();
      }, delay);
    };
    scheduleLook();

    return () => {
      cancelAnimation(breathScale);
      cancelAnimation(blinkScaleY);
      cancelAnimation(pupilX);
      cancelAnimation(pupilY);
      clearTimeout(blinkTimeout);
      clearTimeout(lookTimeout);
    };
    // Один раз при монтировании — idle-фон должен пережить смены state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Idle-цикл look-around (принудительный) ----------
  useEffect(() => {
    if (!stateCfg.lookAround) return;
    pupilX.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 500 }),
        withTiming(8, { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      2,
      false
    );
  }, [stateCfg.lookAround]);

  // ---------- One-shot реакции на смену state ----------
  useEffect(() => {
    const notify = () => {
      if (onAnimationEnd) runOnJS(onAnimationEnd)();
    };
    switch (stateCfg.oneShot) {
      case 'nod':
        headRotation.value = withSequence(
          withTiming(8, { duration: 180 }),
          withTiming(-3, { duration: 220 }),
          withTiming(0, { duration: 220 }, () => notify())
        );
        break;

      case 'jump':
        bodyTranslateY.value = withSequence(
          withTiming(-30, { duration: 220 }),
          withTiming(0, { duration: 260 }, () => notify())
        );
        headRotation.value = withSequence(
          withTiming(-4, { duration: 200 }),
          withTiming(0, { duration: 280 })
        );
        break;

      case 'head_tilt_left':
        headRotation.value = withSequence(
          withTiming(-12, { duration: 320 }),
          withDelay(600, withTiming(0, { duration: 320 }, () => notify()))
        );
        break;

      case 'slump':
        headRotation.value = withSequence(
          withTiming(-15, { duration: 400 }),
          withDelay(1200, withTiming(0, { duration: 500 }, () => notify()))
        );
        bodyTranslateY.value = withSequence(
          withTiming(6, { duration: 400 }),
          withDelay(1200, withTiming(0, { duration: 500 }))
        );
        break;

      case 'celebrate':
        headRotation.value = withRepeat(
          withSequence(
            withTiming(-6, { duration: 180 }),
            withTiming(6, { duration: 180 })
          ),
          4,
          true
        );
        bodyTranslateY.value = withSequence(
          withTiming(-20, { duration: 200 }),
          withTiming(0, { duration: 200 }),
          withTiming(-15, { duration: 200 }),
          withTiming(0, { duration: 200 }, () => notify())
        );
        // Обе руки взметаются В СТОРОНЫ вверх (не за голову).
        // Для опущенных рук: L → +110°, R → −110°.
        armLRotation.value = withSequence(
          withTiming(110, { duration: 260 }),
          withDelay(500, withTiming(0, { duration: 320 }))
        );
        armRRotation.value = withSequence(
          withTiming(-110, { duration: 260 }),
          withDelay(500, withTiming(0, { duration: 320 }))
        );
        break;

      case 'wave':
        // Левая рука уходит наружу-вверх (95–115°) и покачивается там.
        armLRotation.value = withSequence(
          withTiming(95, { duration: 220 }),
          withRepeat(
            withSequence(
              withTiming(115, { duration: 240 }),
              withTiming(100, { duration: 240 })
            ),
            3,
            true
          ),
          withTiming(0, { duration: 300 }, () => notify())
        );
        break;

      default:
        // Плавный возврат в нейтраль.
        headRotation.value = withTiming(0, { duration: 220 });
        bodyTranslateY.value = withTiming(0, { duration: 220 });
        armLRotation.value = withTiming(0, { duration: 220 });
        armRRotation.value = withTiming(0, { duration: 220 });
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ---------- Оверлеи (fade in/out по флагам) ----------
  useEffect(() => {
    tearOpacity.value = withTiming(showTear ? 1 : 0, { duration: 300 });
    if (showTear) {
      tearY.value = 0;
      tearY.value = withRepeat(
        withSequence(
          withTiming(30, { duration: 1400 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(tearY);
      tearY.value = 0;
    }
  }, [showTear]);

  useEffect(() => {
    if (showSparkles) {
      sparklesOpacity.value = withSequence(
        withTiming(1, { duration: 220 }),
        withDelay(1600, withTiming(0, { duration: 500 }))
      );
    } else {
      sparklesOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [showSparkles]);

  useEffect(() => {
    questionOpacity.value = withTiming(showQuestion ? 1 : 0, { duration: 250 });
  }, [showQuestion]);

  useEffect(() => {
    if (showZzz) {
      zzzOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0.3, { duration: 900 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(zzzOpacity);
      zzzOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [showZzz]);

  useEffect(() => {
    if (showHearts) {
      heartsOpacity.value = withSequence(
        withTiming(1, { duration: 220 }),
        withDelay(1400, withTiming(0, { duration: 400 }))
      );
    } else {
      heartsOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [showHearts]);

  useEffect(() => {
    blushOpacity.value = withTiming(blushLevel, { duration: 300 });
  }, [blushLevel]);

  useEffect(() => {
    starEyesOpacity.value = withTiming(showStarEyes ? 1 : 0, { duration: 220 });
  }, [showStarEyes]);

  // ---------- Talking mouth (циклическая смена кадров) ----------
  useEffect(() => {
    if (!isTalking) {
      clearInterval(talkTimer.current);
      talkTimer.current = null;
      setTalkMouth(null);
      return;
    }
    let i = 0;
    setTalkMouth(TALK_MOUTHS[0]);
    talkTimer.current = setInterval(() => {
      i = (i + 1) % TALK_MOUTHS.length;
      setTalkMouth(TALK_MOUTHS[i]);
    }, TALK_FRAME_MS);
    return () => clearInterval(talkTimer.current);
  }, [isTalking]);

  // ---------- Собранные анимированные стили ----------
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyTranslateY.value },
      { scaleY: breathScale.value },
    ],
  }));

  // Открытость глаз: 1 — открыты, 0 — закрыты. Управляет прозрачностью
  // всей связки «белок + зрачок» (простой и читаемый blink).
  const eyeOpennessStyle = useAnimatedStyle(() => ({
    opacity: eyesClosed ? 0 : blinkScaleY.value,
  }));
  // Зрачок ещё и двигается (look-around) — комбинированный стиль.
  const pupilStyle = useAnimatedStyle(() => ({
    opacity: eyesClosed ? 0 : blinkScaleY.value,
    transform: [{ translateX: pupilX.value }, { translateY: pupilY.value }],
  }));

  // Выбор текущих спрайтов рта и бровей.
  const MouthComp = MOUTHS[talkMouth || mouthKey] || MOUTHS.closed;
  const BrowLComp = BROWS_L[browKey] || BROWS_L.neutral;
  const BrowRComp = BROWS_R[browKey] || BROWS_R.neutral;

  // ---------- Рендер ----------
  return (
    <View
      style={{
        width: size,
        height,
        overflow: 'visible',
      }}
      pointerEvents="none"
    >
      {/* Внутренний canvas 400×520 (native), масштабируется до size. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: MASCOT_CANVAS.width,
          height: MASCOT_CANVAS.height,
          transform: [
            { translateX: -MASCOT_CANVAS.width * (1 - scale) / 2 },
            { translateY: -MASCOT_CANVAS.height * (1 - scale) / 2 },
            { scale },
          ],
        }}
      >
        {/* --- Тело + дыхание --- */}
        <Layer animatedStyle={bodyStyle}>
          <P.BodyPart />
        </Layer>

        {/* --- Руки --- */}
        <RotatingGroup pivot={PIVOTS.shoulderL} rotation={armLRotation}>
          <P.ArmLPart />
        </RotatingGroup>
        <RotatingGroup pivot={PIVOTS.shoulderR} rotation={armRRotation}>
          <P.ArmRPart />
        </RotatingGroup>

        {/* --- Головная группа с pivot у шеи --- */}
        <RotatingGroup pivot={PIVOTS.head} rotation={headRotation}>
          {/* Уши (за головой) */}
          <Layer>
            <P.EarLeftPart />
          </Layer>
          <Layer>
            <P.EarRightPart />
          </Layer>
          {/* База головы + мордочка */}
          <Layer>
            <P.HeadBasePart />
          </Layer>

          {/* Глаза: белки (моргают через opacity) → зрачки (двигаются) */}
          <Layer animatedStyle={eyeOpennessStyle}>
            <P.EyeWhiteLPart />
          </Layer>
          <Layer animatedStyle={eyeOpennessStyle}>
            <P.EyeWhiteRPart />
          </Layer>
          <Layer animatedStyle={pupilStyle}>
            <P.PupilLPart />
          </Layer>
          <Layer animatedStyle={pupilStyle}>
            <P.PupilRPart />
          </Layer>

          {/* В текущем стиле (глаза с чёрной обводкой) отдельные веки-линии
              не рисуются — контур глаза даёт сама обводка. Компоненты
              EyelidUpperL/RPart оставлены пустыми в parts.js. */}

          {/* Звёздные глаза (Perfect_Lesson): StarEyePart нарисована в
              центре (около x=200), сдвигаем к позициям левого/правого глаза
              (cx≈160 и cx≈240 в face canvas 400×400). */}
          <AnimatedTransformLayer opacity={starEyesOpacity}>
            <View style={{ position: 'absolute', left: -40, top: 0, right: 0, bottom: 0 }}>
              <P.StarEyePart />
            </View>
          </AnimatedTransformLayer>
          <AnimatedTransformLayer opacity={starEyesOpacity}>
            <View style={{ position: 'absolute', left: 40, top: 0, right: 0, bottom: 0 }}>
              <P.StarEyePart />
            </View>
          </AnimatedTransformLayer>

          {/* Брови */}
          <Layer>
            <BrowLComp />
          </Layer>
          <Layer>
            <BrowRComp />
          </Layer>

          {/* Нос + рот */}
          <Layer>
            <P.NosePart />
          </Layer>
          <Layer>
            <MouthComp />
          </Layer>

          {/* Румянец */}
          <AnimatedTransformLayer opacity={blushOpacity}>
            <P.BlushPart />
          </AnimatedTransformLayer>

          {/* Слеза */}
          <AnimatedTransformLayer opacity={tearOpacity} ty={tearY}>
            <P.TearPart />
          </AnimatedTransformLayer>
        </RotatingGroup>

        {/* Оверлеи над головой (не зависят от вращения) */}
        {SPARKLE_POSITIONS.map((sp, i) => (
          <SparkleParticle
            key={i}
            opacity={sparklesOpacity}
            dx={sp.dx}
            dy={sp.dy}
            size={sp.size}
            delay={sp.delay}
          />
        ))}
        <AnimatedTransformLayer opacity={questionOpacity}>
          <View style={{ position: 'absolute', left: 0, top: -80, right: 0, bottom: 0 }}>
            <P.QuestionMarkPart />
          </View>
        </AnimatedTransformLayer>
        <AnimatedTransformLayer opacity={zzzOpacity}>
          <View style={{ position: 'absolute', left: 60, top: -80, right: 0, bottom: 0 }}>
            <P.ZzzPart />
          </View>
        </AnimatedTransformLayer>
        <AnimatedTransformLayer opacity={heartsOpacity}>
          <View style={{ position: 'absolute', left: 0, top: -60, right: 0, bottom: 0 }}>
            <P.HeartPart />
          </View>
        </AnimatedTransformLayer>
      </View>
    </View>
  );
}

/** Одна частица-звёздочка с собственной пульсацией. */
function SparkleParticle({ opacity, dx, dy, size, delay }) {
  const scaleV = useSharedValue(0);
  useEffect(() => {
    scaleV.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(size, { duration: 400 }),
          withTiming(size * 0.6, { duration: 400 })
        ),
        -1,
        true
      )
    );
    return () => cancelAnimation(scaleV);
  }, [delay, size]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: dx },
      { translateY: dy },
      { scale: scaleV.value },
    ],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <P.SparklePart />
    </Animated.View>
  );
}

export { STATES, MOODS };

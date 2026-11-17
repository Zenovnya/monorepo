import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { MASCOT_ASSETS } from './mascotAssets';

/**
 * 5 канонических эмоций проектного маскота LexBear (юрист-медведь в тройке со значком РФ):
 *  1. 'neutral'  — Нейтральная / Приветственная (главный экран, старт урока, онбординг)
 *  2. 'happy'    — Радостная / Хвалящая (верный ответ, успешное решение кейса, победа)
 *  3. 'thinking' — Задумчивая / Анализирующая (разбор сложных ситуаций, загрузка контента)
 *  4. 'sad'      — Грустная / Сочувствующая (ошибка в кейсе/уроке — тёплое сопереживание)
 *  5. 'strict'   — Строгая / Серьёзная (цитирование кодексов РФ и важные правовые предупреждения)
 */
export const MASCOT_EMOTIONS = [
  {
    key: 'neutral',
    title: 'Нейтральная / Приветственная',
    short: 'Приветствие',
    description: 'Базовое живое состояние на главном экране и в начале урока: мягкое дыхание, дружелюбный взмах лапой с инерцией кисти, естественное моргание и живой взгляд.',
  },
  {
    key: 'happy',
    title: 'Радостная / Хвалящая',
    short: 'Радость',
    description: 'Верный ответ или решённый кейс: пружинистые прыжки со squash & stretch, обе лапы вверху, приподнятые ушки, сияющие глаза с улыбкой, румянец и открытая улыбка.',
  },
  {
    key: 'thinking',
    title: 'Задумчивая / Анализирующая',
    short: 'Раздумье',
    description: 'Разбор сложной правовой ситуации или загрузка: лапа задумчиво постукивает по подбородку, наклон головы, асимметричные брови, бегающий вверх взгляд.',
  },
  {
    key: 'sad',
    title: 'Грустная / Сочувствующая',
    short: 'Сочувствие',
    description: 'Ошибка в интерактивном кейсе: мишка не ругает, а тепло сопереживает — опущенные лапы и ушки, мягкий вздох, влажный блеск в глазах и домиком сведённые брови.',
  },
  {
    key: 'strict',
    title: 'Строгая / Серьёзная',
    short: 'Юрист',
    description: 'Цитирование кодексов РФ и важные правовые предупреждения: прямая выправка адвоката, поднятый указательный палец, сдвинутые брови, сосредоточенный взгляд и блик на значке.',
  },
];

/**
 * Нормализация любых пропсов экранов LexBear в одну из 5 канонических эмоций.
 */
export function resolveMascotEmotion({
  emotion,
  mood,
  celebrate,
  perfect,
  levelUp,
  error,
  networkError,
  thinking,
  strict,
}) {
  const raw = String(emotion || mood || '').toLowerCase().trim();

  if (strict || ['strict', 'serious', 'stern', 'law', 'warning', 'code'].includes(raw)) {
    return 'strict';
  }
  if (error || networkError || ['sad', 'empathy', 'sorry', 'upset', 'hurt'].includes(raw)) {
    return 'sad';
  }
  if (thinking || ['thinking', 'think', 'analyze', 'analyzing', 'loading', 'ponder'].includes(raw)) {
    return 'thinking';
  }
  if (
    perfect ||
    celebrate ||
    levelUp ||
    ['happy', 'cheer', 'praise', 'excited', 'joy', 'celebrate', 'win'].includes(raw)
  ) {
    return 'happy';
  }
  return 'neutral';
}

/* ============================================================================
 * ТОЧНАЯ ГЕОМЕТРИЯ СКЕЛЕТНОГО РИГА (700 × 960, субпиксельная разметка по bear.png)
 * ========================================================================== */
const RIG_W = 700;
const RIG_H = 960;
const HALF_W = RIG_W / 2;
const HALF_H = RIG_H / 2;

const JOINTS = {
  feet: { x: 401, y: 893 },
  hip: { x: 401, y: 703 },
  neck: { x: 405, y: 449 },
  shoulderR: { x: 271, y: 499 },
  shoulderRDown: { x: 269, y: 507 },
  shoulderL: { x: 531, y: 507 },
};

const PARTS = {
  legs: { x: 241, y: 678, w: 317, h: 240, px: 160, py: 215 },
  torso: { x: 232, y: 417, w: 329, h: 320, px: 169, py: 286 },
  headBase: { x: 174, y: 74, w: 469, h: 417, px: 231, py: 375 },
  earLeft: { x: 191, y: 34, w: 156, h: 155, px: 92, py: 95 },
  earRight: { x: 495, y: 63, w: 159, h: 157, px: 62, py: 88 },
  browLeft: { x: 283, y: 207, w: 82, h: 45, px: 42, py: 22 },
  browRight: { x: 463, y: 220, w: 81, h: 46, px: 40, py: 23 },
  nose: { x: 363, y: 326, w: 84, h: 57, px: 42, py: 27 },
  mouthNeutral: { x: 351, y: 368, w: 107, h: 51, px: 52, py: 23 },
  mouthHappy: { x: 347, y: 367, w: 112, h: 60, px: 56, py: 24 },
  mouthThink: { x: 370, y: 367, w: 66, h: 41, px: 33, py: 24 },
  mouthSad: { x: 364, y: 367, w: 78, h: 49, px: 39, py: 24 },
  mouthStrict: { x: 361, y: 367, w: 85, h: 48, px: 42, py: 24 },
  mouthTalk: { x: 354, y: 367, w: 98, h: 58, px: 49, py: 24 },
  eyeIris: { w: 58, h: 74 },
  eyeLeft: {
    x: 285,
    y: 260,
    w: 72,
    h: 84,
    rot: 5.0,
    irisX: 12.5 - 3,
    irisY: 8.0 - 3,
    c1: { x: 17.5, y: 10.5, w: 17.5, h: 19.0 },
    c2: { x: 34.0, y: 42.0, w: 6.8, h: 6.8 },
  },
  eyeRight: {
    x: 463,
    y: 273,
    w: 72,
    h: 84,
    rot: -4.5,
    irisX: 2.5 - 3,
    irisY: 8.0 - 3,
    c1: { x: 15.0, y: 10.5, w: 17.5, h: 19.0 },
    c2: { x: 31.5, y: 42.0, w: 6.8, h: 6.8 },
  },
  sleeveRight: { x: 90, y: 368, w: 233, h: 196, px: 181, py: 131 },
  pawRight: { x: 38, y: 306, w: 134, h: 141, px: 97, py: 103 },
  sleeveLeft: { x: 483, y: 452, w: 162, h: 232, px: 48, py: 55 },
  pawLeft: { x: 546, y: 640, w: 103, h: 114, px: 55, py: 23 },
  sleeveRightDown: { x: 162, y: 452, w: 162, h: 232, px: 107, py: 55 },
  pawRightDown: { x: 158, y: 640, w: 103, h: 114, px: 41, py: 23 },
  armRightThink: { x: 204, y: 405, w: 183, h: 211, px: 67, py: 94 },
  armRightStrict: { x: 86, y: 321, w: 211, h: 271, px: 185, py: 178 },
};

const SPRING_SOFT = { damping: 14, stiffness: 120, mass: 0.9 };
const SPRING_SNAPPY = { damping: 12, stiffness: 170, mass: 0.8 };
const SIN_IO = Easing.inOut(Easing.sin);
const QUAD_OUT = Easing.out(Easing.quad);
const QUAD_IN = Easing.in(Easing.quad);
const CUBIC_OUT = Easing.out(Easing.cubic);

/**
 * Скелетно-анимированный маскот LexBear на React Native Reanimated.
 * Сохраняет 100% совместимость со всеми пропами экранов LexBear.
 */
export function AnimatedMascot({
  size = 112,
  emotion,
  mood,
  talking = false,
  wave = false,
  celebrate = false,
  perfect = false,
  error = false,
  networkError = false,
  levelUp = false,
  thinking = false,
  strict = false,
  blinkTrigger = 0,
  style,
}) {
  const activeEmotion = resolveMascotEmotion({
    emotion,
    mood,
    celebrate,
    perfect,
    levelUp,
    error,
    networkError,
    thinking,
    strict,
  });

  const isIntenseHappy = Boolean(perfect || celebrate || levelUp || emotion === 'cheer');
  const isLivelyWave = Boolean(wave || emotion === 'wave');

  // Коэффициент масштабирования рига 700×960 под переданный size
  const s = size / 935;
  const stageW = RIG_W * s;
  const stageH = RIG_H * s;

  /* ---------------- Shared Values: Скелет и Дыхание ---------------- */
  const breath = useSharedValue(0);         // 0..1 непрерывный цикл дыхания
  const jumpY = useSharedValue(0);          // прыжок всего тела (в риг-пикселях)
  const squashX = useSharedValue(1);        // squash & stretch по X
  const squashY = useSharedValue(1);        // squash & stretch по Y
  const postureY = useSharedValue(0);       // посадка корпуса (выше у юриста, ниже в грусти)
  const torsoDeg = useSharedValue(0);       // наклон корпуса от таза
  const headDeg = useSharedValue(0);        // поворот/наклон головы в шее
  const headNodY = useSharedValue(0);       // вторичное покачивание / кивок головы

  /* ---------------- Shared Values: Уши и Лапы ---------------- */
  const earLDeg = useSharedValue(0);        // базовый угол левого уха
  const earRDeg = useSharedValue(0);        // базовый угол правого уха
  const earLTwitch = useSharedValue(0);     // живое подёргивание левого уха
  const earRTwitch = useSharedValue(0);     // живое подёргивание правого уха

  const armRDeg = useSharedValue(0);        // плечо приветственной/радостной правой лапы
  const pawRDeg = useSharedValue(0);        // кисть правой лапы (follow-through с запаздыванием!)
  const armLDeg = useSharedValue(0);        // плечо левой лапы
  const pawLDeg = useSharedValue(0);        // кисть левой лапы
  const armRDownDeg = useSharedValue(0);    // опущенная правая лапа (сочувствие)
  const pawRDownDeg = useSharedValue(0);    // кисть опущенной правой лапы
  const armThinkDeg = useSharedValue(0);    // согнутая лапа у подбородка (раздумье)
  const armThinkY = useSharedValue(0);      // лёгкое постукивание пальцем по подбородку
  const armStrictDeg = useSharedValue(0);   // поднятый указательный палец юриста (строгость)

  // Плавная смена вариантов правой лапы
  const showWaveArm = useSharedValue(1);
  const showDownArm = useSharedValue(0);
  const showThinkArm = useSharedValue(0);
  const showStrictArm = useSharedValue(0);

  /* ---------------- Shared Values: 2.5D Мимика и Глаза ---------------- */
  const faceX = useSharedValue(0);          // 2.5D параллакс лица по X
  const faceY = useSharedValue(0);          // 2.5D параллакс лица по Y
  const blink = useSharedValue(0);          // 0 = открыты, 1 = полностью сомкнуты веки
  const pupilX = useSharedValue(0);         // живое движение зрачков по X
  const pupilY = useSharedValue(0);         // живое движение зрачков по Y
  const pupilScale = useSharedValue(1);     // расширение/фокусировка зрачков
  const catchScale = useSharedValue(1);     // мерцание главного блика в глазах
  const catch2Op = useSharedValue(0.2);     // второй влажный/радостный блик
  const tearOp = useSharedValue(0);         // сочувствующий влажный блеск нижнего века

  const upperLidL = useSharedValue(0);      // прикрытие левого верхнего века (0..1)
  const upperLidR = useSharedValue(0);      // прикрытие правого верхнего века (0..1)
  const upperLidLRot = useSharedValue(0);   // наклон левого века (домиком / строго)
  const upperLidRRot = useSharedValue(0);   // наклон правого века
  const lowerLid = useSharedValue(0);       // нижнее веко (улыбка глазами / прищур)

  const browLDx = useSharedValue(0);
  const browLDy = useSharedValue(0);
  const browLDeg = useSharedValue(0);
  const browRDx = useSharedValue(0);
  const browRDy = useSharedValue(0);
  const browRDeg = useSharedValue(0);

  const blushOp = useSharedValue(0);        // тёплый румянец на щеках
  const noseWiggle = useSharedValue(0);     // лёгкое живое движение носика
  const talkOpen = useSharedValue(0);       // артикуляция речи (0..1)

  /* ---------------- Shared Values: Деликатные эффекты эмоций ---------------- */
  const fxHappy = useSharedValue(0);        // искорки похвалы
  const fxThink = useSharedValue(0);        // пузырьки размышления
  const fxStrict = useSharedValue(0);       // параграф § и блик на триколоре
  const fxPulse = useSharedValue(0);        // общий фазовый цикл частиц 0..1

  /* ==========================================================================
   * 1. АВТОНОМНЫЕ ЦИКЛЫ «ЖИВОГО СУЩЕСТВА» (дыхание, моргание, ушки, частицы)
   * ======================================================================== */
  useEffect(() => {
    // Плавное естественное грудное дыхание (вдох 1.75с, выдох 1.75с)
    breath.value = withRepeat(
      withTiming(1, { duration: 1750, easing: SIN_IO }),
      -1,
      true
    );

    // Реалистичное моргание: одиночное -> пауза -> одиночное -> пауза -> живое двойное моргание!
    blink.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(1, { duration: 82, easing: QUAD_IN })),
        withTiming(1, { duration: 24 }),
        withTiming(0, { duration: 140, easing: CUBIC_OUT }),
        withDelay(3100, withTiming(1, { duration: 80, easing: QUAD_IN })),
        withTiming(0, { duration: 135, easing: CUBIC_OUT }),
        // Естественное двойное моргание
        withDelay(2800, withTiming(1, { duration: 75, easing: QUAD_IN })),
        withTiming(0.12, { duration: 95, easing: QUAD_OUT }),
        withTiming(1, { duration: 72, easing: QUAD_IN }),
        withTiming(0, { duration: 150, easing: CUBIC_OUT })
      ),
      -1,
      false
    );

    // Несинхронное мягкое подёргивание левого и правого ушек
    earLTwitch.value = withRepeat(
      withSequence(
        withDelay(3400, withTiming(5.2, { duration: 110, easing: QUAD_OUT })),
        withTiming(-1.8, { duration: 120, easing: SIN_IO }),
        withTiming(0, { duration: 220, easing: CUBIC_OUT })
      ),
      -1,
      false
    );
    earRTwitch.value = withRepeat(
      withSequence(
        withDelay(4900, withTiming(-4.8, { duration: 105, easing: QUAD_OUT })),
        withTiming(1.5, { duration: 115, easing: SIN_IO }),
        withTiming(0, { duration: 210, easing: CUBIC_OUT }),
        withDelay(1800, withTiming(-3.2, { duration: 95, easing: QUAD_OUT })),
        withTiming(0, { duration: 180, easing: CUBIC_OUT })
      ),
      -1,
      false
    );

    // Едва уловимое живое мерцание блика в глазах и движение носика
    catchScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1400, easing: SIN_IO }),
        withTiming(0.97, { duration: 1400, easing: SIN_IO })
      ),
      -1,
      true
    );
    noseWiggle.value = withRepeat(
      withSequence(
        withDelay(3800, withTiming(-1.4, { duration: 120, easing: QUAD_OUT })),
        withTiming(0.6, { duration: 110, easing: SIN_IO }),
        withTiming(0, { duration: 160, easing: CUBIC_OUT })
      ),
      -1,
      false
    );

    // Фазовый цикл фоновых микро-акцентов
    fxPulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(blink);
      cancelAnimation(earLTwitch);
      cancelAnimation(earRTwitch);
      cancelAnimation(catchScale);
      cancelAnimation(noseWiggle);
      cancelAnimation(fxPulse);
    };
  }, []);

  // Принудительное моргание по кнопке/тапу с автоматическим возвратом живого цикла
  useEffect(() => {
    if (!blinkTrigger) return;
    blink.value = withSequence(
      withTiming(1, { duration: 75, easing: QUAD_IN }),
      withTiming(1, { duration: 28 }),
      withTiming(0, { duration: 145, easing: CUBIC_OUT }),
      withRepeat(
        withSequence(
          withDelay(2400, withTiming(1, { duration: 82, easing: QUAD_IN })),
          withTiming(1, { duration: 24 }),
          withTiming(0, { duration: 140, easing: CUBIC_OUT }),
          withDelay(3100, withTiming(1, { duration: 80, easing: QUAD_IN })),
          withTiming(0, { duration: 135, easing: CUBIC_OUT }),
          withDelay(2800, withTiming(1, { duration: 75, easing: QUAD_IN })),
          withTiming(0.12, { duration: 95, easing: QUAD_OUT }),
          withTiming(1, { duration: 72, easing: QUAD_IN }),
          withTiming(0, { duration: 150, easing: CUBIC_OUT })
        ),
        -1,
        false
      )
    );
  }, [blinkTrigger]);

  /* ==========================================================================
   * 2. АРТИКУЛЯЦИЯ РЕЧИ (talking)
   * ======================================================================== */
  useEffect(() => {
    cancelAnimation(talkOpen);
    if (talking && activeEmotion !== 'sad') {
      // Живой немонотонный ритм слогов русской речи
      talkOpen.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 135, easing: QUAD_OUT }),
          withTiming(0.18, { duration: 110, easing: QUAD_IN }),
          withTiming(0.72, { duration: 120, easing: QUAD_OUT }),
          withTiming(0.0, { duration: 115, easing: QUAD_IN }),
          withTiming(1.0, { duration: 145, easing: QUAD_OUT }),
          withTiming(0.3, { duration: 95, easing: QUAD_IN }),
          withTiming(0.82, { duration: 125, easing: QUAD_OUT }),
          withTiming(0.0, { duration: 180, easing: CUBIC_OUT })
        ),
        -1,
        false
      );
    } else {
      talkOpen.value = withTiming(0, { duration: 140 });
    }
    return () => cancelAnimation(talkOpen);
  }, [talking, activeEmotion]);

  /* ==========================================================================
   * 3. ХОРЕОГРАФИЯ 5 ЭМОЦИЙ (сброс и плавный пружинный вход в новое состояние)
   * ======================================================================== */
  useEffect(() => {
    // Останавливаем активные петли прошлой эмоции перед плавным переходом
    [
      jumpY, squashX, squashY, postureY, torsoDeg, headDeg, headNodY,
      armRDeg, pawRDeg, armLDeg, pawLDeg, armRDownDeg, pawRDownDeg,
      armThinkDeg, armThinkY, armStrictDeg, pupilX, pupilY,
      browLDy, browRDy, faceX, faceY,
    ].forEach(cancelAnimation);

    // Переключение активной правой лапы (мягкий кроссфейд 160 мс)
    const armFade = { duration: 165, easing: QUAD_OUT };
    showWaveArm.value = withTiming(
      activeEmotion === 'neutral' || activeEmotion === 'happy' ? 1 : 0,
      armFade
    );
    showDownArm.value = withTiming(activeEmotion === 'sad' ? 1 : 0, armFade);
    showThinkArm.value = withTiming(activeEmotion === 'thinking' ? 1 : 0, armFade);
    showStrictArm.value = withTiming(activeEmotion === 'strict' ? 1 : 0, armFade);

    // Фоновые микро-акценты эмоций
    fxHappy.value = withTiming(activeEmotion === 'happy' ? 1 : 0, { duration: 240 });
    fxThink.value = withTiming(activeEmotion === 'thinking' ? 1 : 0, { duration: 260 });
    fxStrict.value = withTiming(activeEmotion === 'strict' ? 1 : 0, { duration: 240 });

    /* ----------------------------------------------------------------------
     * ЭМОЦИЯ 1: НЕЙТРАЛЬНАЯ / ПРИВЕТСТВЕННАЯ
     * -------------------------------------------------------------------- */
    if (activeEmotion === 'neutral') {
      jumpY.value = withSpring(0, SPRING_SOFT);
      squashX.value = withSpring(1, SPRING_SOFT);
      squashY.value = withSpring(1, SPRING_SOFT);
      postureY.value = withSpring(0, SPRING_SOFT);

      // Мягкое живое покачивание корпуса и головы
      torsoDeg.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 2100, easing: SIN_IO }),
          withTiming(-0.9, { duration: 2100, easing: SIN_IO })
        ),
        -1,
        true
      );
      headDeg.value = withRepeat(
        withSequence(
          withTiming(2.2, { duration: 2200, easing: SIN_IO }),
          withTiming(-1.8, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      headNodY.value = withDelay(
        200,
        withRepeat(withTiming(-2.2, { duration: 1750, easing: SIN_IO }), -1, true)
      );

      earLDeg.value = withSpring(0, SPRING_SOFT);
      earRDeg.value = withSpring(0, SPRING_SOFT);

      // Приветственный взмах правой лапой + запаздывающая гибкая кисть (follow-through!)
      const waveAmp = isLivelyWave ? 9.5 : 5.2;
      const waveDur = isLivelyWave ? 560 : 980;
      armRDeg.value = withRepeat(
        withSequence(
          withTiming(waveAmp, { duration: waveDur, easing: SIN_IO }),
          withTiming(-waveAmp * 0.45, { duration: waveDur, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawRDeg.value = withDelay(
        150,
        withRepeat(
          withSequence(
            withTiming(isLivelyWave ? 12.5 : 8.5, { duration: waveDur, easing: SIN_IO }),
            withTiming(isLivelyWave ? -9.5 : -5.5, { duration: waveDur, easing: SIN_IO })
          ),
          -1,
          true
        )
      );

      // Левая опущенная лапа мягко дышит вместе с корпусом
      armLDeg.value = withRepeat(
        withSequence(
          withTiming(-2.2, { duration: 1750, easing: SIN_IO }),
          withTiming(1.0, { duration: 1750, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawLDeg.value = withDelay(
        180,
        withRepeat(withTiming(-3.0, { duration: 1750, easing: SIN_IO }), -1, true)
      );

      // Живые саккады взгляда (смотрит на пользователя -> короткий мягкий взгляд в сторону -> обратно)
      pupilX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1800 }),
          withTiming(3.2, { duration: 190, easing: QUAD_OUT }),
          withTiming(3.0, { duration: 1250 }),
          withTiming(0, { duration: 180, easing: QUAD_OUT }),
          withTiming(0, { duration: 2100 }),
          withTiming(-3.0, { duration: 185, easing: QUAD_OUT }),
          withTiming(-2.8, { duration: 1100 }),
          withTiming(0, { duration: 185, easing: QUAD_OUT })
        ),
        -1,
        false
      );
      pupilY.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 3250 }),
          withTiming(-1.8, { duration: 220, easing: QUAD_OUT }),
          withTiming(-1.6, { duration: 1100 }),
          withTiming(0, { duration: 220, easing: QUAD_OUT }),
          withTiming(0, { duration: 2400 })
        ),
        -1,
        false
      );
      pupilScale.value = withSpring(1, SPRING_SOFT);
      catch2Op.value = withTiming(0.22, { duration: 250 });
      tearOp.value = withTiming(0, { duration: 200 });

      upperLidL.value = withTiming(0, { duration: 200 });
      upperLidR.value = withTiming(0, { duration: 200 });
      upperLidLRot.value = withTiming(0, { duration: 200 });
      upperLidRRot.value = withTiming(0, { duration: 200 });
      lowerLid.value = withTiming(0, { duration: 200 });

      // Приветственное лёгкое приподнимание бровей раз в несколько секунд
      browLDx.value = withSpring(0, SPRING_SOFT);
      browRDx.value = withSpring(0, SPRING_SOFT);
      browLDeg.value = withSpring(0, SPRING_SOFT);
      browRDeg.value = withSpring(0, SPRING_SOFT);
      browLDy.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2600 }),
          withTiming(-3.5, { duration: 220, easing: QUAD_OUT }),
          withTiming(-3.0, { duration: 420 }),
          withTiming(0, { duration: 300, easing: CUBIC_OUT })
        ),
        -1,
        false
      );
      browRDy.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2600 }),
          withTiming(-3.5, { duration: 220, easing: QUAD_OUT }),
          withTiming(-3.0, { duration: 420 }),
          withTiming(0, { duration: 300, easing: CUBIC_OUT })
        ),
        -1,
        false
      );

      blushOp.value = withTiming(0, { duration: 250 });
      faceX.value = withRepeat(
        withSequence(
          withTiming(1.8, { duration: 2200, easing: SIN_IO }),
          withTiming(-1.5, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      faceY.value = withSpring(0, SPRING_SOFT);
    }

    /* ----------------------------------------------------------------------
     * ЭМОЦИЯ 2: РАДОСТНАЯ / ХВАЛЯЩАЯ
     * -------------------------------------------------------------------- */
    if (activeEmotion === 'happy') {
      const hopH = isIntenseHappy ? -22 : -15;
      postureY.value = withSpring(-2, SPRING_SNAPPY);

      // Пружинистые прыжки радости с классическим Disney squash & stretch!
      jumpY.value = withRepeat(
        withSequence(
          withTiming(3, { duration: 120, easing: QUAD_IN }),       // подготовка (присед)
          withTiming(hopH, { duration: 270, easing: QUAD_OUT }),   // взлёт
          withTiming(0, { duration: 250, easing: QUAD_IN }),       // приземление
          withTiming(-6, { duration: 170, easing: QUAD_OUT }),     // малый отскок
          withTiming(0, { duration: 160, easing: QUAD_IN }),
          withTiming(0, { duration: 420 })                         // живая пауза с улыбкой
        ),
        -1,
        false
      );
      squashX.value = withRepeat(
        withSequence(
          withTiming(1.045, { duration: 120, easing: QUAD_IN }),
          withTiming(0.968, { duration: 270, easing: QUAD_OUT }),
          withTiming(1.038, { duration: 250, easing: QUAD_IN }),
          withTiming(0.99, { duration: 170, easing: QUAD_OUT }),
          withTiming(1.0, { duration: 160, easing: CUBIC_OUT }),
          withTiming(1.0, { duration: 420 })
        ),
        -1,
        false
      );
      squashY.value = withRepeat(
        withSequence(
          withTiming(0.955, { duration: 120, easing: QUAD_IN }),
          withTiming(1.036, { duration: 270, easing: QUAD_OUT }),
          withTiming(0.965, { duration: 250, easing: QUAD_IN }),
          withTiming(1.012, { duration: 170, easing: QUAD_OUT }),
          withTiming(1.0, { duration: 160, easing: CUBIC_OUT }),
          withTiming(1.0, { duration: 420 })
        ),
        -1,
        false
      );

      torsoDeg.value = withRepeat(
        withSequence(
          withTiming(-2.4, { duration: 460, easing: SIN_IO }),
          withTiming(2.4, { duration: 460, easing: SIN_IO })
        ),
        -1,
        true
      );
      headDeg.value = withRepeat(
        withSequence(
          withTiming(-5.2, { duration: 460, easing: SIN_IO }),
          withTiming(3.8, { duration: 460, easing: SIN_IO })
        ),
        -1,
        true
      );
      headNodY.value = withRepeat(
        withSequence(
          withTiming(-3.5, { duration: 350, easing: SIN_IO }),
          withTiming(1.0, { duration: 350, easing: SIN_IO })
        ),
        -1,
        true
      );

      // Бодро приподнятые ушки
      earLDeg.value = withRepeat(
        withSequence(
          withTiming(11, { duration: 340, easing: SIN_IO }),
          withTiming(5, { duration: 340, easing: SIN_IO })
        ),
        -1,
        true
      );
      earRDeg.value = withRepeat(
        withSequence(
          withTiming(-11, { duration: 340, easing: SIN_IO }),
          withTiming(-5, { duration: 340, easing: SIN_IO })
        ),
        -1,
        true
      );

      // Обе лапы радостно машут и поздравляют!
      armRDeg.value = withRepeat(
        withSequence(
          withTiming(16.5, { duration: 310, easing: SIN_IO }),
          withTiming(4.5, { duration: 310, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawRDeg.value = withDelay(
        90,
        withRepeat(
          withSequence(
            withTiming(11.5, { duration: 310, easing: SIN_IO }),
            withTiming(-7.5, { duration: 310, easing: SIN_IO })
          ),
          -1,
          true
        )
      );
      armLDeg.value = withRepeat(
        withSequence(
          withTiming(-21, { duration: 360, easing: SIN_IO }),
          withTiming(-10, { duration: 360, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawLDeg.value = withDelay(
        100,
        withRepeat(
          withSequence(
            withTiming(-9, { duration: 360, easing: SIN_IO }),
            withTiming(2, { duration: 360, easing: SIN_IO })
          ),
          -1,
          true
        )
      );

      // Сияющие расширенные зрачки + улыбка нижними веками + тёплый румянец
      pupilX.value = withSpring(0, SPRING_SNAPPY);
      pupilY.value = withSpring(-2.2, SPRING_SNAPPY);
      pupilScale.value = withSpring(1.06, SPRING_SNAPPY);
      catch2Op.value = withTiming(0.95, { duration: 200 });
      tearOp.value = withTiming(0, { duration: 160 });

      upperLidL.value = withTiming(0, { duration: 160 });
      upperLidR.value = withTiming(0, { duration: 160 });
      upperLidLRot.value = withTiming(0, { duration: 160 });
      upperLidRRot.value = withTiming(0, { duration: 160 });
      lowerLid.value = withTiming(0.22, { duration: 220, easing: QUAD_OUT });

      browLDx.value = withSpring(0, SPRING_SNAPPY);
      browRDx.value = withSpring(0, SPRING_SNAPPY);
      browLDy.value = withSpring(-9.5, SPRING_SNAPPY);
      browRDy.value = withSpring(-9.5, SPRING_SNAPPY);
      browLDeg.value = withSpring(-5, SPRING_SNAPPY);
      browRDeg.value = withSpring(5, SPRING_SNAPPY);

      blushOp.value = withTiming(0.42, { duration: 260 });
      faceX.value = withRepeat(
        withSequence(
          withTiming(-2.2, { duration: 460, easing: SIN_IO }),
          withTiming(2.2, { duration: 460, easing: SIN_IO })
        ),
        -1,
        true
      );
      faceY.value = withSpring(-3.2, SPRING_SNAPPY);
    }

    /* ----------------------------------------------------------------------
     * ЭМОЦИЯ 3: ЗАДУМЧИВАЯ / АНАЛИЗИРУЮЩАЯ
     * -------------------------------------------------------------------- */
    if (activeEmotion === 'thinking') {
      jumpY.value = withSpring(0, SPRING_SOFT);
      squashX.value = withSpring(1, SPRING_SOFT);
      squashY.value = withSpring(1, SPRING_SOFT);
      postureY.value = withSpring(1, SPRING_SOFT);

      torsoDeg.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 2400, easing: SIN_IO }),
          withTiming(0.5, { duration: 2400, easing: SIN_IO })
        ),
        -1,
        true
      );
      // Задумчивый наклон головы с лёгким аналитическим покачиванием
      headDeg.value = withRepeat(
        withSequence(
          withTiming(7.4, { duration: 2200, easing: SIN_IO }),
          withTiming(4.8, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      headNodY.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: 1600, easing: SIN_IO }),
          withTiming(-1.0, { duration: 1600, easing: SIN_IO })
        ),
        -1,
        true
      );

      // Асимметричные ушки («прислушивается к аргументам дела»)
      earLDeg.value = withSpring(6.5, SPRING_SOFT);
      earRDeg.value = withSpring(9.5, SPRING_SOFT);

      // Правая лапа у подбородка — живое двойное постукивание пальцем в раздумье!
      armThinkDeg.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1100 }),
          withTiming(2.4, { duration: 180, easing: QUAD_OUT }),
          withTiming(-0.4, { duration: 160, easing: QUAD_IN }),
          withTiming(2.1, { duration: 175, easing: QUAD_OUT }),
          withTiming(0, { duration: 240, easing: CUBIC_OUT }),
          withTiming(-0.8, { duration: 1200, easing: SIN_IO })
        ),
        -1,
        false
      );
      armThinkY.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1100 }),
          withTiming(-2.8, { duration: 180, easing: QUAD_OUT }),
          withTiming(0.5, { duration: 160, easing: QUAD_IN }),
          withTiming(-2.4, { duration: 175, easing: QUAD_OUT }),
          withTiming(0, { duration: 240, easing: CUBIC_OUT }),
          withTiming(0, { duration: 1200 })
        ),
        -1,
        false
      );

      armLDeg.value = withSpring(2, SPRING_SOFT);
      pawLDeg.value = withSpring(1.5, SPRING_SOFT);

      // Глаза подняты вверх-влево и периодически перебегают вверх-вправо (сверяет нормы кодекса!)
      pupilX.value = withRepeat(
        withSequence(
          withTiming(-6.5, { duration: 280, easing: QUAD_OUT }),
          withTiming(-6.2, { duration: 1700 }),
          withTiming(4.8, { duration: 240, easing: SIN_IO }),
          withTiming(4.5, { duration: 1250 }),
          withTiming(-3.5, { duration: 220, easing: SIN_IO }),
          withTiming(-3.5, { duration: 900 })
        ),
        -1,
        false
      );
      pupilY.value = withRepeat(
        withSequence(
          withTiming(-6.5, { duration: 280, easing: QUAD_OUT }),
          withTiming(-6.0, { duration: 1700 }),
          withTiming(-5.2, { duration: 240, easing: SIN_IO }),
          withTiming(-5.5, { duration: 1250 }),
          withTiming(-7.0, { duration: 220, easing: SIN_IO }),
          withTiming(-6.8, { duration: 900 })
        ),
        -1,
        false
      );
      pupilScale.value = withSpring(0.97, SPRING_SOFT);
      catch2Op.value = withTiming(0.25, { duration: 220 });
      tearOp.value = withTiming(0, { duration: 180 });

      // Лёгкий аналитический прищур одного глаза
      upperLidL.value = withTiming(0.04, { duration: 240 });
      upperLidR.value = withTiming(0.22, { duration: 240 });
      upperLidLRot.value = withTiming(0, { duration: 220 });
      upperLidRRot.value = withTiming(-5, { duration: 220 });
      lowerLid.value = withTiming(0.14, { duration: 240 });

      // Фирменная бровь Шерлока-юриста: левая высоко вверх, правая нахмурена
      browLDx.value = withSpring(0, SPRING_SOFT);
      browRDx.value = withSpring(-2, SPRING_SOFT);
      browLDeg.value = withSpring(-7, SPRING_SOFT);
      browRDeg.value = withSpring(-10, SPRING_SOFT);
      browLDy.value = withRepeat(
        withSequence(
          withTiming(-11.5, { duration: 1500, easing: SIN_IO }),
          withTiming(-8.5, { duration: 1500, easing: SIN_IO })
        ),
        -1,
        true
      );
      browRDy.value = withSpring(6, SPRING_SOFT);

      blushOp.value = withTiming(0, { duration: 220 });
      faceX.value = withSpring(3.0, SPRING_SOFT);
      faceY.value = withSpring(-2.2, SPRING_SOFT);
    }

    /* ----------------------------------------------------------------------
     * ЭМОЦИЯ 4: ГРУСТНАЯ / СОЧУВСТВУЮЩАЯ
     * -------------------------------------------------------------------- */
    if (activeEmotion === 'sad') {
      jumpY.value = withSpring(0, SPRING_SOFT);
      squashX.value = withSpring(1.01, SPRING_SOFT);
      squashY.value = withSpring(0.985, SPRING_SOFT);

      // Тёплый сочувствующий вздох (медленный подъём и мягкое опускание плеч)
      postureY.value = withRepeat(
        withSequence(
          withTiming(2.5, { duration: 1300, easing: SIN_IO }),
          withTiming(6.8, { duration: 2100, easing: CUBIC_OUT }),
          withTiming(6.2, { duration: 700 })
        ),
        -1,
        false
      );
      torsoDeg.value = withRepeat(
        withSequence(
          withTiming(-1.8, { duration: 2600, easing: SIN_IO }),
          withTiming(-0.4, { duration: 2600, easing: SIN_IO })
        ),
        -1,
        true
      );
      // Нежный наклон головы набок — не ругает, а поддерживает!
      headDeg.value = withRepeat(
        withSequence(
          withTiming(-7.2, { duration: 2500, easing: SIN_IO }),
          withTiming(-4.6, { duration: 2500, easing: SIN_IO })
        ),
        -1,
        true
      );
      headNodY.value = withRepeat(
        withSequence(
          withTiming(4.5, { duration: 2100, easing: SIN_IO }),
          withTiming(1.8, { duration: 2100, easing: SIN_IO })
        ),
        -1,
        true
      );

      // Мягко опущенные ушки
      earLDeg.value = withRepeat(
        withSequence(
          withTiming(-14.5, { duration: 2400, easing: SIN_IO }),
          withTiming(-11.0, { duration: 2400, easing: SIN_IO })
        ),
        -1,
        true
      );
      earRDeg.value = withRepeat(
        withSequence(
          withTiming(14.5, { duration: 2400, easing: SIN_IO }),
          withTiming(11.0, { duration: 2400, easing: SIN_IO })
        ),
        -1,
        true
      );

      // Обе лапы мягко и скромно опущены вдоль тела
      armRDownDeg.value = withRepeat(
        withSequence(
          withTiming(-6.5, { duration: 2200, easing: SIN_IO }),
          withTiming(-3.5, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawRDownDeg.value = withSpring(-5.5, SPRING_SOFT);
      armLDeg.value = withRepeat(
        withSequence(
          withTiming(6.5, { duration: 2200, easing: SIN_IO }),
          withTiming(3.5, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      pawLDeg.value = withSpring(5.5, SPRING_SOFT);

      // Большие сочувствующие глаза с влажным блеском: опускает взгляд и с теплом поднимает на игрока
      pupilX.value = withRepeat(
        withSequence(
          withTiming(-1.2, { duration: 2200, easing: SIN_IO }),
          withTiming(1.2, { duration: 2200, easing: SIN_IO })
        ),
        -1,
        true
      );
      pupilY.value = withRepeat(
        withSequence(
          withTiming(5.0, { duration: 2000, easing: SIN_IO }),
          withTiming(1.5, { duration: 1600, easing: SIN_IO }),
          withTiming(1.5, { duration: 900 })
        ),
        -1,
        false
      );
      pupilScale.value = withSpring(1.05, SPRING_SOFT);
      catch2Op.value = withTiming(0.92, { duration: 280 });
      tearOp.value = withTiming(0.9, { duration: 320 });

      // Мягко опущенные к внешним уголкам веки
      upperLidL.value = withTiming(0.22, { duration: 280 });
      upperLidR.value = withTiming(0.22, { duration: 280 });
      upperLidLRot.value = withTiming(-12, { duration: 280 });
      upperLidRRot.value = withTiming(12, { duration: 280 });
      lowerLid.value = withTiming(0, { duration: 220 });

      // Брови «домиком» (/ \) — чистое доброе сопереживание
      browLDx.value = withSpring(3.5, SPRING_SOFT);
      browRDx.value = withSpring(-3.5, SPRING_SOFT);
      browLDy.value = withSpring(-4, SPRING_SOFT);
      browRDy.value = withSpring(-4, SPRING_SOFT);
      browLDeg.value = withSpring(-15.5, SPRING_SOFT);
      browRDeg.value = withSpring(15.5, SPRING_SOFT);

      blushOp.value = withTiming(0.16, { duration: 300 });
      faceX.value = withSpring(-3.0, SPRING_SOFT);
      faceY.value = withSpring(4.2, SPRING_SOFT);
    }

    /* ----------------------------------------------------------------------
     * ЭМОЦИЯ 5: СТРОГАЯ / СЕРЬЁЗНАЯ (ЮРИСТ ЦИТИРУЕТ КОДЕКС РФ)
     * -------------------------------------------------------------------- */
    if (activeEmotion === 'strict') {
      jumpY.value = withSpring(0, SPRING_SNAPPY);
      squashX.value = withSpring(1.0, SPRING_SNAPPY);
      squashY.value = withSpring(1.016, SPRING_SNAPPY);
      // Прямая собранная выправка юриста
      postureY.value = withSpring(-3.5, SPRING_SNAPPY);
      torsoDeg.value = withSpring(0, SPRING_SNAPPY);

      // Ровно поставленная голова + весомый утвердительный кивок адвоката
      headDeg.value = withRepeat(
        withSequence(
          withTiming(-3.4, { duration: 2100 }),
          withTiming(-2.0, { duration: 260, easing: QUAD_OUT }),
          withTiming(-3.6, { duration: 340, easing: CUBIC_OUT }),
          withTiming(-3.4, { duration: 1400 })
        ),
        -1,
        false
      );
      headNodY.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2100 }),
          withTiming(3.8, { duration: 230, easing: QUAD_OUT }),
          withTiming(-0.6, { duration: 300, easing: CUBIC_OUT }),
          withTiming(0, { duration: 1470 })
        ),
        -1,
        false
      );

      // Собранные настороженные ушки
      earLDeg.value = withSpring(5, SPRING_SNAPPY);
      earRDeg.value = withSpring(-5, SPRING_SNAPPY);

      // Поднятый указательный палец юриста: сдержанный весомый акцент «Внимание на закон!»
      armStrictDeg.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1400 }),
          withTiming(3.8, { duration: 210, easing: QUAD_OUT }),
          withTiming(-1.2, { duration: 220, easing: QUAD_IN }),
          withTiming(2.2, { duration: 190, easing: QUAD_OUT }),
          withTiming(0, { duration: 320, easing: CUBIC_OUT }),
          withTiming(0, { duration: 1760 })
        ),
        -1,
        false
      );
      armLDeg.value = withSpring(-1.5, SPRING_SNAPPY);
      pawLDeg.value = withSpring(0, SPRING_SNAPPY);

      // Прямой, сфокусированный, уверенный взгляд юриста
      pupilX.value = withSpring(-1.2, SPRING_SNAPPY);
      pupilY.value = withSpring(0.8, SPRING_SNAPPY);
      pupilScale.value = withSpring(0.95, SPRING_SNAPPY);
      catch2Op.value = withTiming(0.15, { duration: 200 });
      tearOp.value = withTiming(0, { duration: 180 });

      // Серьёзно прикрытые верхние веки и строгий прищур
      upperLidL.value = withTiming(0.30, { duration: 220 });
      upperLidR.value = withTiming(0.30, { duration: 220 });
      upperLidLRot.value = withTiming(8, { duration: 220 });
      upperLidRRot.value = withTiming(-8, { duration: 220 });
      lowerLid.value = withTiming(0.08, { duration: 220 });

      // Строго сведённые к переносице брови (\ /)
      browLDx.value = withSpring(5.5, SPRING_SNAPPY);
      browRDx.value = withSpring(-5.5, SPRING_SNAPPY);
      browLDy.value = withSpring(10.5, SPRING_SNAPPY);
      browRDy.value = withSpring(10.5, SPRING_SNAPPY);
      browLDeg.value = withSpring(15, SPRING_SNAPPY);
      browRDeg.value = withSpring(-15, SPRING_SNAPPY);

      blushOp.value = withTiming(0, { duration: 180 });
      faceX.value = withSpring(0, SPRING_SNAPPY);
      faceY.value = withSpring(2.0, SPRING_SNAPPY);
    }
  }, [activeEmotion, isIntenseHappy, isLivelyWave]);

  /* ==========================================================================
   * 4. REANIMATED СТИЛИ КОСТЕЙ С ТОЧНЫМИ АНАТОМИЧЕСКИМИ ПИВОТАМИ
   * ======================================================================== */

  // Тень под ботинками (сжимается при прыжке, слегка дышит в покое)
  const shadowStyle = useAnimatedStyle(() => {
    const jumpFactor = interpolate(jumpY.value, [-24, 0, 4], [0.72, 1, 1.05]);
    const breathFactor = interpolate(breath.value, [0, 1], [1, 1.025]);
    const op = interpolate(jumpY.value, [-24, 0], [0.07, 0.14]);
    return {
      opacity: op,
      transform: [{ scaleX: jumpFactor * breathFactor }, { scaleY: jumpFactor }],
    };
  });

  // Общая группа тела (прыжок + squash & stretch от подошв ботинок)
  const feetOx = (JOINTS.feet.x - HALF_W) * s;
  const feetOy = (JOINTS.feet.y - HALF_H) * s;
  const bodyJumpStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: feetOx },
      { translateY: jumpY.value * s + feetOy },
      { scaleX: squashX.value },
      { scaleY: squashY.value },
      { translateX: -feetOx },
      { translateY: -feetOy },
    ],
  }));

  // Верхняя часть корпуса (дыхание грудной клетки + наклон от таза)
  const hipOx = (JOINTS.hip.x - HALF_W) * s;
  const hipOy = (JOINTS.hip.y - HALF_H) * s;
  const upperBodyStyle = useAnimatedStyle(() => {
    const bScaleY = interpolate(breath.value, [0, 1], [1, 1.016]);
    const bScaleX = interpolate(breath.value, [0, 1], [1, 1.009]);
    const bLiftY = interpolate(breath.value, [0, 1], [0, -2.4]);
    return {
      transform: [
        { translateX: hipOx },
        { translateY: (postureY.value + bLiftY) * s + hipOy },
        { rotate: `${torsoDeg.value}deg` },
        { scaleX: bScaleX },
        { scaleY: bScaleY },
        { translateX: -hipOx },
        { translateY: -hipOy },
      ],
    };
  });

  // Левая лапа (плечо + кисть)
  const shLOx = (JOINTS.shoulderL.x - HALF_W) * s;
  const shLOy = (JOINTS.shoulderL.y - HALF_H) * s;
  const leftArmStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shLOx },
      { translateY: shLOy },
      { rotate: `${armLDeg.value}deg` },
      { translateX: -shLOx },
      { translateY: -shLOy },
    ],
  }));

  const pawLOx = (PARTS.pawLeft.px - PARTS.pawLeft.w / 2) * s;
  const pawLOy = (PARTS.pawLeft.py - PARTS.pawLeft.h / 2) * s;
  const leftPawStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pawLOx },
      { translateY: pawLOy },
      { rotate: `${pawLDeg.value}deg` },
      { translateX: -pawLOx },
      { translateY: -pawLOy },
    ],
  }));

  // Правая приветственная/радостная лапа (плечо + гибкая кисть)
  const shROx = (JOINTS.shoulderR.x - HALF_W) * s;
  const shROy = (JOINTS.shoulderR.y - HALF_H) * s;
  const rightWaveArmStyle = useAnimatedStyle(() => ({
    opacity: showWaveArm.value,
    transform: [
      { translateX: shROx },
      { translateY: shROy },
      { rotate: `${armRDeg.value}deg` },
      { translateX: -shROx },
      { translateY: -shROy },
    ],
  }));

  const pawROx = (PARTS.pawRight.px - PARTS.pawRight.w / 2) * s;
  const pawROy = (PARTS.pawRight.py - PARTS.pawRight.h / 2) * s;
  const rightPawStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pawROx },
      { translateY: pawROy },
      { rotate: `${pawRDeg.value}deg` },
      { translateX: -pawROx },
      { translateY: -pawROy },
    ],
  }));

  // Правая опущенная лапа (для сочувствия)
  const shRDOx = (JOINTS.shoulderRDown.x - HALF_W) * s;
  const shRDOy = (JOINTS.shoulderRDown.y - HALF_H) * s;
  const rightDownArmStyle = useAnimatedStyle(() => ({
    opacity: showDownArm.value,
    transform: [
      { translateX: shRDOx },
      { translateY: shRDOy },
      { rotate: `${armRDownDeg.value}deg` },
      { translateX: -shRDOx },
      { translateY: -shRDOy },
    ],
  }));

  const pawRDOx = (PARTS.pawRightDown.px - PARTS.pawRightDown.w / 2) * s;
  const pawRDOy = (PARTS.pawRightDown.py - PARTS.pawRightDown.h / 2) * s;
  const rightDownPawStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pawRDOx },
      { translateY: pawRDOy },
      { rotate: `${pawRDownDeg.value}deg` },
      { translateX: -pawRDOx },
      { translateY: -pawRDOy },
    ],
  }));

  // Правая строгая лапа юриста (поднятый указательный палец)
  const strictOx = (PARTS.armRightStrict.px - PARTS.armRightStrict.w / 2) * s;
  const strictOy = (PARTS.armRightStrict.py - PARTS.armRightStrict.h / 2) * s;
  const rightStrictArmStyle = useAnimatedStyle(() => ({
    opacity: showStrictArm.value,
    transform: [
      { translateX: strictOx },
      { translateY: strictOy },
      { rotate: `${armStrictDeg.value}deg` },
      { translateX: -strictOx },
      { translateY: -strictOy },
    ],
  }));

  // Правая задумчивая лапа у подбородка (поверх лацкана)
  const thinkOx = (PARTS.armRightThink.px - PARTS.armRightThink.w / 2) * s;
  const thinkOy = (PARTS.armRightThink.py - PARTS.armRightThink.h / 2) * s;
  const rightThinkArmStyle = useAnimatedStyle(() => ({
    opacity: showThinkArm.value,
    transform: [
      { translateX: thinkOx },
      { translateY: armThinkY.value * s + thinkOy },
      { rotate: `${armThinkDeg.value}deg` },
      { translateX: -thinkOx },
      { translateY: -thinkOy },
    ],
  }));

  // Голова (пивот в шее) + лёгкий живой микро-кивок во время речи
  const neckOx = (JOINTS.neck.x - HALF_W) * s;
  const neckOy = (JOINTS.neck.y - HALF_H) * s;
  const headGroupStyle = useAnimatedStyle(() => {
    const talkNod = talkOpen.value * 1.1;
    return {
      transform: [
        { translateX: neckOx },
        { translateY: (headNodY.value + talkNod) * s + neckOy },
        { rotate: `${headDeg.value}deg` },
        { translateX: -neckOx },
        { translateY: -neckOy },
      ],
    };
  });

  // Левое и правое ушки
  const earLOx = (PARTS.earLeft.px - PARTS.earLeft.w / 2) * s;
  const earLOy = (PARTS.earLeft.py - PARTS.earLeft.h / 2) * s;
  const earLeftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: earLOx },
      { translateY: earLOy },
      { rotate: `${earLDeg.value + earLTwitch.value}deg` },
      { translateX: -earLOx },
      { translateY: -earLOy },
    ],
  }));

  const earROx = (PARTS.earRight.px - PARTS.earRight.w / 2) * s;
  const earROy = (PARTS.earRight.py - PARTS.earRight.h / 2) * s;
  const earRightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: earROx },
      { translateY: earROy },
      { rotate: `${earRDeg.value + earRTwitch.value}deg` },
      { translateX: -earROx },
      { translateY: -earROy },
    ],
  }));

  // 2.5D плоскость лица + дополнительный объём мордочки (эффект Live2D)
  const facePlaneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: faceX.value * s },
      { translateY: faceY.value * s },
    ],
  }));

  const muzzlePlaneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: faceX.value * 0.35 * s },
      { translateY: faceY.value * 0.35 * s },
    ],
  }));

  const noseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: noseWiggle.value * s }],
  }));

  // Зрачки и блики в глазах
  const pupilStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pupilX.value * s },
      { translateY: pupilY.value * s },
      { scale: pupilScale.value },
    ],
  }));

  const catch1Style = useAnimatedStyle(() => ({
    transform: [{ scale: catchScale.value }],
  }));

  const catch2Style = useAnimatedStyle(() => ({
    opacity: catch2Op.value,
  }));

  const tearStyle = useAnimatedStyle(() => ({
    opacity: tearOp.value,
  }));

  // Верхние и нижние меховые веки (реалистичное моргание + мимика)
  const sockInnerH = (PARTS.eyeLeft.h - 6) * s;
  const upperLidLeftStyle = useAnimatedStyle(() => {
    const cover = Math.max(blink.value, upperLidL.value);
    // При полном моргании выравниваем угол века, чтобы глаза закрывались естественно
    const rot = upperLidLRot.value * (1 - blink.value);
    const ty = (cover - 1) * (sockInnerH + 6 * s);
    return {
      opacity: cover > 0.01 ? 1 : 0,
      transform: [{ translateY: ty }, { rotate: `${rot}deg` }],
    };
  });

  const upperLidRightStyle = useAnimatedStyle(() => {
    const cover = Math.max(blink.value, upperLidR.value);
    const rot = upperLidRRot.value * (1 - blink.value);
    const ty = (cover - 1) * (sockInnerH + 6 * s);
    return {
      opacity: cover > 0.01 ? 1 : 0,
      transform: [{ translateY: ty }, { rotate: `${rot}deg` }],
    };
  });

  const lowerLidStyle = useAnimatedStyle(() => {
    const ty = (1 - lowerLid.value) * sockInnerH;
    return {
      opacity: lowerLid.value > 0.01 ? 1 : 0,
      transform: [{ translateY: ty }],
    };
  });

  // Брови
  const browLeftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: browLDx.value * s },
      { translateY: browLDy.value * s },
      { rotate: `${browLDeg.value}deg` },
    ],
  }));

  const browRightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: browRDx.value * s },
      { translateY: browRDy.value * s },
      { rotate: `${browRDeg.value}deg` },
    ],
  }));

  // Румянец
  const blushStyle = useAnimatedStyle(() => ({
    opacity: blushOp.value,
  }));

  // Рот + живая артикуляция речи
  const staticMouthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(talkOpen.value, [0, 0.35], [1, 0], 'clamp'),
  }));

  const talkMouthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(talkOpen.value, [0.15, 0.45], [0, 1], 'clamp'),
    transform: [
      { scaleY: interpolate(talkOpen.value, [0, 1], [0.65, 1.05]) },
      { scaleX: interpolate(talkOpen.value, [0, 1], [0.92, 1.02]) },
    ],
  }));

  // Деликатные эффекты эмоций (искорки радости, пузырьки мысли, знак § и блик значка РФ)
  const sparkle1Style = useAnimatedStyle(() => {
    const p = fxPulse.value;
    const wave1 = Math.sin(p * Math.PI * 2);
    return {
      opacity: fxHappy.value * (0.55 + 0.45 * Math.max(0, wave1)),
      transform: [
        { translateY: -wave1 * 6 * s },
        { scale: 0.78 + 0.32 * Math.max(0, wave1) },
      ],
    };
  });

  const sparkle2Style = useAnimatedStyle(() => {
    const p = (fxPulse.value + 0.45) % 1;
    const wave2 = Math.sin(p * Math.PI * 2);
    return {
      opacity: fxHappy.value * (0.5 + 0.5 * Math.max(0, wave2)),
      transform: [
        { translateY: -wave2 * 5 * s },
        { scale: 0.75 + 0.3 * Math.max(0, wave2) },
      ],
    };
  });

  const thoughtDot1Style = useAnimatedStyle(() => {
    const p = fxPulse.value;
    const op = Math.sin(Math.min(1, p * 2.2) * Math.PI);
    return {
      opacity: fxThink.value * Math.max(0.25, op),
      transform: [{ translateY: -p * 5 * s }],
    };
  });

  const thoughtDot2Style = useAnimatedStyle(() => {
    const p = (fxPulse.value + 0.72) % 1;
    const op = Math.sin(p * Math.PI);
    return {
      opacity: fxThink.value * Math.max(0.2, op),
      transform: [{ translateY: -p * 8 * s }, { scale: 0.9 + 0.15 * op }],
    };
  });

  const thoughtDot3Style = useAnimatedStyle(() => {
    const p = (fxPulse.value + 0.42) % 1;
    const op = Math.sin(p * Math.PI);
    return {
      opacity: fxThink.value * Math.max(0.18, op),
      transform: [{ translateY: -p * 11 * s }, { scale: 0.88 + 0.18 * op }],
    };
  });

  const strictBadgeStyle = useAnimatedStyle(() => {
    const w = Math.sin(fxPulse.value * Math.PI * 2);
    return {
      opacity: fxStrict.value * (0.78 + 0.22 * w),
      transform: [{ translateY: w * 3.5 * s }],
    };
  });

  // Блик на нагрудном значке триколора РФ (в строгой и радостной эмоциях)
  const pinGlintStyle = useAnimatedStyle(() => {
    const p = fxPulse.value;
    const active = Math.max(fxStrict.value, fxHappy.value * 0.7);
    const sweep = p < 0.28 ? p / 0.28 : -1;
    return {
      opacity: sweep >= 0 ? active * Math.sin(sweep * Math.PI) * 0.85 : 0,
      transform: [
        { translateX: (sweep * 34 - 10) * s },
        { rotate: '22deg' },
      ],
    };
  });

  // Выбор текущего спрайта рта под активную эмоцию
  const mouthKey =
    activeEmotion === 'happy'
      ? 'mouthHappy'
      : activeEmotion === 'thinking'
      ? 'mouthThink'
      : activeEmotion === 'sad'
      ? 'mouthSad'
      : activeEmotion === 'strict'
      ? 'mouthStrict'
      : 'mouthNeutral';
  const mouthPart = PARTS[mouthKey];
  const mouthSource = MASCOT_ASSETS[mouthKey];

  const renderEye = (eyeCfg, upperStyle, key) => {
    const innerW = (eyeCfg.w - 6) * s;
    const innerH = (eyeCfg.h - 6) * s;
    return (
      <View
        key={key}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: eyeCfg.x * s,
          top: eyeCfg.y * s,
          width: eyeCfg.w * s,
          height: eyeCfg.h * s,
          transform: [{ rotate: `${eyeCfg.rot}deg` }],
        }}
      >
        {/* Белок глаза (склера) с маской обрезки радужки и век */}
        <View
          style={{
            position: 'absolute',
            left: 3 * s,
            top: 3 * s,
            width: innerW,
            height: innerH,
            borderRadius: innerH / 2,
            backgroundColor: '#FDFBF6',
            overflow: 'hidden',
          }}
        >
          {/* Живая тёмно-каряя радужка + двойной блик */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: eyeCfg.irisX * s,
                top: eyeCfg.irisY * s,
                width: PARTS.eyeIris.w * s,
                height: PARTS.eyeIris.h * s,
              },
              pupilStyle,
            ]}
          >
            <Image
              source={MASCOT_ASSETS.eyeIris}
              fadeDuration={0}
              resizeMode="contain"
              style={{ width: PARTS.eyeIris.w * s, height: PARTS.eyeIris.h * s }}
            />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: eyeCfg.c1.x * s,
                  top: eyeCfg.c1.y * s,
                  width: eyeCfg.c1.w * s,
                  height: eyeCfg.c1.h * s,
                  borderRadius: (eyeCfg.c1.h * s) / 2,
                  backgroundColor: '#FFFFFF',
                },
                catch1Style,
              ]}
            />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: eyeCfg.c2.x * s,
                  top: eyeCfg.c2.y * s,
                  width: eyeCfg.c2.w * s,
                  height: eyeCfg.c2.h * s,
                  borderRadius: (eyeCfg.c2.w * s) / 2,
                  backgroundColor: '#FFFFFF',
                },
                catch2Style,
              ]}
            />
          </Animated.View>

          {/* Сочувствующий влажный блеск нижнего края глаза (sad) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: innerW * 0.16,
                bottom: 2.5 * s,
                width: innerW * 0.68,
                height: 7 * s,
                borderRadius: 99,
                backgroundColor: 'rgba(232, 245, 255, 0.78)',
              },
              tearStyle,
            ]}
          />

          {/* Верхнее меховое веко (моргание + эмоции) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: -14 * s,
                top: -6 * s,
                width: innerW + 28 * s,
                height: innerH + 12 * s,
                backgroundColor: '#8F4715',
                borderBottomWidth: Math.max(1.2, 4.6 * s),
                borderBottomColor: '#200D02',
              },
              upperStyle,
            ]}
          />

          {/* Нижнее меховое веко (живая улыбка глазами и прищур) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: -12 * s,
                top: 0,
                width: innerW + 24 * s,
                height: innerH + 14 * s,
                borderTopLeftRadius: innerW * 0.75,
                borderTopRightRadius: innerW * 0.75,
                backgroundColor: '#914916',
                borderTopWidth: Math.max(1.0, 3.8 * s),
                borderTopColor: '#230E02',
              },
              lowerLidStyle,
            ]}
          />
        </View>

        {/* Фирменный контур ресниц поверх века */}
        <Image
          source={MASCOT_ASSETS.eyeRim}
          fadeDuration={0}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: eyeCfg.w * s,
            height: eyeCfg.h * s,
          }}
        />
      </View>
    );
  };

  const fullLayer = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: stageW,
    height: stageH,
  };

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={{ width: stageW, height: stageH }}>
        {/* 1. Мягкая контактная тень под ботинками */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 226 * s,
              top: 896 * s,
              width: 348 * s,
              height: 36 * s,
              borderRadius: 999,
              backgroundColor: '#2B1D14',
            },
            shadowStyle,
          ]}
        />

        {/* 2. Тело целиком (прыжок + squash & stretch от стоп) */}
        <Animated.View pointerEvents="none" style={[fullLayer, bodyJumpStyle]}>
          {/* Брюки и ботинки */}
          <Image
            source={MASCOT_ASSETS.legs}
            fadeDuration={0}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: PARTS.legs.x * s,
              top: PARTS.legs.y * s,
              width: PARTS.legs.w * s,
              height: PARTS.legs.h * s,
            }}
          />

          {/* 3. Верхний корпус (дыхание + осанка от таза) */}
          <Animated.View pointerEvents="none" style={[fullLayer, upperBodyStyle]}>
            {/* Левая лапа (плечо + кисть в манжете) */}
            <Animated.View pointerEvents="none" style={[fullLayer, leftArmStyle]}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: PARTS.pawLeft.x * s,
                    top: PARTS.pawLeft.y * s,
                    width: PARTS.pawLeft.w * s,
                    height: PARTS.pawLeft.h * s,
                  },
                  leftPawStyle,
                ]}
              >
                <Image
                  source={MASCOT_ASSETS.pawLeft}
                  fadeDuration={0}
                  resizeMode="contain"
                  style={{ width: PARTS.pawLeft.w * s, height: PARTS.pawLeft.h * s }}
                />
              </Animated.View>
              <Image
                source={MASCOT_ASSETS.sleeveLeft}
                fadeDuration={0}
                resizeMode="contain"
                style={{
                  position: 'absolute',
                  left: PARTS.sleeveLeft.x * s,
                  top: PARTS.sleeveLeft.y * s,
                  width: PARTS.sleeveLeft.w * s,
                  height: PARTS.sleeveLeft.h * s,
                }}
              />
            </Animated.View>

            {/* Правая приветственная / радостная лапа (плечо + кисть с инерцией) */}
            <Animated.View pointerEvents="none" style={[fullLayer, rightWaveArmStyle]}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: PARTS.pawRight.x * s,
                    top: PARTS.pawRight.y * s,
                    width: PARTS.pawRight.w * s,
                    height: PARTS.pawRight.h * s,
                  },
                  rightPawStyle,
                ]}
              >
                <Image
                  source={MASCOT_ASSETS.pawRight}
                  fadeDuration={0}
                  resizeMode="contain"
                  style={{ width: PARTS.pawRight.w * s, height: PARTS.pawRight.h * s }}
                />
              </Animated.View>
              <Image
                source={MASCOT_ASSETS.sleeveRight}
                fadeDuration={0}
                resizeMode="contain"
                style={{
                  position: 'absolute',
                  left: PARTS.sleeveRight.x * s,
                  top: PARTS.sleeveRight.y * s,
                  width: PARTS.sleeveRight.w * s,
                  height: PARTS.sleeveRight.h * s,
                }}
              />
            </Animated.View>

            {/* Правая опущенная лапа (для сочувствующей эмоции) */}
            <Animated.View pointerEvents="none" style={[fullLayer, rightDownArmStyle]}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: PARTS.pawRightDown.x * s,
                    top: PARTS.pawRightDown.y * s,
                    width: PARTS.pawRightDown.w * s,
                    height: PARTS.pawRightDown.h * s,
                  },
                  rightDownPawStyle,
                ]}
              >
                <Image
                  source={MASCOT_ASSETS.pawRightDown}
                  fadeDuration={0}
                  resizeMode="contain"
                  style={{ width: PARTS.pawRightDown.w * s, height: PARTS.pawRightDown.h * s }}
                />
              </Animated.View>
              <Image
                source={MASCOT_ASSETS.sleeveRightDown}
                fadeDuration={0}
                resizeMode="contain"
                style={{
                  position: 'absolute',
                  left: PARTS.sleeveRightDown.x * s,
                  top: PARTS.sleeveRightDown.y * s,
                  width: PARTS.sleeveRightDown.w * s,
                  height: PARTS.sleeveRightDown.h * s,
                }}
              />
            </Animated.View>

            {/* Правая лапа юриста с поднятым указательным пальцем (строгая эмоция) */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: PARTS.armRightStrict.x * s,
                  top: PARTS.armRightStrict.y * s,
                  width: PARTS.armRightStrict.w * s,
                  height: PARTS.armRightStrict.h * s,
                },
                rightStrictArmStyle,
              ]}
            >
              <Image
                source={MASCOT_ASSETS.armRightStrict}
                fadeDuration={0}
                resizeMode="contain"
                style={{ width: PARTS.armRightStrict.w * s, height: PARTS.armRightStrict.h * s }}
              />
            </Animated.View>

            {/* Костюм-тройка, жилет, галстук и значок триколора РФ */}
            <Image
              source={MASCOT_ASSETS.torso}
              fadeDuration={0}
              resizeMode="contain"
              style={{
                position: 'absolute',
                left: PARTS.torso.x * s,
                top: PARTS.torso.y * s,
                width: PARTS.torso.w * s,
                height: PARTS.torso.h * s,
              }}
            />

            {/* Деликатный световой блик на значке триколора РФ */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 462 * s,
                top: 522 * s,
                width: 34 * s,
                height: 24 * s,
                borderRadius: 3 * s,
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    top: -6 * s,
                    left: 0,
                    width: 8 * s,
                    height: 36 * s,
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  },
                  pinGlintStyle,
                ]}
              />
            </View>

            {/* 4. Голова (ушки за головой + мех + 2.5D мимика глаз, бровей, носа и рта) */}
            <Animated.View pointerEvents="none" style={[fullLayer, headGroupStyle]}>
              {/* Левое ухо */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: PARTS.earLeft.x * s,
                    top: PARTS.earLeft.y * s,
                    width: PARTS.earLeft.w * s,
                    height: PARTS.earLeft.h * s,
                  },
                  earLeftStyle,
                ]}
              >
                <Image
                  source={MASCOT_ASSETS.earLeft}
                  fadeDuration={0}
                  resizeMode="contain"
                  style={{ width: PARTS.earLeft.w * s, height: PARTS.earLeft.h * s }}
                />
              </Animated.View>

              {/* Правое ухо */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: PARTS.earRight.x * s,
                    top: PARTS.earRight.y * s,
                    width: PARTS.earRight.w * s,
                    height: PARTS.earRight.h * s,
                  },
                  earRightStyle,
                ]}
              >
                <Image
                  source={MASCOT_ASSETS.earRight}
                  fadeDuration={0}
                  resizeMode="contain"
                  style={{ width: PARTS.earRight.w * s, height: PARTS.earRight.h * s }}
                />
              </Animated.View>

              {/* Основа головы и мордочки */}
              <Image
                source={MASCOT_ASSETS.headBase}
                fadeDuration={0}
                resizeMode="contain"
                style={{
                  position: 'absolute',
                  left: PARTS.headBase.x * s,
                  top: PARTS.headBase.y * s,
                  width: PARTS.headBase.w * s,
                  height: PARTS.headBase.h * s,
                }}
              />

              {/* 2.5D Лицевая маска (глаза, румянец, брови, мордочка) */}
              <Animated.View pointerEvents="none" style={[fullLayer, facePlaneStyle]}>
                {/* Тёплый румянец на щёчках */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: 256 * s,
                      top: 339 * s,
                      width: 54 * s,
                      height: 28 * s,
                      borderRadius: 999,
                      backgroundColor: '#DA5C4A',
                    },
                    blushStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: 484 * s,
                      top: 351 * s,
                      width: 54 * s,
                      height: 28 * s,
                      borderRadius: 999,
                      backgroundColor: '#DA5C4A',
                    },
                    blushStyle,
                  ]}
                />

                {/* Левый и правый глаза */}
                {renderEye(PARTS.eyeLeft, upperLidLeftStyle, 'eyeL')}
                {renderEye(PARTS.eyeRight, upperLidRightStyle, 'eyeR')}

                {/* Левая и правая брови */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: PARTS.browLeft.x * s,
                      top: PARTS.browLeft.y * s,
                      width: PARTS.browLeft.w * s,
                      height: PARTS.browLeft.h * s,
                    },
                    browLeftStyle,
                  ]}
                >
                  <Image
                    source={MASCOT_ASSETS.browLeft}
                    fadeDuration={0}
                    resizeMode="contain"
                    style={{ width: PARTS.browLeft.w * s, height: PARTS.browLeft.h * s }}
                  />
                </Animated.View>
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: PARTS.browRight.x * s,
                      top: PARTS.browRight.y * s,
                      width: PARTS.browRight.w * s,
                      height: PARTS.browRight.h * s,
                    },
                    browRightStyle,
                  ]}
                >
                  <Image
                    source={MASCOT_ASSETS.browRight}
                    fadeDuration={0}
                    resizeMode="contain"
                    style={{ width: PARTS.browRight.w * s, height: PARTS.browRight.h * s }}
                  />
                </Animated.View>

                {/* Мордочка с дополнительным 3D-параллаксом (нос + рот + речь) */}
                <Animated.View pointerEvents="none" style={[fullLayer, muzzlePlaneStyle]}>
                  {/* Эмоциональный рот */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: mouthPart.x * s,
                        top: mouthPart.y * s,
                        width: mouthPart.w * s,
                        height: mouthPart.h * s,
                      },
                      staticMouthStyle,
                    ]}
                  >
                    <Image
                      source={mouthSource}
                      fadeDuration={0}
                      resizeMode="contain"
                      style={{ width: mouthPart.w * s, height: mouthPart.h * s }}
                    />
                  </Animated.View>

                  {/* Артикуляция открытого слога во время речи */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: PARTS.mouthTalk.x * s,
                        top: PARTS.mouthTalk.y * s,
                        width: PARTS.mouthTalk.w * s,
                        height: PARTS.mouthTalk.h * s,
                      },
                      talkMouthStyle,
                    ]}
                  >
                    <Image
                      source={MASCOT_ASSETS.mouthTalk}
                      fadeDuration={0}
                      resizeMode="contain"
                      style={{ width: PARTS.mouthTalk.w * s, height: PARTS.mouthTalk.h * s }}
                    />
                  </Animated.View>

                  {/* Носик поверх линии рта */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: PARTS.nose.x * s,
                        top: PARTS.nose.y * s,
                        width: PARTS.nose.w * s,
                        height: PARTS.nose.h * s,
                      },
                      noseStyle,
                    ]}
                  >
                    <Image
                      source={MASCOT_ASSETS.nose}
                      fadeDuration={0}
                      resizeMode="contain"
                      style={{ width: PARTS.nose.w * s, height: PARTS.nose.h * s }}
                    />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Animated.View>

            {/* Согнутая правая лапа у подбородка (поверх лацкана и нижнего края щеки в thinking) */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: PARTS.armRightThink.x * s,
                  top: PARTS.armRightThink.y * s,
                  width: PARTS.armRightThink.w * s,
                  height: PARTS.armRightThink.h * s,
                },
                rightThinkArmStyle,
              ]}
            >
              <Image
                source={MASCOT_ASSETS.armRightThink}
                fadeDuration={0}
                resizeMode="contain"
                style={{ width: PARTS.armRightThink.w * s, height: PARTS.armRightThink.h * s }}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        {/* 5. Деликатные живые акценты эмоций (масштабируются вместе с мишкой) */}
        {size >= 64 ? (
          <>
            {/* Искорки радости / похвалы (золото хохломы #D9A849) */}
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: 126 * s, top: 132 * s }, sparkle1Style]}
            >
              <Text style={{ fontSize: Math.max(9, 44 * s), color: '#D9A849', fontWeight: '900' }}>
                ✦
              </Text>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: 626 * s, top: 210 * s }, sparkle2Style]}
            >
              <Text style={{ fontSize: Math.max(8, 36 * s), color: '#C9362B', fontWeight: '900' }}>
                ✦
              </Text>
            </Animated.View>

            {/* Пузырьки аналитического размышления (thinking) */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 616 * s,
                  top: 292 * s,
                  width: 18 * s,
                  height: 18 * s,
                  borderRadius: 999,
                  backgroundColor: '#FCF8F0',
                  borderWidth: Math.max(1, 3 * s),
                  borderColor: '#7298BC',
                },
                thoughtDot1Style,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 636 * s,
                  top: 252 * s,
                  width: 28 * s,
                  height: 28 * s,
                  borderRadius: 999,
                  backgroundColor: '#FCF8F0',
                  borderWidth: Math.max(1, 3.2 * s),
                  borderColor: '#7298BC',
                },
                thoughtDot2Style,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 644 * s,
                  top: 196 * s,
                  width: 42 * s,
                  height: 42 * s,
                  borderRadius: 999,
                  backgroundColor: '#ECF2F7',
                  borderWidth: Math.max(1, 3.5 * s),
                  borderColor: '#7298BC',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                thoughtDot3Style,
              ]}
            >
              <Text style={{ fontSize: Math.max(7, 22 * s), fontWeight: '900', color: '#4A6F91' }}>
                ?
              </Text>
            </Animated.View>

            {/* Юридический знак параграфа § (strict — цитирование кодекса РФ) */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: 72 * s,
                  top: 222 * s,
                  width: 54 * s,
                  height: 54 * s,
                  borderRadius: 999,
                  backgroundColor: '#FAF1DC',
                  borderWidth: Math.max(1, 3.5 * s),
                  borderColor: '#D9A849',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                strictBadgeStyle,
              ]}
            >
              <Text style={{ fontSize: Math.max(8, 30 * s), fontWeight: '900', color: '#C9362B' }}>
                §
              </Text>
            </Animated.View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});

export default AnimatedMascot;

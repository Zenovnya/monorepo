// ============================================================================
// BearLawyerMascot.js
// Полная скелетная модель маскота «Мишка-Юрист» (без фона, векторный риг)
// Стек: React Native + react-native-reanimated + react-native-svg
// Поддерживаемые эмоции:
//   • 'neutral'    — Нейтральная / Приветственная (главный экран, старт урока)
//   • 'joyful'     — Радостная / Хвалящая (верный ответ, успешный кейс)
//   • 'thoughtful' — Задумчивая / Анализирующая (разбор ситуации, загрузка)
//   • 'sad'        — Грустная / Сочувствующая (ошибка в кейсе, сопереживание)
//   • 'strict'     — Строгая / Серьезная (цитирование кодексов, предупреждения)
//
// Компонент самодостаточен (без внешних ассетов) и рассчитан на канвас,
// плотно обведённый вокруг рисунка (viewBox 356×522), который масштабируется
// под проп ``size`` по ширине. Высота = size * MASCOT_ASPECT.
// ============================================================================

import React, { useEffect } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Отношение высоты канваса маскота к ширине.
 *
 * Совпадает с viewBox (`356 × 522`) и с плотной обводкой рисунка: если держать
 * эти два числа разными, SVG центрирует фигуру в «письме» и медведь выглядит
 * мелким и обрезанным.
 */
const MASCOT_ASPECT = 522 / 356;

export { MASCOT_ASPECT };

/** @typedef {'neutral' | 'joyful' | 'thoughtful' | 'sad' | 'strict'} MascotEmotion */

/**
 * @param {Object} props
 * @param {MascotEmotion} [props.emotion]
 * @param {number} [props.size]         ширина в px (высота = size * MASCOT_ASPECT)
 * @param {boolean} [props.isTalking]   циклическая артикуляция рта
 * @param {boolean} [props.showGlasses] зарезервировано под очки (пока не рисуются)
 * @param {() => void} [props.onPressMascot]
 */
export const BearLawyerMascot = ({
  emotion = 'neutral',
  size = 320,
  isTalking = false,
  onChangeEmotion,
  onPressMascot,
}) => {
  // --------------------------------------------------------------------------
  // 1. REANIMATED SHARED VALUES (Кости и контроллеры мимики)
  // --------------------------------------------------------------------------
  const bodyBounceY = useSharedValue(0);
  const bodyRotate = useSharedValue(0);
  const breathScale = useSharedValue(1);

  // Голова и мордочка
  const headRotate = useSharedValue(-2);
  const headY = useSharedValue(0);

  // Ушки
  const earLeftRotate = useSharedValue(0);
  const earRightRotate = useSharedValue(0);

  // Глаза, зрачки и веки
  const eyeLookX = useSharedValue(0);
  const eyeLookY = useSharedValue(0);
  const pupilScale = useSharedValue(1);
  const eyelidBlink = useSharedValue(0);
  const happySquint = useSharedValue(0);
  const sadTearOpacity = useSharedValue(0);

  // Брови
  const browLeftY = useSharedValue(0);
  const browRightY = useSharedValue(0);
  const browLeftRotate = useSharedValue(0);
  const browRightRotate = useSharedValue(0);

  // Правая лапа (машущая, 2 сустава с перекрывающейся инерцией кисти)
  const rightArmRotate = useSharedValue(0);
  const rightWristRotate = useSharedValue(0);

  // Левая лапа
  const leftArmRotate = useSharedValue(0);

  // Румянец и артикуляция рта
  const cheekBlush = useSharedValue(0.2);
  const jawOpen = useSharedValue(0.1);

  // --------------------------------------------------------------------------
  // 2. БАЗОВЫЕ ОРГАНИЧЕСКИЕ ЦИКЛЫ (Дыхание и естественное моргание)
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Непрерывное дыхание грудной клетки
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.026, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.985, { duration: 1900, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Естественное моргание каждые ~3.4 секунды
    eyelidBlink.value = withRepeat(
      withSequence(
        withDelay(3200, withTiming(1, { duration: 85 })),
        withTiming(0, { duration: 110 }),
        withDelay(1800, withTiming(1, { duration: 80 })),
        withTiming(0, { duration: 95 }),
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 110 })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(breathScale);
      cancelAnimation(eyelidBlink);
    };
  }, [breathScale, eyelidBlink]);

  // Артикуляция рта, пока включён флаг isTalking (перебивает jawOpen эмоции).
  useEffect(() => {
    if (!isTalking) {
      jawOpen.value = withTiming(0.1, { duration: 180 });
      return undefined;
    }
    jawOpen.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 130 }),
        withTiming(0.15, { duration: 140 }),
        withTiming(0.8, { duration: 120 }),
        withTiming(0.2, { duration: 160 })
      ),
      -1,
      false
    );
    return () => cancelAnimation(jawOpen);
  }, [isTalking, jawOpen]);
  // --------------------------------------------------------------------------
  // 3. МАШИНА СОСТОЯНИЙ ЭМОЦИЙ (5 юридических сценариев)
  // --------------------------------------------------------------------------
  useEffect(() => {
    cancelAnimation(bodyBounceY);
    cancelAnimation(rightArmRotate);
    cancelAnimation(rightWristRotate);
    cancelAnimation(leftArmRotate);
    cancelAnimation(headRotate);
    cancelAnimation(eyeLookX);
    cancelAnimation(eyeLookY);

    if (typeof onChangeEmotion === 'function') onChangeEmotion(emotion);

    switch (emotion) {
      // • 1. НЕЙТРАЛЬНАЯ / ПРИВЕТСТВЕННАЯ
      case 'neutral': {
        bodyBounceY.value = withRepeat(
          withTiming(-3.5, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          -1,
          true
        );
        headRotate.value = withRepeat(
          withSequence(
            withTiming(-3.2, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(1.5, { duration: 1800, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        headY.value = withSpring(0, { damping: 14, stiffness: 120 });

        // Приветственный взмах лапой + инерционное запаздывание кисти
        rightArmRotate.value = withRepeat(
          withSequence(
            withTiming(11, { duration: 650, easing: Easing.inOut(Easing.sin) }),
            withTiming(-9, { duration: 650, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        rightWristRotate.value = withRepeat(
          withSequence(
            withDelay(90, withTiming(16, { duration: 650, easing: Easing.inOut(Easing.sin) })),
            withTiming(-14, { duration: 650, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        leftArmRotate.value = withSpring(0);

        browLeftY.value = withSpring(0);
        browRightY.value = withSpring(0);
        browLeftRotate.value = withSpring(-2);
        browRightRotate.value = withSpring(2);

        eyeLookX.value = withSpring(0);
        eyeLookY.value = withSpring(0);
        pupilScale.value = withSpring(1);
        happySquint.value = withSpring(0.08);
        sadTearOpacity.value = withTiming(0);
        cheekBlush.value = withTiming(0.2);
        earLeftRotate.value = withSpring(0);
        earRightRotate.value = withSpring(0);
        break;
      }

      // • 2. РАДОСТНАЯ / ХВАЛЯЩАЯ (успешно решённый кейс)
      case 'joyful': {
        bodyBounceY.value = withRepeat(
          withSequence(
            withSpring(-14, { damping: 7, stiffness: 210 }),
            withSpring(0, { damping: 9, stiffness: 190 })
          ),
          -1,
          true
        );
        headRotate.value = withRepeat(
          withSequence(
            withTiming(5, { duration: 380 }),
            withTiming(-5, { duration: 380 })
          ),
          -1,
          true
        );
        headY.value = withSpring(-5);

        // Активное радостное помахивание обеими лапами
        rightArmRotate.value = withRepeat(
          withSequence(
            withTiming(24, { duration: 320 }),
            withTiming(-4, { duration: 320 })
          ),
          -1,
          true
        );
        rightWristRotate.value = withRepeat(
          withSequence(
            withTiming(22, { duration: 320 }),
            withTiming(-18, { duration: 320 })
          ),
          -1,
          true
        );
        leftArmRotate.value = withRepeat(
          withSequence(
            withTiming(-32, { duration: 340 }),
            withTiming(-10, { duration: 340 })
          ),
          -1,
          true
        );

        browLeftY.value = withSpring(-6);
        browRightY.value = withSpring(-6);
        browLeftRotate.value = withSpring(-8);
        browRightRotate.value = withSpring(8);

        eyeLookX.value = withSpring(0);
        eyeLookY.value = withSpring(-1);
        pupilScale.value = withSpring(1.1);
        happySquint.value = withSpring(0.85);
        sadTearOpacity.value = withTiming(0);
        cheekBlush.value = withTiming(0.75);
        earLeftRotate.value = withSpring(-8);
        earRightRotate.value = withSpring(8);
        break;
      }

      // • 3. ЗАДУМЧИВАЯ / АНАЛИЗИРУЮЩАЯ (разбор сложной ситуации, загрузка)
      case 'thoughtful': {
        bodyBounceY.value = withRepeat(
          withTiming(2, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          -1,
          true
        );
        headRotate.value = withSpring(8.5, { damping: 14, stiffness: 110 });
        headY.value = withSpring(2);

        // Правая лапа подносится к подбородку (жест размышления)
        rightArmRotate.value = withSpring(-38, { damping: 13, stiffness: 120 });
        rightWristRotate.value = withRepeat(
          withSequence(
            withTiming(-22, { duration: 900 }),
            withTiming(-12, { duration: 900 })
          ),
          -1,
          true
        );
        leftArmRotate.value = withSpring(-10);

        // Асимметричные брови (одна высоко поднята, другая сосредоточенно опущена)
        browLeftY.value = withSpring(-7);
        browRightY.value = withSpring(4.5);
        browLeftRotate.value = withSpring(-8);
        browRightRotate.value = withSpring(-10);

        // Глаза сканируют строки невидимого кодекса вверх-влево и вправо
        eyeLookY.value = withSpring(-5);
        eyeLookX.value = withRepeat(
          withSequence(
            withTiming(-6, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
            withTiming(4, { duration: 1100, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          true
        );
        pupilScale.value = withSpring(0.96);
        happySquint.value = withSpring(0.15);
        sadTearOpacity.value = withTiming(0);
        cheekBlush.value = withTiming(0.1);
        break;
      }

      // • 4. ГРУСТНАЯ / СОЧУВСТВУЮЩАЯ (ошибка в кейсе — поддержка без упрёков)
      case 'sad': {
        // Плавный сочувствующий вздох
        bodyBounceY.value = withRepeat(
          withSequence(
            withTiming(6, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        );
        headRotate.value = withSpring(-9.5, { damping: 15, stiffness: 100 });
        headY.value = withSpring(6);

        // Лапа мягко опущена к сердцу в знак поддержки
        rightArmRotate.value = withSpring(-44, { damping: 14, stiffness: 100 });
        rightWristRotate.value = withSpring(-15);
        leftArmRotate.value = withSpring(6);

        // Брови «домиком» (/ \)
        browLeftY.value = withSpring(3);
        browRightY.value = withSpring(3);
        browLeftRotate.value = withSpring(16);
        browRightRotate.value = withSpring(-16);

        eyeLookX.value = withSpring(-2);
        eyeLookY.value = withSpring(3.5);
        pupilScale.value = withSpring(1.08);
        happySquint.value = withSpring(0);
        sadTearOpacity.value = withTiming(0.9, { duration: 500 });
        cheekBlush.value = withTiming(0.25);

        // Опущенные ушки
        earLeftRotate.value = withSpring(-14);
        earRightRotate.value = withSpring(14);
        break;
      }

      // • 5. СТРОГАЯ / СЕРЬЕЗНАЯ (цитирование кодексов и предупреждения)
      case 'strict': {
        bodyBounceY.value = withSpring(-3, { damping: 16, stiffness: 160 });
        headRotate.value = withSpring(0.5, { damping: 18, stiffness: 160 });
        headY.value = withSpring(-3);

        // Уверенный адвокатский жест лапой в такт цитированию статьи закона
        rightArmRotate.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 750, easing: Easing.inOut(Easing.quad) }),
            withTiming(-14, { duration: 750, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          true
        );
        rightWristRotate.value = withRepeat(
          withSequence(
            withTiming(8, { duration: 750 }),
            withTiming(-6, { duration: 750 })
          ),
          -1,
          true
        );
        leftArmRotate.value = withSpring(-14);

        // Строго сведённые к переносице брови (\ /)
        browLeftY.value = withSpring(5.5);
        browRightY.value = withSpring(5.5);
        browLeftRotate.value = withSpring(-15);
        browRightRotate.value = withSpring(15);

        eyeLookX.value = withSpring(0);
        eyeLookY.value = withSpring(0);
        pupilScale.value = withSpring(0.92);
        happySquint.value = withSpring(0.2);
        sadTearOpacity.value = withTiming(0);
        cheekBlush.value = withTiming(0.05);
        earLeftRotate.value = withSpring(3);
        earRightRotate.value = withSpring(-3);
        break;
      }

      default:
        break;
    }
    // Shared values стабильны (создаются один раз) — пересоздавать эффект по ним
    // нельзя, иначе бесконечная перезапуск анимаций на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion, onChangeEmotion]);



  // --------------------------------------------------------------------------
  // 4. ANIMATED STYLES & SVG PROPS
  // --------------------------------------------------------------------------
  const rootAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyBounceY.value },
      { rotate: `${bodyRotate.value}deg` },
    ],
  }));

  const torsoAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 306 },
      { translateY: 405 },
      { scaleX: breathScale.value },
      { scaleY: breathScale.value },
      { translateX: -306 },
      { translateY: -405 },
    ],
  }));

  const legsAnimatedProps = useAnimatedProps(() => ({
    // Ноги масштабируются дыханием от той же точки, что и торс, чтобы
    // линия пояса не «разъезжалась» при вдохе/выдохе.
    transform: [
      { translateX: 306 },
      { translateY: 405 },
      { scaleX: breathScale.value },
      { scaleY: breathScale.value },
      { translateX: -306 },
      { translateY: -405 },
    ],
  }));

  const headAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 305 },
      { translateY: 318 + headY.value },
      { rotate: `${headRotate.value}deg` },
      { translateX: -305 },
      { translateY: -318 },
    ],
  }));

  const rightArmAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 242 },
      { translateY: 354 },
      { rotate: `${rightArmRotate.value}deg` },
      { translateX: -242 },
      { translateY: -354 },
    ],
  }));

  const rightWristAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 166 },
      { translateY: 294 },
      { rotate: `${rightWristRotate.value}deg` },
      { translateX: -166 },
      { translateY: -294 },
    ],
  }));

  const leftArmAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 368 },
      { translateY: 354 },
      { rotate: `${leftArmRotate.value}deg` },
      { translateX: -368 },
      { translateY: -354 },
    ],
  }));

  const eyeLeftAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: eyeLookX.value },
      { translateY: eyeLookY.value },
      { scale: pupilScale.value },
    ],
  }));

  const eyeRightAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: eyeLookX.value },
      { translateY: eyeLookY.value },
      { scale: pupilScale.value },
    ],
  }));

  // Веки закрываются, «съезжая» вниз от верхнего края глаза. Анимируем
  // translateY и непрозрачность (валидные для SVG <G>), а не height: у <G>
  // нет атрибута height, поэтому прежняя версия оставляла веко раскрытым
  // НАВСЕГДА и полностью закрашивала глаз.
  const eyelidLeftAnimatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, eyelidBlink.value));
    return {
      transform: [{ translateY: -26 * (1 - t) }],
      opacity: t,
    };
  });

  const eyelidRightAnimatedProps = useAnimatedProps(() => {
    const t = Math.max(0, Math.min(1, eyelidBlink.value));
    return {
      transform: [{ translateY: -26 * (1 - t) }],
      opacity: t,
    };
  });

  const squintAnimatedProps = useAnimatedProps(() => ({
    opacity: happySquint.value,
  }));

  const blushAnimatedProps = useAnimatedProps(() => ({
    opacity: cheekBlush.value,
  }));

  const tearAnimatedProps = useAnimatedProps(() => ({
    opacity: sadTearOpacity.value,
  }));

  const browLeftAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 252 },
      { translateY: 168 + browLeftY.value },
      { rotate: `${browLeftRotate.value}deg` },
      { translateX: -252 },
      { translateY: -168 },
    ],
  }));

  const browRightAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 358 },
      { translateY: 168 + browRightY.value },
      { rotate: `${browRightRotate.value}deg` },
      { translateX: -358 },
      { translateY: -168 },
    ],
  }));

  const earLeftAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 196 },
      { translateY: 140 },
      { rotate: `${earLeftRotate.value}deg` },
      { translateX: -196 },
      { translateY: -140 },
    ],
  }));

  const earRightAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 414 },
      { translateY: 140 },
      { rotate: `${earRightRotate.value}deg` },
      { translateX: -414 },
      { translateY: -140 },
    ],
  }));

  const mouthAnimatedProps = useAnimatedProps(() => ({
    transform: [
      { translateX: 305 },
      { translateY: 258 },
      { scaleY: 1 + jawOpen.value * 0.7 },
      { translateX: -305 },
      { translateY: -258 },
    ],
  }));

  // --------------------------------------------------------------------------
  // 5. RENDER
  // --------------------------------------------------------------------------
  return (
    <Pressable
      onPress={onPressMascot}
      style={{ width: size, height: size * MASCOT_ASPECT }}
      accessibilityRole={onPressMascot ? 'button' : 'image'}
    >
      <Animated.View style={[styles.container, rootAnimatedStyle]}>
        <Svg viewBox="128 74 356 522" width="100%" height="100%">
          {/* LEFT ARM — опущена вдоль корпуса, инерционное покачивание */}
          <AnimatedG animatedProps={leftArmAnimatedProps}>
            <Path
              d="M 358 336 C 386 328, 412 310, 430 288 L 452 311 C 436 340, 404 366, 368 380 Z"
              fill="#352316"
              stroke="#221107"
              strokeWidth="4.2"
            />
            <Path
              d="M 452 307 C 466 297, 476 282, 470 272 C 466 266, 458 267, 454 272 C 459 260, 454 248, 445 247 C 438 246, 432 252, 430 260 C 430 249, 422 242, 414 245 C 407 247, 404 256, 406 266 C 401 257, 392 255, 387 261 C 381 268, 385 285, 395 297 L 427 322 Z"
              fill="#864319"
              stroke="#221107"
              strokeWidth="4.2"
            />
          </AnimatedG>

          {/* RIGHT ARM — машущая лапа: плечо + кисть (2 сустава) */}
          <AnimatedG animatedProps={rightArmAnimatedProps}>
            <Path
              d="M 252 336 C 225 326, 195 304, 174 282 L 150 307 C 168 336, 202 368, 238 382 Z"
              fill="#352316"
              stroke="#221107"
              strokeWidth="4.2"
            />
            <AnimatedG animatedProps={rightWristAnimatedProps}>
              <Path
                d="M 149 301 C 134 291, 125 276, 132 266 C 136 260, 144 261, 148 266 C 143 254, 148 242, 157 241 C 164 240, 170 246, 172 254 C 172 243, 180 236, 188 239 C 195 241, 198 250, 196 260 C 201 251, 210 249, 215 255 C 221 262, 217 279, 207 291 L 175 316 Z"
                fill="#864319"
                stroke="#221107"
                strokeWidth="4.2"
              />
            </AnimatedG>
          </AnimatedG>

          {/* LEGS — нижняя половина тела: две лапы-ноги с ботинками.
              Рисуются ПОД торсом (перед ним в потоке), поэтому костюм их
              «перекрывает» сверху и они читаются как выходящие из-под пальто.
              Анимируются тем же дыханием, что и торс, чтобы не рассинхрониться. */}
          <AnimatedG animatedProps={legsAnimatedProps}>
            {/* Левая нога */}
            <Path
              d="M 262 448 C 256 492, 252 528, 254 556 L 292 556 C 292 526, 290 488, 288 448 Z"
              fill="#352316"
              stroke="#221107"
              strokeWidth="4.2"
            />
            {/* Левая стопа (ботинок) */}
            <Path
              d="M 248 548 C 244 566, 246 578, 258 582 C 274 586, 296 584, 300 574 C 302 566, 296 558, 292 552 Z"
              fill="#221107"
              stroke="#221107"
              strokeWidth="4"
            />

            {/* Правая нога */}
            <Path
              d="M 326 448 C 328 488, 328 526, 330 556 L 368 556 C 366 528, 362 492, 356 448 Z"
              fill="#352316"
              stroke="#221107"
              strokeWidth="4.2"
            />
            {/* Правая стопа (ботинок) */}
            <Path
              d="M 324 552 C 320 558, 314 566, 316 574 C 320 584, 342 586, 358 582 C 370 578, 372 566, 368 548 Z"
              fill="#221107"
              stroke="#221107"
              strokeWidth="4"
            />
          </AnimatedG>

          {/* TORSO — костюм-тройка (дышит через breathScale) */}
          <AnimatedG animatedProps={torsoAnimatedProps}>
            <Path
              d="M 244 328 L 368 328 C 380 362, 384 415, 382 458 C 365 466, 344 466, 336 456 L 306 446 L 276 456 C 268 466, 247 466, 230 458 C 228 415, 232 362, 244 328 Z"
              fill="#352316"
              stroke="#221107"
              strokeWidth="4.2"
            />
            {/* Рубашка (белая манишка) */}
            <Path
              d="M 276 336 L 336 336 L 328 420 L 306 442 L 284 420 Z"
              fill="#F6F1E8"
              stroke="#221107"
              strokeWidth="3.4"
            />
            {/* Галстук */}
            <Path
              d="M 300 342 L 312 342 L 316 366 L 306 428 L 296 366 Z"
              fill="#8C1C1C"
              stroke="#221107"
              strokeWidth="3"
            />
          </AnimatedG>

          {/* HEAD — уши, череп, глаза, брови, мордочка, рот, румянец, слеза */}
          <AnimatedG animatedProps={headAnimatedProps}>
            {/* Левое ухо */}
            <AnimatedG animatedProps={earLeftAnimatedProps}>
              <Path
                d="M 196 96 C 168 84, 150 112, 162 142 C 172 166, 198 170, 212 150 C 224 132, 218 108, 196 96 Z"
                fill="#864319"
                stroke="#221107"
                strokeWidth="4.2"
              />
              <Path
                d="M 196 110 C 180 104, 170 120, 178 138 C 184 152, 200 154, 208 142 C 214 132, 210 116, 196 110 Z"
                fill="#C98A5A"
              />
            </AnimatedG>

            {/* Правое ухо */}
            <AnimatedG animatedProps={earRightAnimatedProps}>
              <Path
                d="M 414 96 C 442 84, 460 112, 448 142 C 438 166, 412 170, 398 150 C 386 132, 392 108, 414 96 Z"
                fill="#864319"
                stroke="#221107"
                strokeWidth="4.2"
              />
              <Path
                d="M 414 110 C 430 104, 440 120, 432 138 C 426 152, 410 154, 402 142 C 396 132, 400 116, 414 110 Z"
                fill="#C98A5A"
              />
            </AnimatedG>

            {/* Череп с пушистыми щёчками */}
            <Path
              d="M 305 104 C 365 104, 412 140, 424 198 L 432 218 L 424 221 L 435 246 L 426 248 L 433 272 L 422 273 C 412 308, 368 330, 305 330 C 242 330, 198 308, 188 273 L 177 272 L 184 248 L 175 246 L 186 221 L 178 218 L 186 198 C 198 140, 245 104, 305 104 Z"
              fill="#864319"
              stroke="#221107"
              strokeWidth="4.4"
            />

            {/* Светлая мордочка */}
            <Path
              d="M 242 216 C 262 200, 348 200, 368 216 C 382 240, 372 276, 342 288 C 326 296, 284 296, 268 288 C 238 276, 228 240, 242 216 Z"
              fill="#E0A96D"
              stroke="#221107"
              strokeWidth="3.6"
            />



            {/* Левый глаз: белок + зрачок */}
            <Path
              d="M 252 196 C 266 178, 296 178, 308 196 C 296 212, 266 212, 252 196 Z"
              fill="#FFFFFF"
              stroke="#221107"
              strokeWidth="3.4"
            />
            <AnimatedG animatedProps={eyeLeftAnimatedProps}>
              <Path
                d="M 272 190 C 279 190, 285 196, 285 203 C 285 210, 279 215, 272 215 C 265 215, 260 210, 260 203 C 260 196, 265 190, 272 190 Z"
                fill="#221107"
              />
              <Path
                d="M 275 194 C 278 194, 280 196, 280 199 C 280 202, 278 204, 275 204 C 272 204, 270 202, 270 199 C 270 196, 272 194, 275 194 Z"
                fill="#FFFFFF"
              />
            </AnimatedG>

            {/* Правый глаз */}
            <Path
              d="M 302 196 C 314 178, 344 178, 358 196 C 344 212, 314 212, 302 196 Z"
              fill="#FFFFFF"
              stroke="#221107"
              strokeWidth="3.4"
            />
            <AnimatedG animatedProps={eyeRightAnimatedProps}>
              <Path
                d="M 328 190 C 335 190, 340 196, 340 203 C 340 210, 335 215, 328 215 C 321 215, 315 210, 315 203 C 315 196, 321 190, 328 190 Z"
                fill="#221107"
              />
              <Path
                d="M 331 194 C 334 194, 336 196, 336 199 C 336 202, 334 204, 331 204 C 328 204, 326 202, 326 199 C 326 196, 328 194, 331 194 Z"
                fill="#FFFFFF"
              />
            </AnimatedG>

            {/* Прищур от радости (проявляется happySquint) */}
            <AnimatedG animatedProps={squintAnimatedProps}>
              <Path
                d="M 250 200 C 266 190, 296 190, 310 200"
                stroke="#221107"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 300 200 C 314 190, 344 190, 360 200"
                stroke="#221107"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
            </AnimatedG>

            {/* Веки (моргание). Опускаются сверху и накрывают глаз полностью
                лишь в момент моргания; в покое невидимы (opacity 0). */}
            <AnimatedG animatedProps={eyelidLeftAnimatedProps}>
              <Path
                d="M 252 196 C 266 178, 296 178, 308 196 L 308 218 L 252 218 Z"
                fill="#864319"
              />
            </AnimatedG>
            <AnimatedG animatedProps={eyelidRightAnimatedProps}>
              <Path
                d="M 302 196 C 314 178, 344 178, 358 196 L 358 218 L 302 218 Z"
                fill="#864319"
              />
            </AnimatedG>

            {/* Брови */}
            <AnimatedG animatedProps={browLeftAnimatedProps}>
              <Path
                d="M 234 160 C 250 150, 272 150, 288 158"
                stroke="#221107"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
              />
            </AnimatedG>
            <AnimatedG animatedProps={browRightAnimatedProps}>
              <Path
                d="M 322 158 C 338 150, 360 150, 376 160"
                stroke="#221107"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
              />
            </AnimatedG>

            {/* Нос */}
            <Path
              d="M 292 232 C 300 226, 312 226, 320 232 C 318 244, 312 250, 306 250 C 300 250, 294 244, 292 232 Z"
              fill="#221107"
            />

            {/* Рот (артикуляция — mouthAnimatedProps) */}
            <AnimatedG animatedProps={mouthAnimatedProps}>
              <Path
                d="M 306 250 L 306 262"
                stroke="#221107"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <Path
                d="M 282 266 C 292 280, 320 280, 330 266"
                stroke="#221107"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
            </AnimatedG>

            {/* Румянец */}
            <AnimatedG animatedProps={blushAnimatedProps}>
              <Path
                d="M 232 244 C 246 236, 264 240, 264 252 C 264 264, 246 270, 232 262 C 226 256, 226 250, 232 244 Z"
                fill="#E2705A"
              />
              <Path
                d="M 380 244 C 366 236, 348 240, 348 252 C 348 264, 366 270, 380 262 C 386 256, 386 250, 380 244 Z"
                fill="#E2705A"
              />
            </AnimatedG>

            {/* Слеза (для sad) */}
            <AnimatedG animatedProps={tearAnimatedProps}>
              <Path
                d="M 268 216 C 262 226, 260 236, 268 240 C 276 236, 274 226, 268 216 Z"
                fill="#6EC1E4"
                stroke="#221107"
                strokeWidth="2.4"
              />
            </AnimatedG>
          </AnimatedG>
        </Svg>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default BearLawyerMascot;


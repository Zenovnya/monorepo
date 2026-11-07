import React, { useMemo } from 'react';

import { BearLawyerMascot } from './mascot/BearLawyerMascot';

/**
 * AnimatedMascot — единый API маскота для экранов.
 *
 * Раньше под капотом была растровая заглушка (bear.png в круглом медальоне).
 * Теперь это векторный «Мишка-Юрист» (<BearLawyerMascot>) с полноценной
 * мимикой: череп, уши, глаза со зрачками и веками, брови, мордочка, рот,
 * румянец, слеза и две лапы с машущим жестом.
 *
 * Экраны продолжают пользоваться семантическими пропсами («верный ответ»,
 * «wave», «level up») — компонент сам мапит их на 5 эмоций рига:
 *   neutral | joyful | thoughtful | sad | strict
 *
 * Приоритет пропсов (по убыванию — верхний бьёт нижние):
 *   perfect      → идеальный урок (радость + максимальный румянец)
 *   levelUp      → повышение уровня
 *   achievement  → разблокировка достижения (кивок + румянец)
 *   streak='celebrate' | 'broken' → продлил / прервал streak
 *   networkError → ошибка сети (строгая сосредоточенность)
 *   wave         → приветственный махание лапой
 *   celebrate    → правильный ответ
 *   error        → ошибка (сочувствие без упрёков)
 *   emotion      → 'cheer' | 'happy' | 'sad' | 'think' | 'idle'
 *
 * ``talking`` включает циклическую артикуляцию рта (jawOpen) поверх любой
 * эмоции. ``mood`` — модификатор поверх idle (happy / concerned / excited).
 * ``vector`` оставлен для обратной совместимости и больше ни на что не влияет.
 */
export const AnimatedMascot = ({
  celebrate,
  error,
  emotion,
  perfect,
  wave,
  levelUp,
  streak,
  achievement,
  networkError,
  talking,
  mood: moodProp,
  size = 160,
  onPressMascot,
}) => {
  const mappedEmotion = useMemo(() => {
    // Специализированные события — важнее generic-эмоции.
    if (perfect || levelUp || achievement || celebrate || wave) return 'joyful';
    if (streak === 'celebrate') return 'joyful';
    if (streak === 'broken' || error || emotion === 'sad') return 'sad';
    if (networkError) return 'strict';

    switch (emotion) {
      case 'cheer':
      case 'happy':
      case 'wave':
        return 'joyful';
      case 'think':
        return 'thoughtful';
      case 'sad':
        return 'sad';
      case 'idle':
      default:
        break;
    }

    switch (moodProp) {
      case 'happy':
      case 'excited':
        return 'joyful';
      case 'concerned':
        return 'thoughtful';
      default:
        return 'neutral';
    }
  }, [
    celebrate,
    error,
    emotion,
    perfect,
    wave,
    levelUp,
    streak,
    achievement,
    networkError,
    moodProp,
  ]);

  return (
    <BearLawyerMascot
      emotion={mappedEmotion}
      size={size}
      isTalking={!!talking}
      onPressMascot={onPressMascot}
    />
  );
};

export default AnimatedMascot;

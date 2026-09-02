import React, { useMemo } from 'react';

import BearRig from './mascot/BearRig';

/**
 * AnimatedMascot — единый API маскота для экранов.
 *
 * Мапит удобные семантические пропсы («идеальный урок», «wave», «level up»)
 * на состояния низкоуровневого <BearRig>, поэтому экраны не думают про
 * названия состояний, а просто описывают событие.
 *
 * Приоритет пропсов (по убыванию — верхний бьёт нижние):
 *   perfect      → идеальный урок (звёзды в глазах + celebration)
 *   levelUp      → повышение уровня
 *   achievement  → разблокировка достижения (звёздочки + кивок)
 *   streak='celebrate' | 'broken' → продлил / прервал streak
 *   networkError → ошибка сети (знак «?»)
 *   wave         → приветственный махание лапой
 *   celebrate    → правильный ответ (correct_big)
 *   error        → ошибка (wrong_soft)
 *   emotion      → 'cheer' | 'happy' | 'sad' | 'think' | 'idle'
 *
 * ``talking`` включает циклический рот (talk_loop) поверх любого состояния.
 * ``mood`` — модификатор поверх idle (happy / concerned / excited / sleepy).
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
  size = 220,
}) => {
  const { state, mood, isTalking } = useMemo(() => {
    const t = !!talking;
    // Специализированные состояния — идут первыми, важнее generic.
    if (perfect) return { state: 'perfect_lesson', mood: 'happy', isTalking: t };
    if (levelUp) return { state: 'level_up', mood: 'excited', isTalking: t };
    if (achievement) return { state: 'achievement_unlock', mood: 'happy', isTalking: t };
    if (streak === 'celebrate') return { state: 'streak_celebrate', mood: 'happy', isTalking: t };
    if (streak === 'broken') return { state: 'streak_broken', mood: 'concerned', isTalking: t };
    if (networkError) return { state: 'error_network', mood: 'concerned', isTalking: t };
    if (wave) return { state: 'onboarding_wave', mood: 'happy', isTalking: t };
    if (celebrate) return { state: 'correct_big', mood: moodProp || 'happy', isTalking: t };
    if (error) return { state: 'wrong_soft', mood: moodProp || 'concerned', isTalking: t };

    switch (emotion) {
      case 'cheer':
        return { state: 'correct_big', mood: moodProp || 'happy', isTalking: t };
      case 'happy':
        return { state: 'idle', mood: moodProp || 'happy', isTalking: t };
      case 'sad':
        return { state: 'wrong_sad', mood: moodProp || 'concerned', isTalking: t };
      case 'think':
        return { state: 'idle', mood: moodProp || 'concerned', isTalking: t };
      case 'idle':
      default:
        return { state: 'idle', mood: moodProp || 'neutral', isTalking: t };
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
    talking,
    moodProp,
  ]);

  return <BearRig size={size} state={state} mood={mood} isTalking={isTalking} />;
};

export default AnimatedMascot;

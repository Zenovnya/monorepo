import React, { useMemo } from 'react';

import BearRig from './mascot/BearRig';

/**
 * AnimatedMascot — тонкий compat-обёртка над новым векторным ригом
 * (`components/mascot/BearRig`). Оставлен ради обратной совместимости
 * с существующим API (пропсы `celebrate`, `error`, `emotion`).
 *
 * Для нового кода используйте <BearRig /> напрямую — там больше состояний
 * (correct_small/big, wrong_soft/sad, perfect_lesson, streak-эффекты и т.д.).
 */
export const AnimatedMascot = ({ celebrate, error, emotion, size = 220 }) => {
  const { state, mood } = useMemo(() => {
    if (celebrate) return { state: 'correct_big', mood: 'happy' };
    if (error) return { state: 'wrong_soft', mood: 'concerned' };
    switch (emotion) {
      case 'cheer':
        return { state: 'correct_big', mood: 'happy' };
      case 'happy':
        return { state: 'idle', mood: 'happy' };
      case 'sad':
        return { state: 'wrong_sad', mood: 'concerned' };
      case 'think':
        return { state: 'idle', mood: 'concerned' };
      case 'idle':
      default:
        return { state: 'idle', mood: 'neutral' };
    }
  }, [celebrate, error, emotion]);

  return <BearRig size={size} state={state} mood={mood} />;
};

export default AnimatedMascot;

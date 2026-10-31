/**
 * РџРѕСЏРІР»РµРЅРёРµ СЌР»РµРјРµРЅС‚Р° СЃ РєР°СЃРєР°РґРѕРј.
 *
 * Р‘Р°Р·РѕРІС‹Р№ РїСЂРёРјРёС‚РёРІ motion-СЃРёСЃС‚РµРјС‹: РєР°СЂС‚РѕС‡РєРё, СЃС‚СЂРѕРєРё СЃРїРёСЃРєРѕРІ Рё Р±Р»РѕРєРё В«РІСЉРµР·Р¶Р°СЋС‚В»
 * СЃРЅРёР·Сѓ РЅР° 12px Рё РїСЂРѕСЏРІР»СЏСЋС‚СЃСЏ. РџСЂРё reduce-motion СЌР»РµРјРµРЅС‚ РїРѕСЏРІР»СЏРµС‚СЃСЏ СЃСЂР°Р·Сѓ, Р±РµР·
 * Р°РЅРёРјР°С†РёРё, РЅРѕ СЃ С‚РѕР№ Р¶Рµ РіРµРѕРјРµС‚СЂРёРµР№ вЂ” layout РЅРµ В«РїСЂС‹РіР°РµС‚В» РјРµР¶РґСѓ СЂРµР¶РёРјР°РјРё.
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { duration as durations, easing, enterDelay } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const OFFSET_Y = 12;

export const FadeInView = ({
  children,
  index = 0,
  delay,
  distance = OFFSET_Y,
  style,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const entered = useSharedValue(0);

  const pause = delay ?? enterDelay(index);

  useEffect(() => {
    if (reduced) {
      entered.value = 1;
      return;
    }

    entered.value = withDelay(
      pause,
      withTiming(1, { duration: durations.enter, easing: easing.enter })
    );
  }, [entered, pause, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entered.value,
    transform: [{ translateY: (1 - entered.value) * distance }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
};

export default FadeInView;

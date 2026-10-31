/**
 * Р•РґРёРЅР°СЏ РєР°СЂС‚РѕС‡РєР° РѕР±СЂР°С‚РЅРѕР№ СЃРІСЏР·Рё РґР»СЏ РѕС‚РІРµС‚Р° РЅР° РІРѕРїСЂРѕСЃ.
 *
 * Р Р°РЅСЊС€Рµ Assessment Рё CaseDetail РїРѕРєР°Р·С‹РІР°Р»Рё СЂРµР·СѓР»СЊС‚Р°С‚ РїРѕ-СЂР°Р·РЅРѕРјСѓ (СЂР°Р·РЅС‹Рµ С„РѕРЅС‹,
 * РѕС‚СЃС‚СѓРїС‹ Рё СЃРїРѕСЃРѕР±С‹ РїРѕРґР°С‡Рё). РўРµРїРµСЂСЊ РѕР±Р° РёСЃРїРѕР»СЊР·СѓСЋС‚ СЌС‚РѕС‚ РєРѕРјРїРѕРЅРµРЅС‚: РѕРЅ РґРµСЂР¶РёС‚
 * РѕРґРёРЅР°РєРѕРІСѓСЋ РіРµРѕРјРµС‚СЂРёСЋ, РѕРґРёРЅР°РєРѕРІС‹Рµ С†РІРµС‚Р° СЃРѕСЃС‚РѕСЏРЅРёР№ Рё РѕРґРёРЅР°РєРѕРІРѕРµ РґРІРёР¶РµРЅРёРµ.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography, elevation } from '../theme/tokens';
import { spring, duration as durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * @param {'correct'|'incorrect'|'neutral'} status
 * @param {string} title
 * @param {string} [body]  Р Р°Р·Р±РѕСЂ / РїРѕСЏСЃРЅРµРЅРёРµ.
 */
export const FeedbackCard = ({ status = 'neutral', title, body, style }) => {
  const reduced = useReducedMotion();
  const appear = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    appear.value = reduced
      ? withTiming(1, { duration: durations.instant })
      : withSpring(1, spring.feedback);
  }, [appear, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.96 + appear.value * 0.04 }],
  }));

  const tone = TONES[status] ?? TONES.neutral;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={body ? `${title}. ${body}` : title}
      style={[styles.card, elevation.card, { backgroundColor: tone.background }, style, animatedStyle]}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: tone.accent }]} />
        <Text style={[styles.title, { color: tone.title }]}>{title}</Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Animated.View>
  );
};

const TONES = {
  correct: { background: colors.successTint, accent: colors.success, title: colors.successDark },
  incorrect: { background: colors.errorTint, accent: colors.error, title: colors.errorDark },
  neutral: { background: colors.goldTint, accent: colors.accent, title: colors.text },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  title: { ...typography.heading, flex: 1 },
  body: { ...typography.body, color: colors.text },
});

export default FeedbackCard;

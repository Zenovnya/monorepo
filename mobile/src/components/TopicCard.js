/**
 * Карточка темы: иллюстрация, название и короткая подпись.
 *
 * Что здесь важно:
 *
 * 1. **Картинка у каждой темы своя.** Шесть тем — шесть рисунков в одном стиле
 *    (хохлома + современный плоский значок). Один и тот же значок на всех темах
 *    выглядел бы как заглушку: тема «Долги и суд» с домиком не запоминается.
 * 2. **Текст ужат до одного акцента.** Карточка несёт название, `focus`
 *    (2–4 слова) и одну строку прогресса — больше текста просто никто не читает.
 * 3. **Прогресс — кружки, а не проценты.** «3/5 уроков» рядом с точками
 *    читается быстрее числа, а процент приоритета практики спрятан в подпись:
 *    это внутренняя метрика, в карточке темы она только путает.
 * 4. **Иллюстрация — в медальоне с толстой нижней границей.** Тот же приём,
 *    что у медальонов уроков: карточка выглядит как предмет, а не как блок текста.
 * 5. **Раскрытие плавное.** Тело карточки появляется/исчезает через Reanimated
 *    (FadeInDown / FadeOut), а шеврон поворачивается на 180° — без скачков.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TactilePressable } from './TactilePressable';
import { brand, serifFamily } from './KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Иллюстрации по id темы.
 *
 * `require` с путями-литералами обязателен: Metro собирает ассеты статически и
 * не умеет `require` от переменной. Здесь это не ограничение, а список: новая
 * тема без картинки сразу видна в коде.
 */
const TOPIC_ART = {
  CIV: require('../../assets/topics/civ.png'),
  POL: require('../../assets/topics/pol.png'),
  BUY: require('../../assets/topics/buy.png'),
  DEBT: require('../../assets/topics/debt.png'),
  HOME: require('../../assets/topics/home.png'),
  WORK: require('../../assets/topics/work.png'),
};

/** Запасной вариант: если сервер добавит тему раньше, чем появится рисунок. */
const FALLBACK_ART = require('../../assets/icon.png');

export function TopicCard({ topic, index, onPress, expanded, children }) {
  const total = topic.lessons_total ?? (topic.lessons?.length || 0);
  const done = topic.lessons_practised ?? 0;
  const art = TOPIC_ART[topic.topic_id] ?? FALLBACK_ART;

  // Поворот шеврона: 0° — свернуто, 180° — раскрыто.
  const chevronRotate = useSharedValue(expanded ? 180 : 0);

  React.useEffect(() => {
    chevronRotate.value = withTiming(expanded ? 180 : 0, { duration: 260 });
  }, [expanded, chevronRotate]);

  const chevronStyle = useAnimatedStyle(
    () => ({ transform: [{ rotate: `${chevronRotate.value}deg` }] }),
    [chevronRotate],
  );

  return (
    <View style={styles.card}>
      <TactilePressable
        onPress={onPress}
        scale={0.985}
        borderDepth={4}
        style={styles.head}
        accessibilityRole="button"
        accessibilityLabel={`Тема ${index + 1}: ${topic.title}. Пройдено ${done} из ${total} уроков`}
      >
        <View style={styles.artWrap}>
          <Image source={art} style={styles.art} resizeMode="cover" />
        </View>

        <View style={styles.headText}>
          <Text style={styles.kicker}>ТЕМА {index + 1}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {topic.title}
          </Text>
          <Text style={styles.focus} numberOfLines={1}>
            {topic.focus ?? topic.subtitle ?? ''}
          </Text>

          <View style={styles.progressRow}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(
                      100,
                      Math.round((done / Math.max(total, 1)) * 100),
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.count}>
              {done}/{total}
            </Text>
          </View>
        </View>

        <Animated.View style={chevronStyle}>
          <ChevronDown size={20} color={brand.muted} />
        </Animated.View>
      </TactilePressable>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.body}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const ART = 84;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: brand.rule,
    borderBottomWidth: 4,
    borderBottomColor: brand.ruleStrong,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  artWrap: {
    width: ART,
    height: ART,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: brand.ruleStrong,
    backgroundColor: brand.cream,
  },
  art: { width: '100%', height: '100%' },
  headText: { flex: 1, gap: 3 },
  kicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '900',
    color: colors.text,
    fontFamily: serifFamily,
    lineHeight: 20,
  },
  focus: { fontSize: 11.5, fontWeight: '700', color: colors.subtext },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 5, backgroundColor: brand.pine },
  count: { fontSize: 10.5, fontWeight: '900', color: brand.subtext },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: brand.rule,
    paddingTop: 10,
  },
});

export default TopicCard;

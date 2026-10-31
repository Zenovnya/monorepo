import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { userApi } from '../api/user';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { FadeInView } from '../components/motion/FadeInView';
import { AnimatedStep } from '../components/motion/AnimatedStep';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { StepDots, GoalCard, MinuteCard } from './onboarding/parts';

const goals = [
  { key: 'rights', label: 'Знать свои права', icon: '🛡️' },
  { key: 'exam', label: 'Учёба / экзамен', icon: '📚' },
  { key: 'pro', label: 'Практика юриста', icon: '⚖️' },
  { key: 'work', label: 'Для работы', icon: '💼' },
];
const minutes = [5, 10, 15];
const STEP_COUNT = 3;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [goal, setGoal] = useState('rights');
  const [mins, setMins] = useState(10);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const reduced = useReducedMotion();
  // Растёт при каждом выборе цели — маскот реагирует на действие.
  const [cheerKey, setCheerKey] = useState(0);
  const scrollRef = useRef(null);

  const goTo = useCallback((next, dir) => {
    setDirection(dir);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const onGoal = (key) => {
    setGoal(key);
    setCheerKey((k) => k + 1);
    if (!reduced) {
      Haptics.selectionAsync();
    }
  };

  const finish = async () => {
    setLoading(true);
    try {
      await userApi.onboard({ goal, minutes: mins });
      // Обновляем пользователя в сторе.
      setUser({ onboarded: true });
    } catch {
      // Игнорируем ошибку сети — онбординг считается пройденным локально.
      setUser({ onboarded: true });
    }
  };

  const primaryLabel =
    step === STEP_COUNT - 1
      ? (loading ? 'Готовим путь…' : 'Начать путь')
      : (step === 0 ? 'Начать' : 'Дальше');

  return (
    <View style={styles.container}>
      <StepDots step={step} count={STEP_COUNT} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedStep step={step} direction={direction} active={step === 0}>
          <View style={styles.centerBlock}>
            {/* Приветственный жест + говорящая реплика. */}
            <AnimatedMascot size={180} wave talking />
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                Привет! Я <Text style={styles.bold}>LexBear</Text>. Научу тебя праву без скуки.
              </Text>
            </View>
            <Text style={styles.title}>Учи законы как в игре</Text>
            <Text style={styles.subtitle}>
              УК, КоАП, ГК, ТК — короткие уроки, живые кейсы и мишка-юрист.
            </Text>
          </View>
        </AnimatedStep>

        <AnimatedStep step={step} direction={direction} active={step === 1}>
          <Text style={styles.title}>Зачем ты здесь?</Text>
          <View style={styles.grid}>
            {goals.map((g, index) => (
              <FadeInView key={g.key} index={index} style={styles.goalCell}>
                <GoalCard
                  icon={g.icon}
                  label={g.label}
                  selected={goal === g.key}
                  onPress={() => onGoal(g.key)}
                />
              </FadeInView>
            ))}
          </View>
        </AnimatedStep>

        <AnimatedStep step={step} direction={direction} active={step === 2}>
          <Text style={styles.title}>Сколько минут в день?</Text>
          <View style={styles.minRow}>
            {minutes.map((m, index) => (
              <FadeInView key={m} index={index} style={styles.minCell}>
                <MinuteCard value={m} selected={mins === m} onPress={() => setMins(m)} />
              </FadeInView>
            ))}
          </View>
          <Text style={styles.subtitle}>Всегда можно поменять в настройках.</Text>
          <View style={styles.cheerMascot}>
            <AnimatedMascot key={cheerKey} size={96} celebrate={cheerKey > 0} emotion="happy" />
          </View>
        </AnimatedStep>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <View style={styles.footerSecondary}>
            <AnimatedButton
              title="Назад"
              variant="outline"
              onPress={() => goTo(step - 1, 'backward')}
            />
          </View>
        ) : null}
        <View style={styles.footerPrimary}>
          <AnimatedButton
            title={primaryLabel}
            loading={loading}
            onPress={() => (step < STEP_COUNT - 1 ? goTo(step + 1, 'forward') : finish())}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  centerBlock: { alignItems: 'center', gap: spacing.base },
  bubble: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    maxWidth: 320,
  },
  bubbleText: { ...typography.body, color: colors.text, textAlign: 'center' },
  bold: { fontWeight: '900' },
  title: { ...typography.display, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 300,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    width: '100%',
    maxWidth: 360,
    justifyContent: 'center',
    marginTop: spacing.base,
  },
  goalCell: { width: '47%' },
  minRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
    maxWidth: 360,
    marginTop: spacing.base,
  },
  minCell: { flex: 1 },
  cheerMascot: { alignItems: 'center', marginTop: spacing.lg },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.sm,
    backgroundColor: colors.background,
  },
  footerSecondary: { flex: 1 },
  footerPrimary: { flex: 2 },
});

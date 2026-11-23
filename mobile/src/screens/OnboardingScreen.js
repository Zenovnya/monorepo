import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,

  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userApi } from '../api/user';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import {
  brand,
  KhokhlomaMedallion,
  KhokhlomaDivider,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const goals = [
  { key: 'rights', label: 'Знать свои права', icon: '🛡️', bg: brand.redSoft },
  { key: 'exam', label: 'Учёба и экзамены', icon: '📚', bg: brand.goldSoft },
  { key: 'pro', label: 'Практика юриста', icon: '⚖️', bg: brand.goldSoft },
  { key: 'work', label: 'Для работы и дел', icon: '💼', bg: brand.pineSoft },
];

const minutes = [5, 10, 15];
const MINUTE_LABELS = {
  5: 'Лёгкий темп',
  10: 'Обычный темп',
  15: 'Серьёзный темп',
};

/**
 * Экран онбординга LexBear:
 * знакомство с проектным мишкой-юристом в медальоне хохломы,
 * тонкий красно-золотой разделитель, чистые карточки выбора на сливочной бумаге (#F7EFDF)
 * и лаково-красная главная кнопка действия (#C9362B).
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('rights');
  const [mins, setMins] = useState(10);
  // Имя можно поправить здесь же: раньше онбординг его не спрашивал вообще,
  // и бэкенд сохранял только цель и минуты.
  const [name, setName] = useState(user?.name ?? '');
  const [loading, setLoading] = useState(false);

  const TOTAL_STEPS = 4;

  const finish = async () => {
    setLoading(true);
    const trimmed = name.trim();
    try {
      await userApi.onboard({
        goal,
        minutes: mins,
        ...(trimmed ? { name: trimmed } : {}),
      });
      setUser({ onboarded: true, ...(trimmed ? { name: trimmed } : {}) });
    } catch {
      // Не блокируем вход из-за сети: имя можно поменять в профиле.
      setUser({ onboarded: true, ...(trimmed ? { name: trimmed } : {}) });
    }
  };

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <View style={styles.container}>
      <PaperGrain />

      {/* Верхняя полоса */}
      <View style={styles.topBar}>
        {step > 0 ? (
          <PressableScale
            onPress={() => setStep((s) => s - 1)}
            hitSlop={10}
            style={styles.backArrowBtn}
          >
            <Text style={styles.backArrow}>←</Text>
          </PressableScale>
        ) : (
          <View style={styles.backArrowSpacer} />
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ШАГ 0: Приветствие мишки в медальоне хохломы */}
        {step === 0 && (
          <View style={styles.welcomeWrap}>
            <View style={styles.bubbleWrap}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  Привет! Я <Text style={styles.brandAccent}>LexBear</Text>.
                  Научу тебя праву ясно и без скуки!
                </Text>
              </View>
              <View style={styles.bubbleTailDown} />
            </View>

            <KhokhlomaMedallion size={196} style={styles.medallion}>
              <AnimatedMascot size={172} wave talking />
            </KhokhlomaMedallion>

            <KhokhlomaDivider style={styles.welcomeDivider} />

            <Text style={styles.heroTitle}>Учите законы как в игре</Text>
            <Text style={styles.subtitle}>
              УК, КоАП, ГК, ТК — короткие уроки, живые кейсы и мишка-юрист.
            </Text>
          </View>
        )}

        {/* ШАГ 1: Выбор цели */}
        {step === 1 && (
          <View style={styles.quizWrap}>
            <View style={styles.characterPrompt}>
              <AnimatedMascot size={84} wave />
              <View style={styles.sideBubbleWrap}>
                <View style={styles.sideBubbleTail} />
                <View style={styles.sideBubble}>
                  <Text style={styles.sideBubbleText}>
                    Какая цель вам ближе?
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.list}>
              {goals.map((g) => {
                const isSel = goal === g.key;
                return (
                  <PressableScale
                    key={g.key}
                    onPress={() => setGoal(g.key)}
                    style={[
                      styles.choiceRow,
                      isSel && styles.cardSelected,
                    ]}
                  >
                    <View
                      style={[styles.goalIconWrap, { backgroundColor: g.bg }]}
                    >
                      <Text style={styles.goalIcon}>{g.icon}</Text>
                    </View>
                    <Text
                      style={[
                        styles.goalLabel,
                        isSel && styles.labelSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                    {isSel ? (
                      <View style={styles.checkCircle}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        )}

        {/* ШАГ 2: Дневной темп */}
        {step === 3 && (
          <View style={styles.quizWrap}>
            <View style={styles.characterPrompt}>
              <AnimatedMascot size={84} wave />
              <View style={styles.sideBubbleWrap}>
                <View style={styles.sideBubbleTail} />
                <View style={styles.sideBubble}>
                  <Text style={styles.sideBubbleText}>
                    Как к вам обращаться?
                  </Text>
                </View>
              </View>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={40}
              placeholder="Ваше имя"
              placeholderTextColor={colors.locked}
              returnKeyType="done"
              onSubmitEditing={finish}
              style={styles.nameInput}
              accessibilityLabel="Имя"
            />

            <Text style={styles.infoFootnote}>
              Имя видно в профиле и в таблице лиги. Поменять можно в любой
              момент.
            </Text>
          </View>
        )}

        {step === 2 && (
          <View style={styles.quizWrap}>
            <View style={styles.characterPrompt}>
              <AnimatedMascot size={84} wave />
              <View style={styles.sideBubbleWrap}>
                <View style={styles.sideBubbleTail} />
                <View style={styles.sideBubble}>
                  <Text style={styles.sideBubbleText}>
                    Сколько минут в день уделим праву?
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.list}>
              {minutes.map((m) => {
                const isSel = mins === m;
                return (
                  <PressableScale
                    key={m}
                    onPress={() => setMins(m)}
                    style={[
                      styles.minRowCard,
                      isSel && styles.cardSelected,
                    ]}
                  >
                    <Text
                      style={[styles.minMain, isSel && styles.labelSelected]}
                    >
                      {m} мин / день
                    </Text>
                    <View
                      style={[
                        styles.minPacePill,
                        isSel && styles.minPacePillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.minPace,
                          isSel && styles.minPaceSelected,
                        ]}
                      >
                        {MINUTE_LABELS[m]}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>

            <Text style={styles.infoFootnote}>
              Темп всегда можно изменить в настройках.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Главная кнопка — Лаковый красный (#C9362B) */}
      <View style={styles.footer}>
        <PressableScale
          style={[
            styles.btnRed,
            loading && styles.btnDisabled,
          ]}
          onPress={
            step < TOTAL_STEPS - 1 ? () => setStep((s) => s + 1) : finish
          }
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {step < TOTAL_STEPS - 1
              ? step === 0
                ? 'Начать'
                : 'Дальше'
              : loading
              ? 'Готовим путь…'
              : 'Начать путь'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowSpacer: {
    width: 4,
  },
  backArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  progressTrack: {
    flex: 1,
    height: 11,
    borderRadius: 999,
    backgroundColor: brand.rule,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  welcomeWrap: {
    alignItems: 'center',
  },
  bubbleWrap: {
    alignItems: 'center',
    marginBottom: 14,
    maxWidth: 300,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.goldBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20.5,
  },
  brandAccent: {
    color: brand.red,
    fontWeight: '800',
  },
  bubbleTailDown: {
    width: 10,
    height: 10,
    backgroundColor: colors.card,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.goldBorder,
    transform: [{ rotate: '45deg' }],
    marginTop: -5,
  },
  medallion: {
    marginVertical: 4,
  },
  welcomeDivider: {
    marginTop: 18,
    marginBottom: 14,
    maxWidth: 210,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  quizWrap: {
    gap: 18,
  },
  characterPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sideBubbleWrap: {
    flex: 1,
    position: 'relative',
  },
  sideBubbleTail: {
    position: 'absolute',
    left: -6,
    top: 16,
    width: 11,
    height: 11,
    backgroundColor: colors.card,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.rule,
    transform: [{ rotate: '45deg' }],
    zIndex: 2,
  },
  sideBubble: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  sideBubbleText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 21,
  },

  list: {
    gap: 10,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  minRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  cardSelected: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  cardPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIcon: {
    fontSize: 20,
  },
  goalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  labelSelected: {
    fontWeight: '800',
    color: brand.ink,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 12,
    fontWeight: '900',
    color: brand.ink,
  },
  minMain: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.text,
  },
  minPacePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: brand.infoSoft,
  },
  minPacePillSelected: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: brand.goldBorder,
  },
  minPace: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.infoInk,
  },
  minPaceSelected: {
    color: brand.goldInk,
  },
  infoFootnote: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.infoInk,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: brand.rule,
  },
  btnRed: {
    height: 52,
    borderRadius: 16,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  btnText: {
    color: brand.creamText,
    fontSize: 14.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
});

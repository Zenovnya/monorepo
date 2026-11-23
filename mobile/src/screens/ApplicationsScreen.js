/**
 * Экран заявлений: шаблоны для юридических заявлений.
 *
 * Пока функция не разработана — здесь заглушка: показываем, что раздел
 * существует и что здесь будут шаблоны (обращения, жалобы, заявления),
 * но они ещё в разработке. Вместо «ничего нет» — понятное объяснение
 * и поминальный маскот, чтобы не казалось, что кнопка сломана.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { WaxSeal, KhokhlomaCorners, PaperGrain } from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { brand } from '../components/KhokhlomaOrnament';

/**
 * Шаблоны заявлений, которые здесь появятся (пока просто перечисление
 * для видимости структуры — реальные формы ещё не готовы).
 */
const TEMPLATES = [
  { id: 'complaint', title: 'Жалоба', hint: 'На незаконные действия чиновников' },
  { id: 'appeal', title: 'Обращение', hint: 'В орган власти с просьбой' },
  { id: 'statement', title: 'Заявление', hint: 'С просьбой принять меры' },
];

export default function ApplicationsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: 34 + insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      <View style={styles.header}>
        <KhokhlomaCorners variant="light" size="md" inset={9} />
        <WaxSeal label="§" tone="gold" size={52} />
        <Text style={styles.eyebrow}>ЗАЯВЛЕНИЯ</Text>
        <Text style={styles.title}>Шаблоны заявлений</Text>
        <Text style={styles.subtitle}>
          Здесь будут готовые шаблоны: жалобы, обращения и заявления —
          с подсказками и заполнением под вашу ситуацию.
        </Text>
      </View>

      {/* Заглушка: раздел есть, но шаблоны ещё в разработке. */}
      <View style={styles.placeholderCard}>
        <KhokhlomaCorners variant="light" size="sm" inset={7} />
        <AnimatedMascot size={120} thinking />
        <Text style={styles.placeholderTitle}>В разработке</Text>
        <Text style={styles.placeholderText}>
          Формы заявлений ещё не готовы. Здесь появятся шаблоны с
          шагами, которые можно будет заполнить и отправить.
        </Text>
      </View>

      {/* Список будущих шаблонов — структура видна, само заполнение пока
          недоступно. */}
      <View style={styles.templateList}>
        {TEMPLATES.map((t) => (
          <PressableScale
            key={t.id}
            disabled
            style={styles.templateRow}
          >
            <WaxSeal label="§" tone="red" size={36} />
            <View style={styles.templateBody}>
              <Text style={styles.templateTitle}>{t.title}</Text>
              <Text style={styles.templateHint}>{t.hint}</Text>
            </View>
            <Text style={styles.soon}>в разработке</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 112, paddingHorizontal: 18 },
  header: {
    alignItems: 'center',
    gap: 10,
    marginTop: 28,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: brand.goldInk,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  placeholderCard: {
    position: 'relative',
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.6,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    paddingVertical: 26,
    paddingHorizontal: 20,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  placeholderText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  templateList: {
    marginTop: 20,
    gap: 10,
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 15,
    opacity: 0.7,
  },
  templateBody: { flex: 1, gap: 2 },
  templateTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  templateHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.subtext,
  },
  soon: {
    fontSize: 11,
    fontWeight: '700',
    color: brand.goldInk,
  },
});

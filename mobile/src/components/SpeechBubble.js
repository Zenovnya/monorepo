import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Речевой пузырь для маскота Lex.
 * Показывает фразу и эмоцию в игровом стиле LexBear.
 */
export const SpeechBubble = ({ text }) => {
  if (!text) return null;
  return (
    <View style={styles.bubble}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 280,
    position: 'relative',
  },
  text: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
});
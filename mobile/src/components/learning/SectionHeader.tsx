/**
 * SectionHeader — липкий заголовок раздела дорожной карты.
 *
 * Делает акцент на теме раздела и короткой подсказке, поэтому
 * остаётся на экране при скролле — пользователь всегда видит,
 * в каком разделе currently находится.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    marginBottom: 4,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.track,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: colors.subtext,
    fontWeight: '500',
  },
});

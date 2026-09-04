import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { splitLegalRefs } from '../utils/legalLinks';

/**
 * Обычный <Text>, но упоминания статей/законов/постановлений
 * автоматически превращаются в кликабельные ссылки на поиск в
 * Консультант Плюс. Пример: «Ст. 158 УК РФ», «353-ФЗ», «ПП РФ №354».
 *
 * Использование:
 *   <LegalText style={styles.hintText}>{caseData.hint}</LegalText>
 */
export function LegalText({ children, style, linkStyle }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const parts = splitLegalRefs(text);

  if (parts.length <= 1) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.url ? (
          <Text
            key={i}
            style={[styles.link, linkStyle]}
            onPress={() => Linking.openURL(p.url)}
          >
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.skyDark,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
});

export default LegalText;

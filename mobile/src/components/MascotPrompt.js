/**
 * Маскот рядом с вопросом: «Мишка задаёт вопрос».
 *
 * Зачем отдельный компонент, а не `<AnimatedMascot />` на месте:
 *
 * 1. Маскот нужен в двух разных местах (кейс в «Адаптивном» и проверка в
 *    уроке), и в обоих он должен выглядеть одинаково. Копия разметки в двух
 *    экранах разъедется при первой же правке.
 * 2. Эмоция выводится из состояния, а не задаётся вручную. Правило одно и то
 *    же везде: ждём ответа — задумчивый, ответ дан — радуется или сочувствует,
 *    была подсказка — «строгий». Если бы каждый экран решал сам, на одном
 *    экране мишка радовался бы неверному ответу.
 * 3. Размер и выравнивание фиксированы: маскот не должен влиять на высоту
 *    карточки вопроса, иначе кнопки «прыгают» при смене эмоции.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedMascot } from './AnimatedMascot';
import { SpeechBubble } from './SpeechBubble';

/**
 * @param {string}  text      Что Мишка «говорит». Пустая строка — без пузыря.
 * @param {object}  result    Ответ сервера (null, пока ответа нет).
 * @param {boolean} assisted  Была подсказка.
 * @param {number}  size      Размер маскота; по умолчанию компактный.
 */
export function MascotPrompt({ text, result, assisted = false, size = 76, style }) {
  /*
   * Порядок проверок важен: подсказка перекрывает радость. Ответ после
   * подсказки не засчитан, и улыбающийся маскот здесь был бы враньём о
   * результате — человек прочитал бы улыбку как «верно».
   */
  let emotion = 'thinking';
  if (assisted && !result) emotion = 'strict';
  else if (result) {
    if (result.correct === true) emotion = 'happy';
    else if (result.correct === false) emotion = 'sad';
    else emotion = 'thinking';
  }

  return (
    <View style={[styles.row, style]}>
      <AnimatedMascot size={size} emotion={emotion} />
      {text ? (
        <View style={styles.bubble}>
          <SpeechBubble text={text} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // По нижнему краю: пузырь должен «расти» вверх от маскота, а не тянуть
    // его за собой.
    alignItems: 'flex-end',
    gap: 10,
  },
  bubble: {
    flex: 1,
    // Небольшой отступ снизу прижимает пузырь к «морде», а не к лапам.
    paddingBottom: 8,
  },
});

export default MascotPrompt;

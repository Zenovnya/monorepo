/**
 * LearningPath — дорожная карта уроков в стиле Duolingo.
 *
 * Змейка собирается из узлов PathNode и соединительной линии
 * PathConnector:
 * - горизонтальное положение каждого узла динамическое — по
 *   синусоиде Math.sin(index * 0.85) * (SCREEN_WIDTH * 0.28),
 *   жесткие координаты не используются;
 * - линия — кубические Безье (react-native-svg), два слоя:
 *   track + анимированный прогресс до активного урока;
 * - FlatList с липким заголовком текущего раздела;
 * - активный узел воспроизводит вибрацию при появлении.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/colors';
import { colors as tokenColors } from '../../theme/tokens';
import { PathConnector } from './PathConnector';
import { PathNode } from './PathNode';
import { SectionHeader } from './SectionHeader';
import type { RoadmapSection } from './mockRoadmap';

/** Размер узла PathNode — совпадает с PathNode/PathConnector. */
const NODE_SIZE = 56;
/** Отступ между узлами — совпадает с marginBottom у PathNode. */
const NODE_GAP = 24;
/** Амплитуда изгиба змейки — 28% ширины экрана. */
const SINE_AMPLITUDE = 0.28;
/** Частота синусоиды — сдвиг каждого узла по горизонтали. */
const SINE_FREQ = 0.85;

interface LearningPathProps {
  sections: RoadmapSection[];
  onStepPress?: (stepId: string) => void;
}

interface FlattenedStep {
  sectionIndex: number;
  section: RoadmapSection;
  stepIndex: number;
  step: RoadmapSection['steps'][number];
  /** Глобальный индекс по всему списку узлов — для синусоиды. */
  globalIndex: number;
  /** Центр узла в координатах змейки. */
  x: number;
  y: number;
}

interface HeaderItem {
  type: 'header';
  key: string;
  section: RoadmapSection;
}

interface NodeItem {
  type: 'node';
  key: string;
  data: FlattenedStep;
}

type FlatItem = HeaderItem | NodeItem;

export function LearningPath({ sections, onStepPress }: LearningPathProps) {
  const { width } = useWindowDimensions();
  const amp = width * SINE_AMPLITUDE;

  const layout = useMemo<{ nodes: FlattenedStep[]; centers: Array<{ x: number; y: number }> }>(() => {
    const nodes: FlattenedStep[] = [];
    const centers: Array<{ x: number; y: number }> = [];
    let globalIndex = 0;

    sections.forEach((section, sectionIndex) => {
      section.steps.forEach((step, stepIndex) => {
        // Динамический горизонтальный сдвиг по синусоиде —
        // без жестко заданных координат.
        const offsetX = Math.sin(globalIndex * SINE_FREQ) * amp;
        const x = width / 2 + offsetX;
        const y = NODE_SIZE / 2 + globalIndex * (NODE_SIZE + NODE_GAP);

        centers.push({ x, y });
        nodes.push({
          sectionIndex,
          section,
          stepIndex,
          step,
          globalIndex,
          x,
          y,
        });
        globalIndex += 1;
      });
    });

    return { nodes, centers };
  }, [sections, width, amp]);

  // Прогресс змейки — до активного узла по всему списку.
  const activeIndex = layout.nodes.findIndex((item) => item.step.state === 'active');
  const completedCount = layout.nodes.filter(
    (item) => item.step.state === 'completed',
  ).length;
  const progressIndex = activeIndex >= 0 ? activeIndex : completedCount;

  // Вибрация при появлении активного узла.
  const activeNode = activeIndex >= 0 ? layout.nodes[activeIndex] : undefined;
  useEffect(() => {
    if (activeNode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [activeNode]);

  const handleNodePress = useCallback(
    (step: RoadmapSection['steps'][number]) => {
      if (step.state === 'active' && onStepPress) {
        onStepPress(step.id);
      }
    },
    [onStepPress],
  );

  const flatData = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    sections.forEach((section) => {
      out.push({ type: 'header', key: `section:${section.id}`, section });
      layout.nodes
        .filter((node) => node.section.id === section.id)
        .forEach((node) => {
          out.push({
            type: 'node',
            key: `step:${node.step.id}`,
            data: node,
          });
        });
    });
    return out;
  }, [sections, layout]);

  const keyExtractor = useCallback((item: FlatItem) => item.key, []);

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => {
      if (item.type === 'header') {
        return <SectionHeader title={item.section.title} subtitle={item.section.subtitle} />;
      }

      const node = item.data;
      return (
        <View style={styles.row}>
          {node.globalIndex === 0 && (
            <View style={styles.lineSlot} pointerEvents="none">
              <PathConnector
                points={layout.centers}
                progressIndex={progressIndex}
              />
            </View>
          )}
          <View style={styles.nodeRow}>
            <PathNode
              index={node.globalIndex}
              title={node.step.title}
              state={node.step.state}
              onPress={() => handleNodePress(node.step)}
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.stepTitle} numberOfLines={1}>
              {node.step.title}
            </Text>
            <Text style={styles.stepDesc} numberOfLines={1}>
              {node.step.description}
            </Text>
            <Text style={styles.stepReward}>{node.step.reward}</Text>
          </View>
        </View>
      );
    },
    [layout.centers, progressIndex, handleNodePress],
  );

  // Липкие заголовки — индексы строк-заголовков.
  const stickyHeaderIndices = useMemo(
    () =>
      flatData
        .map((item, index) => (item.type === 'header' ? index : -1))
        .filter((index) => index >= 0),
    [flatData],
  );

  return (
    <FlatList
      data={flatData}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={stickyHeaderIndices}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeRow: {
    width: NODE_SIZE + 28,
  },
  lineSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  metaRow: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: NODE_GAP,
    paddingHorizontal: 4,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  stepDesc: {
    marginTop: 2,
    fontSize: 12.5,
    color: colors.subtext,
  },
  stepReward: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: tokenColors.gold,
  },
});

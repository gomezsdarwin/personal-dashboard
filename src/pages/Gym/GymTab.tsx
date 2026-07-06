import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppShell } from '../../components/AppShell';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { SPLITS, todaySplit } from '../../data/workouts';
import { LogTab } from './LogTab';
import { StatsTab } from './StatsTab';
import { GraphTab } from './GraphTab';

/**
 * GymTab — shell per FitnessTab spec §5. Owns `activeTab` and renders the
 * 3-way sub-nav (LOG / STATS / GRAPH) above the active tab's content.
 * STATS and GRAPH are placeholders here — phases 4/5 replace them.
 */

type GymSubTab = 'LOG' | 'STATS' | 'GRAPH';
const GYM_TABS: GymSubTab[] = ['LOG', 'STATS', 'GRAPH'];

export default function GymTab() {
  const { palette } = useTheme();
  const [activeTab, setActiveTab] = useState<GymSubTab>('LOG');

  const splitId = todaySplit();
  const splitLabel = splitId ? SPLITS.find((s) => s.id === splitId)?.label ?? splitId : 'Rest day';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text.primaryAlt }]}>Gym</Text>
        <Text style={[styles.subtitle, { color: palette.text.secondaryAlt }]}>{`${splitLabel} · ${dateLabel}`}</Text>
      </View>

      <View style={[styles.subNav, { borderBottomColor: palette.hairline }]}>
        {GYM_TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable key={tab} style={styles.subNavItem} onPress={() => setActiveTab(tab)}>
              <Text
                style={[
                  styles.subNavLabel,
                  { color: active ? palette.accentText : palette.text.tertiary },
                ]}
              >
                {tab}
              </Text>
              <View
                style={[
                  styles.subNavIndicator,
                  { backgroundColor: active ? palette.accentText : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* key={activeTab} forces a fresh mount per switch, mirroring the spec's
          fadeUp-replay-on-switch behavior (AppShell already animates mount-in). */}
      <View key={activeTab} style={styles.content}>
        {activeTab === 'LOG' && <LogTab />}
        {activeTab === 'STATS' && <StatsTab />}
        {activeTab === 'GRAPH' && <GraphTab />}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: type.screenTitle.fontSize,
    fontWeight: type.screenTitle.fontWeight,
    letterSpacing: type.screenTitle.letterSpacing,
  },
  subtitle: {
    fontSize: type.body.fontSize,
    marginTop: 4,
  },
  subNav: {
    flexDirection: 'row',
    gap: 22,
    paddingHorizontal: 4,
    paddingBottom: 10,
    marginBottom: 18,
    borderBottomWidth: 1,
  },
  subNavItem: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  subNavLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  subNavIndicator: {
    marginTop: 6,
    height: 1.5,
    width: 18,
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
});

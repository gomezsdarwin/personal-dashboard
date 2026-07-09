import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppShell } from '../../components/AppShell';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useRepo } from '../../hooks/useRepo';
import { SPLITS, todaySplit } from '../../data/workouts';
import { LogTab } from './LogTab';
import { StatsTab } from './StatsTab';

/**
 * GymTab — shell per FitnessTab spec §5. Owns `activeTab` and renders the
 * 2-way sub-nav (LOG / STATS) above the active tab's content. STATS now
 * absorbs the former GRAPH tab's per-exercise chart content (see StatsTab.tsx).
 */

type GymSubTab = 'LOG' | 'STATS';
const GYM_TABS: GymSubTab[] = ['LOG', 'STATS'];

export default function GymTab() {
  const { palette } = useTheme();
  const [activeTab, setActiveTab] = useState<GymSubTab>('LOG');
  const configRepo = useRepo('gym_split_config');

  const splitId = todaySplit();
  const labelOverride = splitId ? configRepo.rows.find((c) => c.split_id === splitId)?.label : null;
  const splitLabel = splitId ? labelOverride || SPLITS.find((s) => s.id === splitId)?.label || splitId : 'No split selected';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AppShell>
      <View style={styles.header}>
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
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 4,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: type.body.fontSize,
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

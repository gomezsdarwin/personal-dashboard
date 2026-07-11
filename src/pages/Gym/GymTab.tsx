import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppShell } from '../../components/AppShell';
import { GlassChip } from '../../components/GlassChip';
import { spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useRepo } from '../../hooks/useRepo';
import { SPLITS, todaySplit } from '../../data/workouts';
import { todayIso } from '../../lib/week';
import { LogTab } from './LogTab';
import { StatsTab } from './StatsTab';

/** Whole-day difference between two "YYYY-MM-DD" strings (local-calendar-safe,
 * matching StatsTab's identically-named helper — kept local here since
 * GymTab and StatsTab are separate small consumers of the same one-liner). */
function daysBetween(fromDate: string, toDate: string): number {
  const d1 = new Date(`${fromDate}T00:00:00`);
  const d2 = new Date(`${toDate}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

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
  const { rows: sessions } = useRepo('gym_sessions');

  const splitId = todaySplit();
  const labelOverride = splitId ? configRepo.rows.find((c) => c.split_id === splitId)?.label : null;
  const splitLabel = splitId ? labelOverride || SPLITS.find((s) => s.id === splitId)?.label || splitId : 'No split selected';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Feature 1 — "Next up" chip: most recent gym_sessions date vs. today, plus
  // the split todaySplit() already resolves for the header line above.
  const today = useMemo(() => todayIso(), []);
  const lastSessionDate = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), sessions[0].date);
  }, [sessions]);
  const daysSinceLast = lastSessionDate != null ? Math.max(0, daysBetween(lastSessionDate, today)) : null;
  const lastTrainedLabel =
    daysSinceLast == null ? null : daysSinceLast === 0 ? 'today' : daysSinceLast === 1 ? '1 day ago' : `${daysSinceLast} days ago`;
  const nextUpLabel =
    lastTrainedLabel == null ? `Next up: ${splitLabel}` : `Last trained: ${lastTrainedLabel} · Next up: ${splitLabel}`;

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: palette.text.secondaryAlt }]}>{`${splitLabel} · ${dateLabel}`}</Text>
        <GlassChip style={styles.nextUpChip} contentStyle={styles.nextUpChipContent}>
          <Text style={[styles.nextUpText, { color: palette.text.secondary }]} numberOfLines={1}>
            {nextUpLabel}
          </Text>
        </GlassChip>
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

      {/* LogTab stays mounted across sub-tab switches so in-progress logging
          isn't wiped (see Package B fix #4); StatsTab still remounts per
          switch for the fadeUp-replay behavior. */}
      <View style={styles.content}>
        <View style={activeTab === 'LOG' ? undefined : styles.hiddenPane}>
          <LogTab />
        </View>
        {activeTab === 'STATS' && <StatsTab key={activeTab} />}
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
  nextUpChip: {
    marginTop: spacing.rowGapSm,
    alignSelf: 'flex-start',
  },
  nextUpChipContent: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nextUpText: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
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
  hiddenPane: {
    display: 'none',
  },
});

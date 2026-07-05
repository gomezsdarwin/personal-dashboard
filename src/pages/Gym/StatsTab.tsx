import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { color, spacing, type } from '../../theme/tokens';
import { useRepo } from '../../hooks/useRepo';
import { SPLITS } from '../../data/workouts';
import type { GymSessionRow, GymSet } from '../../lib/types';

/**
 * StatsTab — read-only session history + progress trends, per FitnessTab
 * spec §7. No set-logging state machine here; just derived summaries over
 * `gym_sessions`. Demo data is already seeded by LogTab's `useRepo`
 * call-site, so this hook intentionally omits fixtures (see task notes).
 */

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const d1 = new Date(`${fromDate}T00:00:00`);
  const d2 = new Date(`${toDate}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function relativeDate(dateStr: string, today: string): string {
  const days = daysBetween(dateStr, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function repsSummary(sets: GymSet[]): string {
  return sets.map((s) => (s.reps === '' || s.reps == null ? '—' : String(s.reps))).join(' ');
}

// ---------------------------------------------------------------------------
// Progress trends (spec §7 para 2)
// ---------------------------------------------------------------------------

type TrendRow = { name: string; values: (number | string)[] };

function buildTrends(sessions: GymSessionRow[]): TrendRow[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const names = new Set<string>();
  for (const s of sorted) for (const ex of s.exercises) names.add(ex.name);

  const rows: TrendRow[] = [];
  for (const name of names) {
    const values: (number | string)[] = [];
    for (const s of sorted) {
      const weight = s.exercises.find((e) => e.name === name)?.sets[0]?.weight;
      if (weight == null || weight === '') continue;
      const last = values[values.length - 1];
      if (last === undefined || last !== weight) values.push(weight);
    }
    const last3 = values.slice(-3);
    if (last3.length >= 2) rows.push({ name, values: last3 });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function trendDirection(values: (number | string)[]): 'up' | 'down' | 'flat' {
  const a = Number(values[values.length - 2]);
  const b = Number(values[values.length - 1]);
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'flat';
}

// ---------------------------------------------------------------------------
// StatsTab
// ---------------------------------------------------------------------------

export function StatsTab() {
  const { rows: sessions } = useRepo('gym_sessions');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const today = useMemo(() => todayIso(), []);
  const currentYearMonth = today.slice(0, 7);

  const sortedNewestFirst = useMemo(
    () => [...sessions].sort((a, b) => b.date.localeCompare(a.date)),
    [sessions]
  );

  const totalSessions = sessions.length;
  const sessionsThisMonth = sessions.filter((s) => s.date.startsWith(currentYearMonth)).length;
  const daysSinceLast =
    sortedNewestFirst.length > 0 ? Math.max(0, daysBetween(sortedNewestFirst[0].date, today)) : null;

  const trends = useMemo(() => buildTrends(sessions), [sessions]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <View>
      <View style={styles.summaryRow}>
        <GlassChip style={styles.summaryChip} contentStyle={styles.summaryChipContent}>
          <Text style={styles.summaryValue}>{totalSessions}</Text>
          <Text style={styles.summaryLabel}>Sessions</Text>
        </GlassChip>
        <GlassChip style={styles.summaryChip} contentStyle={styles.summaryChipContent}>
          <Text style={styles.summaryValue}>{sessionsThisMonth}</Text>
          <Text style={styles.summaryLabel}>This month</Text>
        </GlassChip>
        <GlassChip style={styles.summaryChip} contentStyle={styles.summaryChipContent}>
          <Text style={styles.summaryValue}>{daysSinceLast == null ? '—' : daysSinceLast === 0 ? 'Today' : `${daysSinceLast}d`}</Text>
          <Text style={styles.summaryLabel}>Last session</Text>
        </GlassChip>
      </View>

      {trends.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress trends</Text>
          <GlassCard>
            {trends.map((row, i) => {
              const dir = trendDirection(row.values);
              return (
                <View
                  key={row.name}
                  style={[styles.trendRow, i > 0 && styles.trendRowDivider]}
                >
                  <Text style={styles.trendName} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <View style={styles.trendValues}>
                    {row.values.map((v, vi) => (
                      <React.Fragment key={vi}>
                        {vi > 0 && <Text style={styles.trendArrowSep}>→</Text>}
                        <Text style={[styles.trendValue, vi === row.values.length - 1 && styles.trendValueLast]}>
                          {v}
                        </Text>
                      </React.Fragment>
                    ))}
                    <Text
                      style={[
                        styles.trendDirection,
                        dir === 'up' && styles.trendDirectionUp,
                        dir === 'down' && styles.trendDirectionDown,
                      ]}
                    >
                      {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session history</Text>
        {sortedNewestFirst.length === 0 ? (
          <GlassCard>
            <Text style={styles.emptyText}>No sessions logged yet</Text>
          </GlassCard>
        ) : (
          sortedNewestFirst.map((session) => {
            const key = `${session.date}-${session.split}`;
            const isOpen = expanded.has(key);
            const splitLabel = SPLITS.find((s) => s.id === session.split)?.label ?? session.split;
            return (
              <GlassCard key={key} style={styles.sessionCard}>
                <Pressable onPress={() => toggle(key)} style={styles.sessionHeader}>
                  <View style={styles.sessionHeaderLeft}>
                    <Text style={styles.sessionSplit}>{splitLabel}</Text>
                    <Text style={styles.sessionMeta}>{`${session.exercises.length} exercises`}</Text>
                  </View>
                  <View style={styles.sessionHeaderRight}>
                    <Text style={styles.sessionDate}>{relativeDate(session.date, today)}</Text>
                    <Text style={styles.sessionChevron}>{isOpen ? '▾' : '▸'}</Text>
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={styles.sessionBody}>
                    {session.exercises.map((ex, i) => (
                      <View key={`${ex.id}-${i}`} style={styles.exerciseRow}>
                        <Text style={styles.exerciseRowName} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        <Text style={styles.exerciseRowWeight}>{`${ex.sets[0]?.weight ?? '—'} lbs`}</Text>
                        <Text style={styles.exerciseRowReps}>{repsSummary(ex.sets)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </GlassCard>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.rowGapSm,
    marginBottom: spacing.rowGapLg,
  },
  summaryChip: {
    flex: 1,
  },
  summaryChipContent: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: color.text.primaryAlt,
  },
  summaryLabel: {
    fontSize: type.caption.fontSize,
    color: color.text.tertiary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.rowGapLg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: color.text.tertiary,
    marginBottom: spacing.rowGapSm,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  trendRowDivider: {
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  trendName: {
    flex: 1,
    fontSize: type.bodyMedium.fontSize,
    fontWeight: '500',
    color: color.text.secondary,
    marginRight: 8,
  },
  trendValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendArrowSep: {
    fontSize: 11,
    color: color.text.faint,
  },
  trendValue: {
    fontSize: type.meta.fontSize,
    color: color.text.dimmed,
  },
  trendValueLast: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: color.accentText,
  },
  trendDirection: {
    fontSize: 14,
    fontWeight: '700',
    color: color.text.tertiary,
    marginLeft: 4,
  },
  trendDirectionUp: {
    color: color.success,
  },
  trendDirectionDown: {
    color: color.danger,
  },
  emptyText: {
    fontSize: type.body.fontSize,
    color: color.text.tertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  sessionCard: {
    marginBottom: spacing.rowGapMd,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionHeaderLeft: {
    flexShrink: 1,
  },
  sessionSplit: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: '700',
    color: color.text.primaryAlt,
  },
  sessionMeta: {
    fontSize: type.caption.fontSize,
    color: color.text.tertiary,
    marginTop: 2,
  },
  sessionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDate: {
    fontSize: type.meta.fontSize,
    color: color.text.secondary,
  },
  sessionChevron: {
    fontSize: 13,
    color: color.text.tertiary,
  },
  sessionBody: {
    marginTop: spacing.rowGapSm,
    paddingTop: spacing.rowGapSm,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseRowName: {
    flex: 1,
    fontSize: type.meta.fontSize,
    fontWeight: '600',
    color: color.text.secondary,
  },
  exerciseRowWeight: {
    fontSize: type.meta.fontSize,
    color: color.text.tertiary,
  },
  exerciseRowReps: {
    fontSize: type.meta.fontSize,
    fontFamily: undefined,
    color: color.text.quaternary,
    minWidth: 60,
    textAlign: 'right',
  },
});

export default StatsTab;

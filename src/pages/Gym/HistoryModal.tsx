import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { color, radius, spacing, type } from '../../theme/tokens';
import type { GymSessionRow, GymSet } from '../../lib/types';

/**
 * HistoryModal — bottom-sheet overlay opened from LogTab's "↗ History"
 * button, per FitnessTab spec §9. Unlike the original web spec (which reads
 * a separately-maintained `exerciseHistory` map built by LogTab), this port
 * computes the per-exercise history itself from a `sessions` prop LogTab
 * already has loaded (via `sessionsRepo.rows`) — avoids a second
 * `useRepo('gym_sessions')` subscription for the same table.
 */

// ---------------------------------------------------------------------------
// Local date helpers (spec §10 — no shared date utility module; each file
// re-implements these, matching GraphTab.tsx/StatsTab.tsx conventions).
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  const d1 = new Date(`${fromDate}T00:00:00`);
  const d2 = new Date(`${toDate}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Data derivation (spec §9)
// ---------------------------------------------------------------------------

export type HistoryModalExercise = { id: string; name: string };

type HistoryEntry = { date: string; weight: number; sets: GymSet[] };

const RANGES: { label: string; days: number | null }[] = [
  { label: 'W', days: 7 },
  { label: 'M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: 'Y', days: 365 },
  { label: 'ALL', days: null },
];

function firstSetWeight(setsWeight: number | string | undefined): number {
  const n = Number(setsWeight);
  return Number.isFinite(n) ? n : NaN;
}

/** Mean of `reps` across sets with reps > 0; null if none valid. */
function avgReps(sets: GymSet[]): number | null {
  const valid = sets.map((s) => Number(s.reps)).filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function totalReps(sets: GymSet[]): number {
  return sets.reduce((sum, s) => {
    const n = Number(s.reps);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

/** Walk sessions oldest->newest, matching by exercise id (not name, since
 * History is opened from a specific exercise card instance — spec §9 intro). */
function buildHistory(sessions: GymSessionRow[], exerciseId: string): HistoryEntry[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const result: HistoryEntry[] = [];
  for (const session of sorted) {
    const ex = session.exercises.find((e) => e.id === exerciseId);
    if (!ex) continue;
    const w = firstSetWeight(ex.sets[0]?.weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    const entry: HistoryEntry = { date: session.date, weight: w, sets: ex.sets };
    const last = result[result.length - 1];
    if (last && last.date === session.date) {
      result[result.length - 1] = entry;
    } else {
      result.push(entry);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// HistoryModal
// ---------------------------------------------------------------------------

export function HistoryModal({
  exercise,
  sessions,
  onClose,
}: {
  exercise: HistoryModalExercise;
  sessions: GymSessionRow[];
  onClose: () => void;
}) {
  const [range, setRange] = useState<string>('ALL');

  const history = useMemo(() => buildHistory(sessions, exercise.id), [sessions, exercise.id]);
  const today = useMemo(() => todayIso(), []);

  const rangeDef = RANGES.find((r) => r.label === range) ?? RANGES[RANGES.length - 1];
  const filtered = useMemo(() => {
    if (rangeDef.days == null) return history;
    return history.filter((h) => daysBetween(h.date, today) <= rangeDef.days!);
  }, [history, rangeDef, today]);

  const last = history[history.length - 1] ?? null;
  const bestWeight = history.length > 0 ? Math.max(...history.map((h) => h.weight)) : 0;

  const hasRangeSummary = filtered.length >= 2;
  const rangeWeightDelta = hasRangeSummary ? filtered[filtered.length - 1].weight - filtered[0].weight : 0;

  const firstAvg = hasRangeSummary ? avgReps(filtered[0].sets) : null;
  const lastAvgInRange = hasRangeSummary ? avgReps(filtered[filtered.length - 1].sets) : null;
  const showRepsDelta = hasRangeSummary && ((firstAvg ?? 0) !== 0 || (lastAvgInRange ?? 0) !== 0);
  const rangeRepsDelta = showRepsDelta ? (lastAvgInRange ?? 0) - (firstAvg ?? 0) : 0;

  // Session table: unfiltered, chronological deltas computed first, then
  // reversed for newest-first display (spec §9 layout item 8).
  const tableRows = useMemo(() => {
    return history
      .map((h, i) => ({
        entry: h,
        delta: i === 0 ? null : h.weight - history[i - 1].weight,
      }))
      .reverse();
  }, [history]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.headerLabel}>history</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {exercise.name}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyText}>No history logged for this exercise yet.</Text>
          ) : (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              <View style={styles.rangeRow}>
                {RANGES.map((r) => {
                  const active = r.label === range;
                  return (
                    <Pressable
                      key={r.label}
                      style={[styles.rangePill, active && styles.rangePillActive]}
                      onPress={() => setRange(r.label)}
                    >
                      <Text style={[styles.rangePillText, active && styles.rangePillTextActive]}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Chart filtered={filtered} />

              {hasRangeSummary && (
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryPill, { backgroundColor: rangeWeightDelta >= 0 ? color.successBg : color.dangerBg }]}>
                    <Text style={[styles.summaryPillText, { color: rangeWeightDelta >= 0 ? color.success : color.danger }]}>
                      {`${rangeWeightDelta >= 0 ? '+' : ''}${rangeWeightDelta} lbs`}
                    </Text>
                  </View>
                  {showRepsDelta && (
                    <View style={[styles.summaryPill, { backgroundColor: rangeRepsDelta >= 0 ? color.successBg : color.dangerBg }]}>
                      <Text style={[styles.summaryPillText, { color: rangeRepsDelta >= 0 ? color.success : color.danger }]}>
                        {`${rangeRepsDelta >= 0 ? '+' : ''}${rangeRepsDelta.toFixed(1)} reps`}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.summaryCaption}>{rangeDef.days == null ? 'all time' : `${range} range`}</Text>
                </View>
              )}

              {last && (
                <View style={styles.lastRow}>
                  <View style={styles.lastRowLeft}>
                    <Text style={styles.lastDate}>{fmtDate(last.date)}</Text>
                    <View style={styles.lastPillRow}>
                      {last.sets.map((s, i) => {
                        const n = Number(s.reps);
                        const valid = Number.isFinite(n) && n > 0;
                        return (
                          <View key={i} style={styles.lastPill}>
                            <Text style={styles.lastPillText}>{valid ? n : '—'}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={styles.lastTotal}>{`${totalReps(last.sets)} reps`}</Text>
                </View>
              )}

              <View style={styles.statsStrip}>
                <StatTile label="SESSIONS" value={String(filtered.length)} />
                <StatTile
                  label="WEIGHT Δ"
                  value={`${rangeWeightDelta >= 0 ? '+' : ''}${rangeWeightDelta}`}
                  color={rangeWeightDelta > 0 ? color.success : rangeWeightDelta < 0 ? color.danger : color.text.secondary}
                />
                <StatTile
                  label="REPS Δ"
                  value={`${rangeRepsDelta >= 0 ? '+' : ''}${rangeRepsDelta.toFixed(1)}`}
                  color={rangeRepsDelta > 0 ? color.success : rangeRepsDelta < 0 ? color.danger : color.text.secondary}
                />
              </View>

              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, styles.tableColDate]}>DATE</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColReps]}>REPS</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColWeight]}>WEIGHT</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColChange]}>CHANGE</Text>
                </View>
                {tableRows.map(({ entry, delta }, i) => {
                  const isBest = entry.weight === bestWeight;
                  const changeLabel =
                    delta == null ? 'first' : delta === 0 ? '+0' : `${delta > 0 ? '+' : ''}${delta}`;
                  const changeColor = delta == null ? color.text.tertiary : delta > 0 ? color.success : delta < 0 ? color.danger : color.text.tertiary;
                  return (
                    <View key={`${entry.date}-${i}`} style={[styles.tableRow, i > 0 && styles.tableRowDivider]}>
                      <Text style={[styles.tableCellText, styles.tableColDate]} numberOfLines={1}>
                        {fmtDate(entry.date)}
                      </Text>
                      <Text style={[styles.tableCellText, styles.tableColReps]}>{totalReps(entry.sets)}</Text>
                      <Text
                        style={[
                          styles.tableCellText,
                          styles.tableColWeight,
                          isBest && styles.tableCellBest,
                        ]}
                      >
                        {isBest ? `★ ${entry.weight}` : entry.weight}
                      </Text>
                      <Text style={[styles.tableCellText, styles.tableColChange, { color: changeColor }]}>
                        {changeLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatTile({ label, value, color: valueColor }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chart (spec §9.1) — dual-axis SVG, following GraphTab.tsx's conventions:
// overlaid RN <Text> for labels, tap-to-pin (no hover), Svg/Path/Line/Circle
// from react-native-svg.
// ---------------------------------------------------------------------------

const CW = 420;
const CH = 180;
const PAD = { t: 16, r: 28, b: 32, l: 40 };
const REPS_COLOR = '#567AFF'; // spec §1/§9.1 literal — no blue token exists in
// theme/tokens.ts (accentText is purple #6a56d4); this is a chart-only accent
// reserved for the reps axis, matching the original web spec's --accent value.

function roundDownTo5(n: number): number {
  return Math.floor(n / 5) * 5;
}
function roundUpTo5(n: number): number {
  return Math.ceil(n / 5) * 5;
}

function Chart({ filtered }: { filtered: HistoryEntry[] }) {
  const [tip, setTip] = useState<number | null>(null);

  const plotW = CW - PAD.l - PAD.r;
  const plotH = CH - PAD.t - PAD.b;

  if (filtered.length === 0) {
    return (
      <View style={[chartStyles.empty, { height: CH }]}>
        <Text style={chartStyles.emptyText}>No data points in this range.</Text>
      </View>
    );
  }

  const weights = filtered.map((h) => h.weight);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  let yMin = roundDownTo5(wMin - 2);
  let yMax = roundUpTo5(wMax + 2);
  if (yMax <= yMin) yMax = yMin + 5;

  function xAt(i: number): number {
    if (filtered.length === 1) return PAD.l + plotW / 2;
    return PAD.l + (i / (filtered.length - 1)) * plotW;
  }
  function yAt(w: number): number {
    return PAD.t + (1 - (w - yMin) / (yMax - yMin)) * plotH;
  }

  // Left-axis gridlines every 5lb, thinned to ~5 evenly-spaced ticks
  // (gridline + label together, per spec §9.1).
  const allTicks: number[] = [];
  for (let v = yMin; v <= yMax + 0.001; v += 5) allTicks.push(v);
  let ticks = allTicks;
  if (allTicks.length > 5) {
    const stride = Math.ceil((allTicks.length - 1) / 4);
    ticks = allTicks.filter((_, i) => i % stride === 0 || i === allTicks.length - 1);
  }

  const points = filtered.map((h, i) => ({ x: xAt(i), y: yAt(h.weight), h, i }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const firstW = filtered[0].weight;
  const lastW = filtered[filtered.length - 1].weight;
  const netUp = lastW >= firstW;
  const weightColor = netUp ? color.success : color.danger;

  // Right axis (reps) — only if >=1 session has valid avg reps; skip
  // sessions with no valid reps rather than interpolating/zeroing them.
  const repsRaw = filtered.map((h, i) => ({ i, avg: avgReps(h.sets) }));
  const repsValid = repsRaw.filter((r): r is { i: number; avg: number } => r.avg != null);
  const hasReps = repsValid.length > 0;

  let repsMin = 0;
  let repsMax = 1;
  if (hasReps) {
    const vals = repsValid.map((r) => r.avg);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const spread = mx === mn ? 4 : mx - mn;
    repsMin = mn - spread * 0.3;
    repsMax = mx + spread * 0.3;
  }
  function yAtReps(v: number): number {
    return PAD.t + (1 - (v - repsMin) / (repsMax - repsMin)) * plotH;
  }
  const repsPoints = repsValid.map((r) => ({ x: xAt(r.i), y: yAtReps(r.avg), avg: r.avg }));
  const repsPath = repsPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  // X labels: all if <=4 points, else first + last only.
  const xLabelIndices = filtered.length <= 4 ? filtered.map((_, i) => i) : [0, filtered.length - 1];

  const activeIdx = tip;
  const active = activeIdx != null ? points[activeIdx] : null;
  const tooltipFlip = active != null && active.x / CW > 0.65;
  const tooltipHasReps = active != null && avgReps(active.h.sets) != null;

  return (
    <View style={{ width: CW, height: CH, marginBottom: spacing.rowGapMd }}>
      {/* Axis legend */}
      <Text style={chartStyles.legendLbs}>LBS</Text>
      {hasReps && <Text style={chartStyles.legendReps}>REPS</Text>}

      <Svg width={CW} height={CH}>
        {/* Left-axis gridlines */}
        {ticks.map((t, i) => {
          const y = yAt(t);
          return (
            <Line key={i} x1={PAD.l} y1={y} x2={CW - PAD.r} y2={y} stroke="rgba(120,110,150,0.14)" strokeWidth={1} />
          );
        })}

        {/* Reps line — dashed, thin, low-opacity, drawn underneath the weight line */}
        {hasReps && repsPath !== '' && (
          <Path
            d={repsPath}
            fill="none"
            stroke={REPS_COLOR}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
        )}
        {hasReps &&
          repsPoints.map((p, i) => (
            <Circle key={`reps-dot-${i}`} cx={p.x} cy={p.y} r={2.5} fill={REPS_COLOR} fillOpacity={0.4} />
          ))}

        {/* Weight line (dominant) */}
        <Path d={linePath} fill="none" stroke={weightColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Crosshair at active point */}
        {active != null && (
          <Line
            x1={active.x}
            y1={PAD.t}
            x2={active.x}
            y2={PAD.t + plotH}
            stroke={color.text.tertiary}
            strokeWidth={1}
            strokeDasharray="3,4"
          />
        )}

        {points.map((p) => (
          <Circle key={p.i} cx={p.x} cy={p.y} r={p.i === activeIdx ? 4.5 : 3} fill={weightColor} />
        ))}

        {/* Invisible larger hit targets for tap-to-pin */}
        {points.map((p) => (
          <Circle
            key={`hit-${p.i}`}
            cx={p.x}
            cy={p.y}
            r={16}
            fill="transparent"
            onPress={() => setTip((prev) => (prev === p.i ? null : p.i))}
          />
        ))}
      </Svg>

      {/* Y tick labels (left axis) */}
      {ticks.map((t, i) => (
        <Text key={i} style={[chartStyles.yLabel, { top: yAt(t) - 6 }]}>
          {Math.round(t)}
        </Text>
      ))}

      {/* X tick labels */}
      {xLabelIndices.map((i) => (
        <Text
          key={i}
          style={[chartStyles.xLabel, { left: Math.max(0, Math.min(CW - 44, xAt(i) - 22)) }]}
          numberOfLines={1}
        >
          {fmtDate(filtered[i].date)}
        </Text>
      ))}

      {/* Tooltip */}
      {active != null && (
        <View
          style={[
            chartStyles.tooltip,
            tooltipHasReps && chartStyles.tooltipTall,
            tooltipFlip ? { right: CW - active.x + 10 } : { left: active.x + 10 },
            { top: Math.max(0, active.y - (tooltipHasReps ? 52 : 40)) },
          ]}
        >
          <Text style={chartStyles.tooltipWeight}>{`${active.h.weight} lbs`}</Text>
          {tooltipHasReps && (
            <Text style={chartStyles.tooltipReps}>
              {active.h.sets.map((s) => (s.reps === '' || s.reps == null ? '—' : String(s.reps))).join('/')}
            </Text>
          )}
          <Text style={chartStyles.tooltipDate}>{fmtDate(active.h.date)}</Text>
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: type.body.fontSize,
    color: color.text.tertiary,
    textAlign: 'center',
  },
  legendLbs: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: color.text.faint,
  },
  legendReps: {
    position: 'absolute',
    top: 2,
    right: 4,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: REPS_COLOR,
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD.l - 6,
    fontSize: 9,
    color: color.text.tertiary,
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
    bottom: 6,
    width: 44,
    fontSize: 9,
    color: color.text.tertiary,
    textAlign: 'center',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(20,15,30,0.88)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 70,
  },
  tooltipTall: {
    paddingVertical: 8,
  },
  tooltipWeight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  tooltipReps: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  tooltipDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,15,30,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fdfcff',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.screenSide,
    paddingTop: 12,
    paddingBottom: 40,
    maxHeight: '88%',
  },
  scrollBody: {
    flexGrow: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.track,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.rowGapMd,
  },
  headerText: {
    flexShrink: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: color.text.tertiary,
    marginBottom: 2,
  },
  headerName: {
    fontSize: 22,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.4,
    color: color.text.primary,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,110,150,0.12)',
  },
  closeBtnText: {
    fontSize: 18,
    lineHeight: 18,
    color: color.text.secondary,
  },
  emptyText: {
    fontSize: type.body.fontSize,
    color: color.text.tertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.rowGapMd,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(120,110,150,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(120,110,150,0.16)',
    alignItems: 'center',
  },
  rangePillActive: {
    backgroundColor: color.accentText,
    borderColor: color.accentText,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: color.text.secondary,
  },
  rangePillTextActive: {
    color: '#ffffff',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.rowGapMd,
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  summaryPillText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  summaryCaption: {
    fontSize: 11,
    color: color.text.tertiary,
    marginLeft: 'auto',
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.rowGapMd,
  },
  lastRowLeft: {
    flexShrink: 1,
  },
  lastDate: {
    fontSize: type.caption.fontSize,
    color: color.text.tertiary,
    marginBottom: 4,
  },
  lastPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  lastPill: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: color.successBg,
    alignItems: 'center',
  },
  lastPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: color.success,
  },
  lastTotal: {
    fontSize: type.caption.fontSize,
    color: color.text.tertiary,
  },
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.rowGapLg,
  },
  statTile: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.input,
    backgroundColor: 'rgba(120,110,150,0.08)',
    alignItems: 'center',
  },
  statTileLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: color.text.tertiary,
    marginBottom: 4,
  },
  statTileValue: {
    fontSize: 17,
    fontWeight: '700',
    color: color.text.primaryAlt,
  },
  table: {
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,110,150,0.05)',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(120,110,150,0.08)',
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: color.text.tertiary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableRowDivider: {
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  tableCellText: {
    fontSize: 12,
    color: color.text.secondary,
  },
  tableCellBest: {
    color: color.warning,
    fontWeight: '700',
  },
  tableColDate: {
    flex: 1.1,
  },
  tableColReps: {
    flex: 0.8,
  },
  tableColWeight: {
    flex: 1,
  },
  tableColChange: {
    flex: 0.9,
    textAlign: 'right',
  },
});

export default HistoryModal;

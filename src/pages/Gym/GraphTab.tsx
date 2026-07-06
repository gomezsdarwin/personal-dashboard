import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { GlassCard } from '../../components/GlassCard';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useRepo } from '../../hooks/useRepo';
import { SPLITS } from '../../data/workouts';
import type { GymSessionRow } from '../../lib/types';

/**
 * GraphTab — per-exercise progress-over-time view, per FitnessTab spec §8.
 * Own local date helpers (spec §10), `useRepo('gym_sessions')` without
 * fixtures (LogTab already owns the seed fixture reference), GlassCard/theme
 * usage patterns follow StatsTab's conventions.
 */

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
// Data derivation (spec §8)
// ---------------------------------------------------------------------------

type ExercisePoint = { date: string; weight: number; reps: string; split: string };

const RANGES: { label: string; days: number | null }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: 'ALL', days: null },
];

function firstSetWeight(setsWeight: number | string): number {
  const n = Number(setsWeight);
  return Number.isFinite(n) ? n : NaN;
}

function buildExerciseData(sessions: GymSessionRow[]): Record<string, ExercisePoint[]> {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const result: Record<string, ExercisePoint[]> = {};

  for (const session of sorted) {
    for (const ex of session.exercises) {
      const w = firstSetWeight(ex.sets[0]?.weight);
      if (!Number.isFinite(w) || w <= 0) continue;
      const reps = ex.sets.map((s) => (s.reps === '' || s.reps == null ? '—' : String(s.reps))).join(' / ');
      const entry: ExercisePoint = { date: session.date, weight: w, reps, split: session.split };
      const list = result[ex.name] ?? (result[ex.name] = []);
      const last = list[list.length - 1];
      if (last && last.date === session.date) {
        list[list.length - 1] = entry;
      } else {
        list.push(entry);
      }
    }
  }
  return result;
}

type Highlight = { name: string; delta: number; from: number; to: number };

function buildHighlights(exerciseData: Record<string, ExercisePoint[]>, today: string): Highlight[] {
  const highlights: Highlight[] = [];
  for (const [name, points] of Object.entries(exerciseData)) {
    const recent = points.filter((p) => daysBetween(p.date, today) <= 30);
    if (recent.length < 2) continue;
    const from = recent[0].weight;
    const to = recent[recent.length - 1].weight;
    if (to > from) {
      highlights.push({ name, delta: to - from, from, to });
    }
  }
  return highlights.sort((a, b) => b.delta - a.delta);
}

// ---------------------------------------------------------------------------
// GraphTab
// ---------------------------------------------------------------------------

export function GraphTab() {
  const { palette } = useTheme();
  const { rows: sessions } = useRepo('gym_sessions');
  const [range, setRange] = useState<string>('1M');
  const [selected, setSelected] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);

  const exerciseData = useMemo(() => buildExerciseData(sessions), [sessions]);
  const exerciseNames = useMemo(() => Object.keys(exerciseData).sort((a, b) => a.localeCompare(b)), [exerciseData]);
  const highlights = useMemo(() => buildHighlights(exerciseData, today), [exerciseData, today]);

  // Fall back to the first alphabetical exercise name once names are available.
  const activeExercise = selected != null && exerciseNames.includes(selected) ? selected : exerciseNames[0] ?? null;

  const rangeDef = RANGES.find((r) => r.label === range) ?? RANGES[1];
  const chartData = useMemo(() => {
    if (!activeExercise) return [];
    const points = exerciseData[activeExercise] ?? [];
    if (rangeDef.days == null) return points;
    return points.filter((p) => daysBetween(p.date, today) <= rangeDef.days!);
  }, [activeExercise, exerciseData, rangeDef, today]);

  if (exerciseNames.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>No exercise history yet — log a session to see progress graphs.</Text>
      </View>
    );
  }

  return (
    <View>
      {highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text.tertiary }]}>Notable increases — last 30 days</Text>
          {highlights.map((h) => (
            <View
              key={h.name}
              style={[styles.highlightRow, { backgroundColor: palette.successBg, borderColor: palette.successBorder }]}
            >
              <View style={styles.highlightInfo}>
                <Text style={[styles.highlightName, { color: palette.text.primaryAlt }]} numberOfLines={1}>
                  {h.name}
                </Text>
                <Text style={[styles.highlightRange, { color: palette.text.secondary }]}>{`${h.from} → ${h.to} lbs`}</Text>
              </View>
              <View style={[styles.highlightBadge, { backgroundColor: palette.success }]}>
                <Text style={styles.highlightBadgeText}>{`+${h.delta} lbs`}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.selectorScroll}
        contentContainerStyle={styles.selectorRow}
      >
        {exerciseNames.map((name) => {
          const active = name === activeExercise;
          return (
            <Pressable
              key={name}
              style={[
                styles.selectorPill,
                { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
                active && { backgroundColor: palette.accentText, borderColor: palette.accentText },
              ]}
              onPress={() => setSelected(name)}
            >
              <Text
                style={[styles.selectorPillText, { color: active ? '#ffffff' : palette.text.secondary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeExercise && (
        <View style={styles.chartSection}>
          <Text style={[styles.chartTitle, { color: palette.text.primaryAlt }]}>{activeExercise}</Text>

          <View style={styles.rangeRow}>
            {RANGES.map((r) => {
              const active = r.label === range;
              return (
                <Pressable
                  key={r.label}
                  style={[
                    styles.rangePill,
                    { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
                    active && { backgroundColor: palette.accentText, borderColor: palette.accentText },
                  ]}
                  onPress={() => setRange(r.label)}
                >
                  <Text style={[styles.rangePillText, { color: active ? '#ffffff' : palette.text.secondary }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <GlassCard style={styles.chartCard} contentStyle={styles.chartCardContent}>
            <LineChart data={chartData} />
          </GlassCard>

          <SessionLog data={chartData} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Session log (spec §8, chart-section bottom)
// ---------------------------------------------------------------------------

function SessionLog({ data }: { data: ExercisePoint[] }) {
  const { palette } = useTheme();
  const reversed = [...data].reverse();
  if (reversed.length === 0) {
    return (
      <GlassCard contentStyle={styles.logCardContent}>
        <Text style={[styles.emptyLogText, { color: palette.text.tertiary }]}>No sessions in this range.</Text>
      </GlassCard>
    );
  }
  return (
    <GlassCard contentStyle={styles.logCardContent}>
      {reversed.map((entry, i) => {
        // "immediately-preceding" in the filtered range means chronologically
        // before this one — i.e. the next entry in the reverse-chronological list.
        const prev = reversed[i + 1];
        const bumped = prev != null && entry.weight > prev.weight;
        const splitLabel = SPLITS.find((s) => s.id === entry.split)?.label ?? entry.split;
        return (
          <View
            key={`${entry.date}-${i}`}
            style={[styles.logRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.hairline }]}
          >
            <Text style={[styles.logText, { color: palette.text.secondary }]} numberOfLines={1}>
              {`${fmtDate(entry.date)} · ${splitLabel} · ${entry.weight} lbs · ${entry.reps}`}
            </Text>
            {bumped && (
              <View style={[styles.bumpBadge, { backgroundColor: palette.successBg }]}>
                <Text style={[styles.bumpBadgeText, { color: palette.success }]}>↑</Text>
              </View>
            )}
          </View>
        );
      })}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// LineChart (spec §8.1) — inline SVG single-axis line chart.
//
// Text rendering: uses absolutely-positioned RN <Text> overlaid on the SVG
// canvas rather than SVG <Text>, since RN <Text> renders font metrics more
// reliably cross-platform (SVG text baseline/font handling is inconsistent
// between iOS/Android/web in react-native-svg) — see report for detail.
//
// Interaction: RN has no hover/mouseenter on touch devices, so the "hover to
// reveal tooltip" half of the spec's hover-or-click interaction is dropped;
// tap-to-toggle-pin is the only interaction, which is the deliberate,
// unavoidable simplification for a touch UI mentioned in the task.
// ---------------------------------------------------------------------------

const CW = 420;
const CH = 190;
const PAD = { t: 20, r: 16, b: 32, l: 44 };

function LineChart({ data }: { data: ExercisePoint[] }) {
  const { palette } = useTheme();
  const [tip, setTip] = useState<number | null>(null);

  const plotW = CW - PAD.l - PAD.r;
  const plotH = CH - PAD.t - PAD.b;

  if (data.length === 0) {
    return (
      <View style={[styles.chartEmpty, { height: CH }]}>
        <Text style={[styles.emptyLogText, { color: palette.text.tertiary }]}>No data points in this range.</Text>
      </View>
    );
  }

  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const spread = max === min ? 20 : max - min;
  const yMin = min - spread * 0.3;
  const yMax = max + spread * 0.3;

  function xAt(i: number): number {
    if (data.length === 1) return PAD.l + plotW / 2;
    return PAD.l + (i / (data.length - 1)) * plotW;
  }
  function yAt(w: number): number {
    return PAD.t + (1 - (w - yMin) / (yMax - yMin)) * plotH;
  }

  const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.weight), d, i }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(PAD.t + plotH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(PAD.t + plotH).toFixed(2)} Z`
      : '';

  const first = data[0].weight;
  const last = data[data.length - 1].weight;
  const netUp = last >= first;
  const accentColor = netUp ? palette.success : palette.danger;

  // 4 evenly-spaced Y gridlines with rounded labels.
  const yTicks = [0, 1, 2, 3].map((i) => yMin + (i / 3) * (yMax - yMin));

  // X labels: all if <=5 points, else de-duplicated indices at ~0/33/66/100%.
  let xLabelIndices: number[];
  if (data.length <= 5) {
    xLabelIndices = data.map((_, i) => i);
  } else {
    const raw = [0, Math.round((data.length - 1) * 0.33), Math.round((data.length - 1) * 0.66), data.length - 1];
    xLabelIndices = Array.from(new Set(raw));
  }

  const delta = data.length > 1 ? last - first : 0;
  const pct = first !== 0 ? (delta / first) * 100 : 0;
  const showDeltaHeader = data.length > 1 && delta !== 0;

  const activeIdx = tip;
  const showDotsAlways = data.length <= 8;

  const active = activeIdx != null ? points[activeIdx] : null;
  const tooltipFlip = active != null && active.x / CW > 0.65;

  return (
    <View>
      {showDeltaHeader && (
        <View style={styles.deltaHeader}>
          <Text style={[styles.deltaLast, { color: palette.text.primaryAlt }]}>{`${last} lbs`}</Text>
          <View style={[styles.deltaBadge, { backgroundColor: netUp ? palette.successBg : palette.dangerBg }]}>
            <Text style={[styles.deltaBadgeText, { color: accentColor }]}>
              {`${delta >= 0 ? '+' : ''}${delta} lbs (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`}
            </Text>
          </View>
        </View>
      )}

      <View style={{ width: CW, height: CH }}>
        <Svg width={CW} height={CH}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accentColor} stopOpacity={0.28} />
              <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Y gridlines */}
          {yTicks.map((t, i) => {
            const y = yAt(t);
            return (
              <Line
                key={i}
                x1={PAD.l}
                y1={y}
                x2={CW - PAD.r}
                y2={y}
                stroke="rgba(120,110,150,0.14)"
                strokeWidth={1}
              />
            );
          })}

          {/* Area fill + line */}
          {areaPath !== '' && <Path d={areaPath} fill="url(#areaFill)" stroke="none" />}
          <Path d={linePath} fill="none" stroke={accentColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Crosshair at active point */}
          {active != null && (
            <Line
              x1={active.x}
              y1={PAD.t}
              x2={active.x}
              y2={PAD.t + plotH}
              stroke={palette.text.tertiary}
              strokeWidth={1}
              strokeDasharray="3,4"
            />
          )}

          {/* Visible dots (always for <=8 pts, otherwise only the active one) */}
          {points.map((p) => {
            const visible = showDotsAlways || p.i === activeIdx;
            if (!visible) return null;
            return (
              <Circle key={p.i} cx={p.x} cy={p.y} r={p.i === activeIdx ? 4.5 : 3.5} fill={accentColor} />
            );
          })}

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

        {/* Y tick labels — overlaid RN Text for reliable font rendering */}
        {yTicks.map((t, i) => (
          <Text key={i} style={[styles.yLabel, { top: yAt(t) - 6, color: palette.text.tertiary }]}>
            {Math.round(t)}
          </Text>
        ))}

        {/* X tick labels */}
        {xLabelIndices.map((i) => (
          <Text
            key={i}
            style={[styles.xLabel, { left: Math.max(0, Math.min(CW - 44, xAt(i) - 22)), color: palette.text.tertiary }]}
            numberOfLines={1}
          >
            {fmtDate(data[i].date)}
          </Text>
        ))}

        {/* Tooltip */}
        {active != null && (
          <View
            style={[
              styles.tooltip,
              tooltipFlip
                ? { right: CW - active.x + 10 }
                : { left: active.x + 10 },
              { top: Math.max(0, active.y - 40) },
            ]}
          >
            <Text style={styles.tooltipWeight}>{`${active.d.weight} lbs`}</Text>
            <Text style={styles.tooltipDate}>{fmtDate(active.d.date)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: type.body.fontSize,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: spacing.rowGapLg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.rowGapSm,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    borderWidth: 1,
    marginBottom: 8,
  },
  highlightInfo: {
    flexShrink: 1,
    marginRight: 8,
  },
  highlightName: {
    fontSize: type.bodyMedium.fontSize,
    fontWeight: '600',
  },
  highlightRange: {
    fontSize: type.caption.fontSize,
    marginTop: 2,
  },
  highlightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  highlightBadgeText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
  selectorScroll: {
    marginBottom: spacing.rowGapLg,
  },
  selectorRow: {
    gap: 8,
    paddingRight: 8,
  },
  selectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1,
    maxWidth: 180,
  },
  selectorPillText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
  },
  chartSection: {
    marginBottom: spacing.rowGapLg,
  },
  chartTitle: {
    fontSize: 19,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    marginBottom: spacing.rowGapSm,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.rowGapMd,
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  rangePillText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  chartCard: {
    marginBottom: spacing.rowGapMd,
  },
  chartCardContent: {
    alignItems: 'center',
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deltaHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  deltaLast: {
    fontSize: 22,
    fontWeight: '700',
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deltaBadgeText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD.l - 6,
    fontSize: 9,
    textAlign: 'right',
  },
  xLabel: {
    position: 'absolute',
    bottom: 6,
    width: 44,
    fontSize: 9,
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
  tooltipWeight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  tooltipDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  logCardContent: {
    padding: 0,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  logText: {
    flex: 1,
    fontSize: type.meta.fontSize,
  },
  bumpBadge: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bumpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyLogText: {
    fontSize: type.body.fontSize,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

export default GraphTab;

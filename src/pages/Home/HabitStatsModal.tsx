import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Defs, LinearGradient as SvgLinearGradient, Rect, Stop, Svg } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt } from '../../lib/dueDate';
import type { HabitCompletionRow, HabitRow } from '../../lib/types';
import { addDaysIso, weekDayIsos, weekStartIso } from '../../lib/week';
import { accent } from '../../theme/accent';
import { radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  habits: HabitRow[];
  completions: HabitCompletionRow[];
  selectedHabitId: string | 'all' | null;
  onSelectHabit: (id: string | 'all') => void;
};

const WEEKS_BACK = 8; // includes the current in-progress week.

/**
 * HabitStatsModal — bottom-sheet chart (weekly completion-rate over the past 8 weeks,
 * per-habit or "All" aggregate). SVG bar chart follows GraphTab.tsx's conventions:
 * <Svg> geometry only, RN <Text> overlays for axis/value labels, vertical accent
 * gradient fill built the same way as GraphTab's Defs/LinearGradient/Stop.
 */
export function HabitStatsModal({
  visible,
  onClose,
  habits,
  completions,
  selectedHabitId,
  onSelectHabit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { palette, glass } = useTheme();

  const completionSet = useMemo(
    () => new Set(completions.map((c) => `${c.habit_id}|${c.completed_on}`)),
    [completions]
  );

  // Oldest -> newest week starts, ending at the current (in-progress) week.
  const weekStarts = useMemo(() => {
    const currentStart = weekStartIso(new Date());
    return Array.from({ length: WEEKS_BACK }, (_, i) => addDaysIso(currentStart, -7 * (WEEKS_BACK - 1 - i)));
  }, []);

  const rates = useMemo(() => {
    return weekStarts.map((start) => {
      const days = weekDayIsos(start);
      if (selectedHabitId === 'all') {
        if (habits.length === 0) return 0;
        const avg =
          habits.reduce((sum, h) => {
            const done = days.filter((d) => completionSet.has(`${h.id}|${d}`)).length;
            return sum + done / 7;
          }, 0) / habits.length;
        return avg * 100;
      }
      if (!selectedHabitId) return 0;
      const done = days.filter((d) => completionSet.has(`${selectedHabitId}|${d}`)).length;
      return (done / 7) * 100;
    });
  }, [weekStarts, selectedHabitId, habits, completionSet]);

  const activeHabitName =
    selectedHabitId === 'all' ? 'All habits' : habits.find((h) => h.id === selectedHabitId)?.name ?? '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View pointerEvents="box-none" style={styles.sheetWrap}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />

          <View style={styles.content}>
            <View style={styles.grabberRow}>
              <View style={[styles.grabber, { backgroundColor: glass.borderElevated }]} />
            </View>

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.text.primary }]}>Habit history</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close habit history">
                <MaterialCommunityIcons name="close" size={22} color={palette.text.secondary} />
              </Pressable>
            </View>

            {habits.length === 0 ? (
              <Text style={[styles.emptyText, { color: palette.text.quaternary }]}>
                No habits yet — add one to see its history here.
              </Text>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipRow}
                >
                  {habits.length > 1 && (
                    <Chip
                      label="All"
                      active={selectedHabitId === 'all'}
                      onPress={() => onSelectHabit('all')}
                    />
                  )}
                  {habits.map((h) => (
                    <Chip
                      key={h.id}
                      label={h.name}
                      active={selectedHabitId === h.id}
                      onPress={() => onSelectHabit(h.id)}
                    />
                  ))}
                </ScrollView>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[styles.chartTitle, { color: palette.text.primaryAlt }]} numberOfLines={1}>
                    {activeHabitName}
                  </Text>
                  <Text style={[styles.chartSubtitle, { color: palette.text.quaternary }]}>
                    Weekly completion rate — last {WEEKS_BACK} weeks
                  </Text>

                  <BarChart weekStarts={weekStarts} rates={rates} />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { palette, glass } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? palette.accentText : glass.fill,
          borderColor: active ? palette.accentText : glass.borderBase,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? '#ffffff' : palette.text.primary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// BarChart — inline SVG bar chart, mirrors GraphTab.tsx's LineChart conventions:
// Svg geometry only, RN <Text> overlays for axis labels (more reliable font
// metrics cross-platform than SVG <Text>).
// ---------------------------------------------------------------------------

const CW = 320;
const CH = 170;
const PAD = { t: 22, r: 8, b: 30, l: 8 };

function BarChart({ weekStarts, rates }: { weekStarts: string[]; rates: number[] }) {
  const { palette } = useTheme();
  const vert = accent.vertical();

  const plotW = CW - PAD.l - PAD.r;
  const plotH = CH - PAD.t - PAD.b;
  const n = weekStarts.length;
  const gap = 8;
  const barW = (plotW - gap * (n - 1)) / n;

  return (
    <View style={{ width: CW, height: CH }}>
      <Svg width={CW} height={CH}>
        <Defs>
          <SvgLinearGradient id="habitBarFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={vert.colors[0]} stopOpacity={0.95} />
            <Stop offset="1" stopColor={vert.colors[1]} stopOpacity={0.55} />
          </SvgLinearGradient>
        </Defs>

        {/* Baseline */}
        <Rect x={PAD.l} y={PAD.t + plotH} width={plotW} height={1} fill={palette.hairline} />

        {weekStarts.map((_, i) => {
          const rate = rates[i] ?? 0;
          const barH = Math.max((rate / 100) * plotH, rate > 0 ? 3 : 0);
          const x = PAD.l + i * (barW + gap);
          const y = PAD.t + plotH - barH;
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={5}
              fill="url(#habitBarFill)"
            />
          );
        })}
      </Svg>

      {/* Value labels above each bar */}
      {weekStarts.map((_, i) => {
        const rate = rates[i] ?? 0;
        const barH = Math.max((rate / 100) * plotH, rate > 0 ? 3 : 0);
        const x = PAD.l + i * (barW + gap);
        const y = PAD.t + plotH - barH;
        return (
          <Text
            key={i}
            style={[
              styles.barValueLabel,
              { left: x - 6, width: barW + 12, top: Math.max(0, y - 16), color: palette.text.tertiary },
            ]}
            numberOfLines={1}
          >
            {Math.round(rate)}%
          </Text>
        );
      })}

      {/* Week-start labels below each bar */}
      {weekStarts.map((iso, i) => {
        const x = PAD.l + i * (barW + gap);
        return (
          <Text
            key={iso}
            style={[
              styles.barDateLabel,
              { left: x - 8, width: barW + 16, top: PAD.t + plotH + 6, color: palette.text.tertiary },
            ]}
            numberOfLines={1}
          >
            {fmt(iso)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '62%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    paddingVertical: 24,
    textAlign: 'center',
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 16,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  chartSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  barValueLabel: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  barDateLabel: {
    position: 'absolute',
    fontSize: 9,
    textAlign: 'center',
  },
});

export default HabitStatsModal;

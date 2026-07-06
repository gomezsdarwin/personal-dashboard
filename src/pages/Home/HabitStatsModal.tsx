import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HabitCompletionRow, HabitRow } from '../../lib/types';
import { addDaysIso, toIsoDate, weekDayIsos, weekStartIso } from '../../lib/week';
import { accentPalettes, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  habits: HabitRow[];
  completions: HabitCompletionRow[];
  selectedHabitId: string | null;
  onSelectHabit: (id: string) => void;
};

// 28 weeks x 7 days ~= 6 months, matching the reference mockup's grid dimensions.
const GRID_WEEKS = 28;
const GRID_CELL = 7;
const GRID_GAP = 2;

// Each habit's grid uses a deterministic color from the app's existing accent palette
// set (no per-habit color field on HabitRow), so the same habit always renders the
// same shade across opens.
const HABIT_GRID_COLORS = Object.values(accentPalettes).map((pair) => pair[0]);

function habitColorFor(habitId: string): string {
  let hash = 0;
  for (let i = 0; i < habitId.length; i += 1) {
    hash = (hash * 31 + habitId.charCodeAt(i)) >>> 0;
  }
  return HABIT_GRID_COLORS[hash % HABIT_GRID_COLORS.length];
}

/**
 * HabitStatsModal — near-full-screen bottom sheet showing a GitHub-contribution-style
 * grid (28 weeks x 7 days) of one habit's completion history at a time.
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

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const activeHabitName = habits.find((h) => h.id === selectedHabitId)?.name ?? '';

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

                  {selectedHabitId ? (
                    <ContributionGrid
                      habitId={selectedHabitId}
                      completionSet={completionSet}
                      todayIso={todayIso}
                    />
                  ) : null}
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
// ContributionGrid — plain-View grid of small squares, one per day over the past
// GRID_WEEKS weeks (columns = weeks, rows = Mon..Sun within each column), filled with
// the habit's accent color when completed. Plain Views (not SVG) since this is a
// static grid with no curves/gradients to justify SVG overhead.
// ---------------------------------------------------------------------------

function ContributionGrid({
  habitId,
  completionSet,
  todayIso,
}: {
  habitId: string;
  completionSet: Set<string>;
  todayIso: string;
}) {
  const { palette, mode } = useTheme();
  const color = useMemo(() => habitColorFor(habitId), [habitId]);
  const cellInactiveBg = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const cellInactiveBorder = mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';

  const weekStarts = useMemo(() => {
    const currentStart = weekStartIso(new Date());
    return Array.from({ length: GRID_WEEKS }, (_, i) => addDaysIso(currentStart, -7 * (GRID_WEEKS - 1 - i)));
  }, []);

  return (
    <View style={styles.gridWrap}>
      <View style={styles.gridRow}>
        {weekStarts.map((weekStart) => (
          <View key={weekStart} style={styles.gridColumn}>
            {weekDayIsos(weekStart).map((iso) => {
              const isFuture = iso > todayIso;
              const completed = !isFuture && completionSet.has(`${habitId}|${iso}`);
              return (
                <View
                  key={iso}
                  style={[
                    styles.gridCell,
                    isFuture
                      ? styles.gridCellFuture
                      : completed
                      ? { backgroundColor: color, borderColor: color }
                      : { backgroundColor: cellInactiveBg, borderColor: cellInactiveBorder },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.gridCaptionRow}>
        <Text style={[styles.gridCaption, { color: palette.text.quaternary }]}>Last 6 Months</Text>
        <Text style={[styles.gridCaption, { color: palette.text.quaternary }]}>Today</Text>
      </View>
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
    height: '93%',
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
    marginBottom: 14,
  },
  gridWrap: {
    paddingBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridColumn: {
    gap: GRID_GAP,
  },
  gridCell: {
    width: GRID_CELL,
    height: GRID_CELL,
    borderRadius: 2,
    borderWidth: 1,
  },
  gridCellFuture: {
    opacity: 0,
  },
  gridCaptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  gridCaption: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default HabitStatsModal;

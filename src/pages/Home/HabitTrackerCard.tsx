import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components/GlassCard';
import { useRepo } from '../../hooks/useRepo';
import type { HabitRow, NewRow } from '../../lib/types';
import { toIsoDate, weekDayIsos, weekStartIso } from '../../lib/week';
import { accent } from '../../theme/accent';
import { type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { HabitStatsModal } from './HabitStatsModal';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CELL = 28;
const CELL_GAP = 7;

/** First-run sample habits, one marked favorite so the "favorites sort to top" rule is visible. */
const seedHabits: NewRow<HabitRow>[] = [
  { name: 'Drink water', favorite: true, position: 0 },
  { name: 'Read 20 pages', favorite: false, position: 1 },
  { name: 'Stretch', favorite: false, position: 2 },
];

/** Sort order: favorites first, then insertion position. */
function habitOrder(h: HabitRow): number {
  return (h.favorite ? 0 : 1e6) + h.position;
}

function completionKeyOf(habitId: string, iso: string): string {
  return `${habitId}|${iso}`;
}

export function HabitTrackerCard() {
  const { palette, glass } = useTheme();
  const { rows: habits, insert: insertHabit, update: updateHabit, remove: removeHabit } = useRepo(
    'habits',
    seedHabits
  );
  const {
    rows: completions,
    insert: insertCompletion,
    remove: removeCompletion,
  } = useRepo('habit_completions', []);

  const [newHabitName, setNewHabitName] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsHabitId, setStatsHabitId] = useState<string | 'all' | null>(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const currentWeekStart = useMemo(() => weekStartIso(new Date()), []);
  const weekIsos = useMemo(() => weekDayIsos(currentWeekStart), [currentWeekStart]);
  const todayMondayIndex = useMemo(() => (new Date().getDay() + 6) % 7, []);

  const sortedHabits = useMemo(
    () => habits.slice().sort((a, b) => habitOrder(a) - habitOrder(b)),
    [habits]
  );

  const completionSet = useMemo(
    () => new Set(completions.map((c) => completionKeyOf(c.habit_id, c.completed_on))),
    [completions]
  );

  const diag = accent.diagonal();
  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated };

  const handleAddHabit = () => {
    const name = newHabitName.trim();
    if (!name) return;
    insertHabit({ name, favorite: false, position: habits.length });
    setNewHabitName('');
  };

  const toggleFavorite = (habit: HabitRow) => {
    updateHabit(habit.id, { favorite: !habit.favorite });
  };

  const toggleCell = (habitId: string, iso: string) => {
    if (iso > todayIso) return; // future day — never interactive.
    const existing = completions.find((c) => c.habit_id === habitId && c.completed_on === iso);
    if (existing) {
      removeCompletion(existing.id);
    } else {
      insertCompletion({ habit_id: habitId, completed_on: iso });
    }
  };

  const deleteHabit = (habit: HabitRow) => {
    removeHabit(habit.id);
    // Local (non-Supabase) fallback has no FK cascade, so clean up orphaned
    // completions ourselves; on Supabase this is a harmless no-op (already cascaded).
    completions
      .filter((c) => c.habit_id === habit.id)
      .forEach((c) => removeCompletion(c.id));
  };

  const confirmDeleteHabit = (habit: HabitRow) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(`Delete "${habit.name}"?`)) {
        deleteHabit(habit);
      }
      return;
    }
    Alert.alert('Delete habit', `Delete "${habit.name}"? This also removes its history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit) },
    ]);
  };

  const openStats = () => {
    setStatsHabitId((prev) => (prev && sortedHabits.some((h) => h.id === prev) ? prev : sortedHabits[0]?.id ?? null));
    setStatsOpen(true);
  };

  return (
    <>
      <GlassCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: palette.text.secondary }]}>HABIT TRACKER</Text>
          <Pressable
            onPress={openStats}
            style={styles.statsButton}
            accessibilityRole="button"
            accessibilityLabel="View habit history chart"
          >
            <Feather name="bar-chart-2" size={18} color={palette.text.secondary} />
          </Pressable>
        </View>

        <View style={styles.columnHeaderRow}>
          <View style={styles.nameSpacer} />
          <View style={styles.starSpacer} />
          <View style={styles.cellsRow}>
            {DAY_LETTERS.map((letter, i) => {
              const isToday = i === todayMondayIndex;
              return (
                <Text
                  key={i}
                  style={[
                    styles.dayLetter,
                    { color: isToday ? palette.accentText : palette.text.quaternary },
                    isToday && styles.dayLetterToday,
                  ]}
                >
                  {letter}
                </Text>
              );
            })}
          </View>
        </View>

        {sortedHabits.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.text.quaternary }]}>
            No habits yet — add one below.
          </Text>
        ) : (
          sortedHabits.map((habit) => (
            <View key={habit.id} style={[styles.habitRow, { borderTopColor: palette.hairline }]}>
              <Pressable
                style={styles.nameWrap}
                onLongPress={() => confirmDeleteHabit(habit)}
                accessibilityRole="button"
                accessibilityLabel={`${habit.name}. Long-press to delete.`}
              >
                <Text
                  style={[styles.habitName, { color: palette.text.primaryAlt }]}
                  numberOfLines={1}
                >
                  {habit.name}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleFavorite(habit)}
                style={styles.starWrap}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={habit.favorite ? 'Unfavorite habit' : 'Favorite habit'}
              >
                <Ionicons
                  name={habit.favorite ? 'star' : 'star-outline'}
                  size={17}
                  color={habit.favorite ? palette.warning : palette.text.faint}
                />
              </Pressable>

              <View style={styles.cellsRow}>
                {weekIsos.map((iso) => {
                  const isFuture = iso > todayIso;
                  const completed = completionSet.has(completionKeyOf(habit.id, iso));
                  return (
                    <Pressable
                      key={iso}
                      disabled={isFuture}
                      onPress={() => toggleCell(habit.id, iso)}
                      style={[styles.cellBase, isFuture && styles.cellFuture]}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isFuture, selected: completed }}
                      accessibilityLabel={`${habit.name} on ${iso}${isFuture ? ' (future, disabled)' : completed ? ', completed' : ', not completed'}`}
                    >
                      {completed ? (
                        <LinearGradient
                          colors={diag.colors}
                          start={diag.start}
                          end={diag.end}
                          style={styles.cellFill}
                        />
                      ) : (
                        <View
                          style={[
                            styles.cellHollow,
                            { backgroundColor: glass.fill, borderColor: glass.borderElevated },
                          ]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={styles.addRow}>
          <TextInput
            value={newHabitName}
            onChangeText={setNewHabitName}
            onSubmitEditing={handleAddHabit}
            returnKeyType="done"
            placeholder="+ New habit…"
            placeholderTextColor={palette.text.quaternary}
            style={[styles.input, inputStyle, { color: palette.text.primary }]}
          />
          <Pressable onPress={handleAddHabit}>
            <LinearGradient colors={diag.colors} start={diag.start} end={diag.end} style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </GlassCard>

      <HabitStatsModal
        visible={statsOpen}
        onClose={() => setStatsOpen(false)}
        habits={sortedHabits}
        completions={completions}
        selectedHabitId={statsHabitId}
        onSelectHabit={setStatsHabitId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  statsButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  nameSpacer: {
    flex: 1,
    minWidth: 0,
  },
  starSpacer: {
    width: 22,
  },
  cellsRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  dayLetter: {
    width: CELL,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  dayLetterToday: {
    fontWeight: '700',
  },
  emptyText: {
    fontSize: typeScale.body.fontSize,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  habitName: {
    fontSize: typeScale.itemTitleMedium.fontSize,
    fontWeight: typeScale.itemTitleMedium.fontWeight,
  },
  starWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellBase: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFuture: {
    opacity: 0.32,
  },
  cellFill: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  cellHollow: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
  },
});

export default HabitTrackerCard;

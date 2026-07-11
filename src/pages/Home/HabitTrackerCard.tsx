import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from '../../components/GlassCard';
import { useRepo } from '../../hooks/useRepo';
import type { HabitRow } from '../../lib/types';
import { habitStreaks, todayIso as todayIsoNow, weekDayIsos, weekStartIso } from '../../lib/week';
import { type as typeScale } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { HabitStatsModal } from './HabitStatsModal';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Enlarged from the original 16x16 for reliable mobile tap targets (plus hitSlop
// below extends the actual touchable area further without changing visual size).
const CELL = 26;
const CELL_GAP = 10;

/** Sort order: favorites first, then insertion position. */
function habitOrder(h: HabitRow): number {
  return (h.favorite ? 0 : 1e6) + h.position;
}

function completionKeyOf(habitId: string, iso: string): string {
  return `${habitId}|${iso}`;
}

export function HabitTrackerCard() {
  const { palette, glass, mode } = useTheme();
  const { rows: habits, insert: insertHabit, update: updateHabit, remove: removeHabit } = useRepo('habits');
  const {
    rows: completions,
    insert: insertCompletion,
    remove: removeCompletion,
  } = useRepo('habit_completions', []);

  const [newHabitName, setNewHabitName] = useState('');
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const todayIso = useMemo(() => todayIsoNow(), []);
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

  const completedIsosByHabit = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of completions) {
      const existing = map.get(c.habit_id);
      if (existing) {
        existing.push(c.completed_on);
      } else {
        map.set(c.habit_id, [c.completed_on]);
      }
    }
    return map;
  }, [completions]);

  const streaksByHabit = useMemo(() => {
    const map = new Map<string, { current: number; best: number }>();
    for (const h of sortedHabits) {
      map.set(h.id, habitStreaks(completedIsosByHabit.get(h.id) ?? [], todayIso));
    }
    return map;
  }, [sortedHabits, completedIsosByHabit, todayIso]);

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated };
  const iconBtnBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  // Inactive habit cell: bg-white/10 + border-white/20 (dark), matching
  // sampleindex.html's `.habit-square` exactly.
  const cellInactiveBg = mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const cellInactiveBorder = mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.16)';

  const handleAddHabit = () => {
    const name = newHabitName.trim();
    if (!name) return;
    insertHabit({ name, favorite: false, position: habits.length });
    setNewHabitName('');
  };

  const closeAddHabit = () => {
    setAddHabitOpen(false);
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

  return (
    <>
      <GlassCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: palette.accentText }]}>HABIT TRACKER</Text>
          <View style={styles.cardHeaderRight}>
            <Pressable
              onPress={() => setAddHabitOpen(true)}
              style={styles.statsButton}
              accessibilityRole="button"
              accessibilityLabel="Add habit"
            >
              <MaterialCommunityIcons name="plus" size={20} color={palette.accentText} />
            </Pressable>
            <Pressable
              onPress={() => setStatsOpen(true)}
              style={styles.statsButton}
              accessibilityRole="button"
              accessibilityLabel="View habit history chart"
            >
              <MaterialCommunityIcons name="chart-line" size={20} color={palette.accentText} />
            </Pressable>
          </View>
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
          sortedHabits.map((habit) => {
            const streak = streaksByHabit.get(habit.id);
            const showStreakBadge = !!streak && streak.current >= 2;
            return (
            <View key={habit.id} style={[styles.habitRow, { borderTopColor: palette.hairline }]}>
              <Pressable
                style={styles.nameWrap}
                onLongPress={() => confirmDeleteHabit(habit)}
                accessibilityRole="button"
                accessibilityLabel={
                  showStreakBadge
                    ? `${habit.name}, ${streak!.current} day streak. Long-press to delete.`
                    : `${habit.name}. Long-press to delete.`
                }
              >
                <Text
                  style={[styles.habitName, { color: palette.text.primaryAlt }]}
                  numberOfLines={2}
                >
                  {habit.name}
                </Text>
                {showStreakBadge ? (
                  <View style={styles.streakBadge}>
                    <MaterialCommunityIcons name="fire" size={12} color={palette.warning} />
                    <Text style={[styles.streakBadgeText, { color: palette.warning }]}>
                      {streak!.current}d
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => toggleFavorite(habit)}
                style={styles.starWrap}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={habit.favorite ? 'Unfavorite habit' : 'Favorite habit'}
              >
                <MaterialCommunityIcons
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
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isFuture, selected: completed }}
                      accessibilityLabel={`${habit.name} on ${iso}${isFuture ? ' (future, disabled)' : completed ? ', completed' : ', not completed'}`}
                    >
                      {completed ? (
                        <View
                          style={[
                            styles.cellFill,
                            {
                              backgroundColor: palette.accentText,
                              borderColor: palette.accentText,
                              shadowColor: palette.accentText,
                            },
                          ]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.cellHollow,
                            { backgroundColor: cellInactiveBg, borderColor: cellInactiveBorder },
                          ]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            );
          })
        )}

        {addHabitOpen ? (
          <View style={styles.addRow}>
            <TextInput
              autoFocus
              value={newHabitName}
              onChangeText={setNewHabitName}
              onSubmitEditing={handleAddHabit}
              returnKeyType="done"
              placeholder="New habit…"
              placeholderTextColor={palette.text.quaternary}
              style={[styles.input, inputStyle, { color: palette.text.primary }]}
            />
            <Pressable
              onPress={handleAddHabit}
              style={[styles.addButton, { backgroundColor: iconBtnBg }]}
              accessibilityRole="button"
              accessibilityLabel="Add habit"
            >
              <MaterialCommunityIcons name="plus-circle" size={26} color={palette.accentText} />
            </Pressable>
            <Pressable
              onPress={closeAddHabit}
              style={styles.closeAddButton}
              accessibilityRole="button"
              accessibilityLabel="Cancel adding habit"
            >
              <MaterialCommunityIcons name="close" size={18} color={palette.text.faint} />
            </Pressable>
          </View>
        ) : null}
      </GlassCard>

      <HabitStatsModal
        visible={statsOpen}
        onClose={() => setStatsOpen(false)}
        habits={sortedHabits}
        completions={completions}
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
  // Small accent-colored uppercase label with wide tracking — matches
  // sampleindex.html's "HABIT TRACKER" section label treatment exactly.
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  // Sits below the (up to 2-line) habit name rather than beside it, so it never
  // steals width from the wrapping name text or the day cells.
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  streakBadgeText: {
    fontSize: typeScale.caption.fontSize,
    fontWeight: typeScale.caption.fontWeight,
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
  // Solid accent fill + soft glow — approximates the reference's
  // `box-shadow: 0 0 10px rgba(173,199,255,0.4)` via RN shadow props (renders on both
  // iOS and web; `elevation` gives Android a comparable soft halo).
  cellFill: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cellHollow: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    borderWidth: 1,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 12,
  },
  closeAddButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HabitTrackerCard;

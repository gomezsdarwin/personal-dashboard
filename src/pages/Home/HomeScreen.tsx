import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { HabitTrackerCard } from './HabitTrackerCard';
import { useRepo } from '../../hooks/useRepo';
import { dueMeta, fmt } from '../../lib/dueDate';
import { todayIso, toIsoDate } from '../../lib/week';
import { getSplitLabel } from '../../data/workouts';
import type { TaskRow } from '../../lib/types';
import { type as typeScale } from '../../theme/tokens';
import { useTheme, withAlpha } from '../../theme/ThemeContext';

/** Sort order: soonest-due first, completed tasks sink to bottom. Mirrors Phone.dc.html's `order`. */
function taskOrder(t: TaskRow): number {
  return t.done ? 1e12 : dueMeta(t.due_date).days * 1e6;
}

export default function HomeScreen() {
  const { rows: tasks, insert, update, remove } = useRepo('tasks');
  const { rows: gymSessions } = useRepo('gym_sessions');
  const { rows: gymSplitConfigs } = useRepo('gym_split_config');
  const { rows: peptideDoses } = useRepo('peptide_doses');
  const { rows: subscriptions } = useRepo('subscriptions');
  const { palette, glass, mode, todoCollapsed, setTodoCollapsed, displayName } = useTheme();
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState<Date | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'new' | string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  /** Hour-based greeting: 5-11:59 morning, 12-17:59 afternoon, 18:00-4:59 evening. */
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const sortedTasks = useMemo(
    () => tasks.slice().sort((a, b) => taskOrder(a) - taskOrder(b)),
    [tasks]
  );

  const openCount = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  /** Slim cross-tab "Today" summary: gym session logged today, peptide doses still
   *  pending today, and subscriptions renewing within the next 7 days. Mirrors each
   *  screen's own "today" logic (Gym: session row dated today; Peptides: doses
   *  scheduled for today and not yet taken; Finance: dueMeta's urgency window). */
  const todaySummary = useMemo(() => {
    const today = todayIso();

    const sessionToday = gymSessions.find((s) => s.date === today);
    // Resolve the split's display name via the shared getSplitLabel helper — the
    // same resolution path LogTab's picker uses (config-row label override, then
    // the merged built-in + custom split list, then a generic "Workout"), so
    // custom splits render their real label, never a raw "custom_split_..." id.
    const gymText = sessionToday
      ? `${getSplitLabel(gymSplitConfigs, sessionToday.split)} logged ✓`
      : 'not yet';

    const dosesPending = peptideDoses.filter((d) => d.scheduled_for === today && !d.taken).length;

    const renewingSoon = subscriptions.filter((s) => {
      const meta = dueMeta(s.renews_on);
      return meta.days >= 0 && meta.days <= 7;
    });
    const renewingTotal = renewingSoon.reduce((sum, s) => sum + s.amount, 0);

    return { gymText, dosesPending, renewingTotal, hasRenewals: renewingSoon.length > 0 };
  }, [gymSessions, gymSplitConfigs, peptideDoses, subscriptions]);

  const handleAddTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    insert({ title, due_date: newDue ? toIsoDate(newDue) : null, done: false });
    setNewTitle('');
    setNewDue(null);
  };

  const closeAddTask = () => {
    setAddTaskOpen(false);
    setNewTitle('');
    setNewDue(null);
  };

  /** Opens the shared native DateTimePicker targeted at either the add-row ('new') or a
   *  specific task id; on web, toggles that row's inline YYYY-MM-DD text editor instead. */
  const openDatePicker = (target: 'new' | string, currentDue: string | null) => {
    if (Platform.OS === 'web') {
      setEditingTaskId((prev) => (prev === target ? null : target));
      setEditingText(currentDue ?? '');
      return;
    }
    if (showPicker && pickerTarget === target) {
      setShowPicker(false);
      setPickerTarget(null);
      return;
    }
    setPickerTarget(target);
    setShowPicker(true);
  };

  const pickerValue = useMemo(() => {
    if (pickerTarget === 'new') return newDue ?? new Date();
    if (pickerTarget) {
      const t = tasks.find((x) => x.id === pickerTarget);
      return t?.due_date ? new Date(`${t.due_date}T00:00:00`) : new Date();
    }
    return new Date();
  }, [pickerTarget, newDue, tasks]);

  const handleDueChange = (event: DateTimePickerEvent, picked?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && picked) {
      if (pickerTarget === 'new') {
        setNewDue(picked);
      } else if (pickerTarget) {
        update(pickerTarget, { due_date: toIsoDate(picked) });
      }
    }
    if (Platform.OS === 'android') {
      setShowPicker(false);
      setPickerTarget(null);
    }
  };

  /** Commits the web inline date editor for a task row: valid YYYY-MM-DD sets the due
   *  date, an emptied field clears it, anything else is discarded on close. */
  const commitRowDate = (taskId: string) => {
    const txt = editingText.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
      update(taskId, { due_date: txt });
    } else if (txt === '') {
      update(taskId, { due_date: null });
    }
    setEditingTaskId(null);
    setEditingText('');
  };

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated };
  const iconBtnBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  // Unchecked checkbox: border-white/30 + bg-white/5 (dark) — matches
  // sampleindex.html's task checkboxes exactly.
  const uncheckedBorder = mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  const uncheckedBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: palette.text.secondary }]}>{`${greeting}, ${displayName.trim() || 'there'}!`}</Text>
        <Text style={[styles.dateLine, { color: palette.text.secondary }]}>{dateStr}</Text>
      </View>

      <GlassChip style={styles.todayStrip} contentStyle={styles.todayStripContent}>
        <Text style={[styles.todayStripText, { color: palette.text.secondary }]} numberOfLines={2}>
          <Text style={{ color: palette.text.primaryAlt, fontWeight: '600' }}>Gym: </Text>
          {todaySummary.gymText}
          {'  ·  '}
          {todaySummary.dosesPending} dose{todaySummary.dosesPending === 1 ? '' : 's'} pending
          {todaySummary.hasRenewals ? `  ·  $${todaySummary.renewingTotal.toFixed(0)} renewing this week` : ''}
        </Text>
      </GlassChip>

      <HabitTrackerCard />

      <GlassCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: palette.accentText }]}>To-Do</Text>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.openCount, { color: palette.text.quaternary }]}>{openCount} open</Text>
            <Pressable
              onPress={() => setAddTaskOpen(true)}
              style={styles.collapseToggle}
              accessibilityRole="button"
              accessibilityLabel="Add task"
            >
              <MaterialCommunityIcons name="plus" size={20} color={palette.accentText} />
            </Pressable>
            <Pressable
              onPress={() => setTodoCollapsed(!todoCollapsed)}
              style={styles.collapseToggle}
              accessibilityRole="button"
              accessibilityLabel={todoCollapsed ? 'Expand to-do list' : 'Collapse to-do list'}
            >
              <MaterialCommunityIcons
                name={todoCollapsed ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={palette.text.secondary}
              />
            </Pressable>
          </View>
        </View>

        {todoCollapsed ? null : (
          <>
            {addTaskOpen ? (
              <View style={styles.addRow}>
                <TextInput
                  autoFocus
                  value={newTitle}
                  onChangeText={setNewTitle}
                  onSubmitEditing={handleAddTask}
                  returnKeyType="done"
                  placeholder="Add a task…"
                  placeholderTextColor={palette.text.quaternary}
                  style={[styles.input, inputStyle, { color: palette.text.primary }]}
                />
                {Platform.OS === 'web' ? (
                  <TextInput
                    value={newDue ? toIsoDate(newDue) : ''}
                    onChangeText={(txt) =>
                      setNewDue(/^\d{4}-\d{2}-\d{2}$/.test(txt) ? new Date(`${txt}T00:00:00`) : null)
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.text.quaternary}
                    style={[styles.webDueInput, inputStyle, { color: palette.text.primary }]}
                  />
                ) : (
                  <Pressable
                    style={[styles.dueTrigger, inputStyle]}
                    onPress={() => openDatePicker('new', newDue ? toIsoDate(newDue) : null)}
                  >
                    <MaterialCommunityIcons
                      name="calendar"
                      size={16}
                      color={newDue ? palette.accentText : palette.text.secondary}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={handleAddTask}
                  style={[styles.addButton, { backgroundColor: iconBtnBg }]}
                  accessibilityRole="button"
                  accessibilityLabel="Add task"
                >
                  <MaterialCommunityIcons name="plus-circle" size={26} color={palette.accentText} />
                </Pressable>
                <Pressable
                  onPress={closeAddTask}
                  style={styles.closeAddButton}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel adding task"
                >
                  <MaterialCommunityIcons name="close" size={18} color={palette.text.faint} />
                </Pressable>
              </View>
            ) : null}

            {showPicker && Platform.OS !== 'web' ? (
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDueChange}
              />
            ) : null}

            {sortedTasks.map((t) => (
              <View key={t.id} style={[styles.taskRow, { borderTopColor: palette.hairline }]}>
                <Pressable
                  onPress={() => update(t.id, { done: !t.done })}
                  style={styles.checkboxWrap}
                >
                  {t.done ? (
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: palette.accentText, backgroundColor: withAlpha(palette.accentText, 0.3) },
                      ]}
                    >
                      <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
                    </View>
                  ) : (
                    <View style={[styles.checkbox, { backgroundColor: uncheckedBg, borderColor: uncheckedBorder }]} />
                  )}
                </Pressable>

                <Text
                  style={[
                    styles.taskTitle,
                    { color: palette.text.primaryAlt },
                    t.done && [styles.taskTitleDone, { color: palette.text.dimmed }],
                  ]}
                  numberOfLines={1}
                >
                  {t.title}
                </Text>

                {Platform.OS === 'web' && editingTaskId === t.id ? (
                  <TextInput
                    autoFocus
                    value={editingText}
                    onChangeText={setEditingText}
                    onSubmitEditing={() => commitRowDate(t.id)}
                    onBlur={() => commitRowDate(t.id)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.text.quaternary}
                    style={[styles.rowDueInput, inputStyle, { color: palette.text.primary }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => openDatePicker(t.id, t.due_date)}
                    style={styles.rowCalendarWrap}
                    accessibilityRole="button"
                    accessibilityLabel={t.due_date ? `Due date ${t.due_date}` : 'Set due date'}
                  >
                    {t.due_date ? (
                      <Text style={[styles.rowDueDate, { color: palette.accentText }]} numberOfLines={1}>
                        {fmt(t.due_date)}
                      </Text>
                    ) : null}
                  </Pressable>
                )}

                <Pressable onPress={() => remove(t.id)} style={styles.removeWrap}>
                  <Text style={[styles.removeGlyph, { color: palette.text.faint }]}>×</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </GlassCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: typeScale.greetingLabel.fontSize,
    fontWeight: typeScale.greetingLabel.fontWeight,
  },
  dateLine: {
    fontSize: typeScale.body.fontSize,
    marginTop: 8,
  },
  todayStrip: {
    marginBottom: 14,
  },
  todayStripContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  todayStripText: {
    fontSize: typeScale.meta.fontSize,
    lineHeight: 18,
  },
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
  // sampleindex.html's "TODAY'S TASKS" section label treatment exactly (text-primary,
  // font-bold, tracking-widest, uppercase, ~12px). Text itself stays "To-Do".
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
  openCount: {
    fontSize: typeScale.metaMedium.fontSize,
    fontWeight: typeScale.metaMedium.fontWeight,
  },
  collapseToggle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingBottom: 12,
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
  dueTrigger: {
    flexBasis: 44,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  webDueInput: {
    flexBasis: 120,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  checkboxWrap: {
    flexBasis: 24,
    flexGrow: 0,
    flexShrink: 0,
  },
  // 24px box, rounded-lg (8px), border-2 — matches sampleindex.html's checkboxes exactly.
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typeScale.itemTitleMedium.fontSize,
    fontWeight: typeScale.itemTitleMedium.fontWeight,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
  },
  rowCalendarWrap: {
    flexBasis: 46,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 46,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDueDate: {
    fontSize: typeScale.meta.fontSize,
    fontWeight: typeScale.metaMedium.fontWeight,
  },
  rowDueInput: {
    flexBasis: 110,
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  removeWrap: {
    flexBasis: 22,
    flexGrow: 0,
    flexShrink: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: {
    fontSize: 16,
    lineHeight: 16,
  },
});

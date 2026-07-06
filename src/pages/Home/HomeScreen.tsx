import React, { useEffect, useMemo, useState } from 'react';
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
import { WeekStrip } from '../../components/WeekStrip';
import { HabitTrackerCard } from './HabitTrackerCard';
import { useRepo } from '../../hooks/useRepo';
import { dueMeta } from '../../lib/dueDate';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { NewRow, TaskRow } from '../../lib/types';
import { type as typeScale } from '../../theme/tokens';
import { useTheme, withAlpha } from '../../theme/ThemeContext';

/** Same relative-day helper as Phone.dc.html's `d(n)` — local "today" offset by n days, ISO date. */
function relativeIso(n: number): string {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return toIsoDate(x);
}

/** Local-calendar ISO date (YYYY-MM-DD) — avoids UTC-shift bugs from toISOString(). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First-run sample tasks mirroring Phone.dc.html's fixture set. */
const seedTasks: NewRow<TaskRow>[] = [
  { title: 'Submit quarterly report', due_date: relativeIso(0), done: false },
  { title: 'Renew car insurance', due_date: relativeIso(1), done: false },
  { title: 'Call dentist to reschedule', due_date: relativeIso(-1), done: false },
  { title: 'Meal prep for the week', due_date: relativeIso(3), done: false },
  { title: 'Book flights for October', due_date: relativeIso(12), done: false },
  { title: 'Read 20 pages', due_date: null, done: true },
];

/** Sort order: soonest-due first, completed tasks sink to bottom. Mirrors Phone.dc.html's `order`. */
function taskOrder(t: TaskRow): number {
  return t.done ? 1e12 : dueMeta(t.due_date).days * 1e6;
}

export default function HomeScreen() {
  const { rows: tasks, insert, update, remove } = useRepo('tasks', seedTasks);
  const { palette, glass, mode, displayName, todoCollapsed, setTodoCollapsed } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'new' | string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const userName = useMemo(() => {
    const trimmedDisplay = displayName.trim();
    if (trimmedDisplay) return trimmedDisplay;
    if (!userEmail) return 'there';
    const local = userEmail.split('@')[0];
    if (!local) return 'there';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [displayName, userEmail]);

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

  const handleAddTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    insert({ title, due_date: newDue ? toIsoDate(newDue) : null, done: false });
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
        <Text style={[styles.greeting, { color: palette.text.secondary }]}>{greeting}</Text>
        <Text style={[styles.name, { color: palette.text.primary }]}>{userName}</Text>
        <Text style={[styles.dateLine, { color: palette.text.secondary }]}>{dateStr}</Text>
        <WeekStrip />
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: palette.accentText }]}>To-Do</Text>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.openCount, { color: palette.text.quaternary }]}>{openCount} open</Text>
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
            <View style={styles.addRow}>
              <TextInput
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
            </View>

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
                    <MaterialCommunityIcons
                      name="calendar"
                      size={16}
                      color={t.due_date ? palette.accentText : palette.text.faint}
                    />
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

      <HabitTrackerCard />
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
  name: {
    fontSize: typeScale.greetingName.fontSize,
    fontWeight: typeScale.greetingName.fontWeight,
    letterSpacing: typeScale.greetingName.letterSpacing,
    marginTop: 2,
    lineHeight: 46,
  },
  dateLine: {
    fontSize: typeScale.body.fontSize,
    marginTop: 8,
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
    flexBasis: 22,
    flexGrow: 0,
    flexShrink: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
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

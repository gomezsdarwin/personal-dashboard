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
import { LinearGradient } from 'expo-linear-gradient';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { UrgencyPill } from '../../components/UrgencyPill';
import { useRepo } from '../../hooks/useRepo';
import { dueMeta, fmt } from '../../lib/dueDate';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { NewRow, TaskRow } from '../../lib/types';
import { accent } from '../../theme/accent';
import { color, type as typeScale } from '../../theme/tokens';

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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
    if (!userEmail) return 'there';
    const local = userEmail.split('@')[0];
    if (!local) return 'there';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }, [userEmail]);

  const sortedTasks = useMemo(
    () => tasks.slice().sort((a, b) => taskOrder(a) - taskOrder(b)),
    [tasks]
  );

  const openCount = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  const dueSummary = useMemo(() => {
    const dueSoon = tasks.filter((t) => !t.done && dueMeta(t.due_date).days <= 1).length;
    return dueSoon > 0 ? `${dueSoon} due today or tomorrow` : 'nothing urgent today';
  }, [tasks]);

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

  const handleDueChange = (event: DateTimePickerEvent, picked?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && picked) {
      setNewDue(picked);
    }
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  const diag = accent.diagonal();

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.dateLine}>
          {dateStr} · {dueSummary}
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>To-Do</Text>
          <Text style={styles.openCount}>{openCount} open</Text>
        </View>

        <View style={styles.addRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAddTask}
            returnKeyType="done"
            placeholder="Add a task…"
            placeholderTextColor={color.text.quaternary}
            style={styles.input}
          />
          <Pressable style={styles.dueTrigger} onPress={() => setShowPicker(true)}>
            <Text style={styles.dueTriggerText}>{newDue ? fmt(toIsoDate(newDue)) : '📅'}</Text>
          </Pressable>
          <Pressable onPress={handleAddTask}>
            <LinearGradient
              colors={diag.colors}
              start={diag.start}
              end={diag.end}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {showPicker ? (
          <DateTimePicker
            value={newDue ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDueChange}
          />
        ) : null}

        {sortedTasks.map((t) => (
          <View key={t.id} style={styles.taskRow}>
            <Pressable
              onPress={() => update(t.id, { done: !t.done })}
              style={styles.checkboxWrap}
            >
              {t.done ? (
                <LinearGradient
                  colors={diag.colors}
                  start={diag.start}
                  end={diag.end}
                  style={styles.checkbox}
                >
                  <Text style={styles.checkmark}>✓</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.checkbox, styles.checkboxOff]} />
              )}
            </Pressable>

            <Text
              style={[styles.taskTitle, t.done && styles.taskTitleDone]}
              numberOfLines={1}
            >
              {t.title}
            </Text>

            <UrgencyPill dueDate={t.due_date} done={t.done} />

            <Pressable onPress={() => remove(t.id)} style={styles.removeWrap}>
              <Text style={styles.removeGlyph}>×</Text>
            </Pressable>
          </View>
        ))}
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
    color: '#4a4558',
  },
  name: {
    fontSize: typeScale.greetingName.fontSize,
    fontWeight: typeScale.greetingName.fontWeight,
    letterSpacing: typeScale.greetingName.letterSpacing,
    color: color.text.primary,
    marginTop: 2,
    lineHeight: 46,
  },
  dateLine: {
    fontSize: typeScale.body.fontSize,
    color: color.text.secondary,
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
  cardTitle: {
    fontSize: typeScale.cardTitleLg.fontSize,
    fontWeight: typeScale.cardTitleLg.fontWeight,
    color: color.text.primaryAlt,
  },
  openCount: {
    fontSize: typeScale.metaMedium.fontSize,
    fontWeight: typeScale.metaMedium.fontWeight,
    color: color.text.quaternary,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: color.text.primary,
  },
  dueTrigger: {
    flexBasis: 44,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  dueTriggerText: {
    fontSize: 13,
    color: color.text.secondary,
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  checkboxWrap: {
    flexBasis: 24,
    flexGrow: 0,
    flexShrink: 0,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: typeScale.itemTitleMedium.fontSize,
    fontWeight: typeScale.itemTitleMedium.fontWeight,
    color: color.text.primaryAlt,
  },
  taskTitleDone: {
    color: color.text.dimmed,
    textDecorationLine: 'line-through',
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
    color: color.text.faint,
    fontSize: 16,
    lineHeight: 16,
  },
});

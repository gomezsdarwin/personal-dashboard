import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { useRepo } from '../../hooks/useRepo';
import { color, radius, spacing, type } from '../../theme/tokens';
import { accent } from '../../theme/accent';
import type { ExerciseRow, PersonalRecordRow, WorkoutSetRow } from '../../lib/types';
import { aggregateWeeklyVolume } from './weeklyVolume';

const EXERCISE_SEED: Array<Omit<ExerciseRow, 'id' | 'user_id' | 'created_at'>> = [
  { name: 'Bench Press', scheme: '4 × 8', weight: '185 lb', is_pr: true, day_label: 'Push Day', position: 0 },
  { name: 'Overhead Press', scheme: '3 × 10', weight: '95 lb', is_pr: false, day_label: 'Push Day', position: 1 },
  { name: 'Incline DB Press', scheme: '3 × 12', weight: '60 lb', is_pr: false, day_label: 'Push Day', position: 2 },
  { name: 'Cable Fly', scheme: '3 × 15', weight: '30 lb', is_pr: false, day_label: 'Push Day', position: 3 },
  { name: 'Triceps Pushdown', scheme: '3 × 15', weight: '55 lb', is_pr: true, day_label: 'Push Day', position: 4 },
];

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const VOLUME_SEED: Array<Omit<WorkoutSetRow, 'id' | 'user_id' | 'created_at'>> = [62, 48, 80, 30, 92, 70, 12].map(
  (v, day_of_week) => ({ day_of_week, volume: v, logged_on: TODAY_ISO })
);

const PR_SEED: Array<Omit<PersonalRecordRow, 'id' | 'user_id' | 'created_at'>> = [
  { lift: 'Bench', value: '205' },
  { lift: 'Squat', value: '285' },
  { lift: 'Deadlift', value: '335' },
];

const CHART_HEIGHT = 130;

/**
 * Gym — workout tracker: today's session (editable exercise list), a weekly-volume
 * bar chart aggregated from workout_sets, and a row of PR chips.
 */
export default function GymScreen() {
  const exercises = useRepo('exercises', EXERCISE_SEED);
  const workoutSets = useRepo('workout_sets', VOLUME_SEED);
  const prs = useRepo('personal_records', PR_SEED);

  const orderedExercises = useMemo(
    () => [...exercises.rows].sort((a, b) => a.position - b.position),
    [exercises.rows]
  );

  const volumeBars = useMemo(() => aggregateWeeklyVolume(workoutSets.rows), [workoutSets.rows]);

  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftScheme, setDraftScheme] = useState('');
  const [draftWeight, setDraftWeight] = useState('');
  const [draftPr, setDraftPr] = useState(false);

  const resetDraft = () => {
    setDraftName('');
    setDraftScheme('');
    setDraftWeight('');
    setDraftPr(false);
    setShowAdd(false);
  };

  const submitDraft = () => {
    const name = draftName.trim();
    if (!name) return;
    const nextPosition =
      orderedExercises.length > 0 ? Math.max(...orderedExercises.map((e) => e.position)) + 1 : 0;
    exercises.insert({
      name,
      scheme: draftScheme.trim() || '—',
      weight: draftWeight.trim() || '—',
      is_pr: draftPr,
      day_label: 'Push Day',
      position: nextPosition,
    });
    resetDraft();
  };

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={styles.title}>🏋️ Gym</Text>
        <Text style={styles.subtitle}>
          {`Today · Push Day · ${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}`}
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Today's session</Text>

        {orderedExercises.map((ex) => (
          <Pressable
            key={ex.id}
            style={styles.exerciseRow}
            onLongPress={() => exercises.remove(ex.id)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Text style={styles.exerciseScheme}>{ex.scheme}</Text>
            </View>
            {ex.is_pr && (
              <LinearGradient
                colors={['#ffb020', '#ff7a45']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.87, y: 1 }}
                style={styles.prPill}
              >
                <Text style={styles.prPillText}>PR</Text>
              </LinearGradient>
            )}
            <Text style={styles.exerciseWeight}>{ex.weight}</Text>
            <Pressable
              hitSlop={8}
              onPress={() => exercises.remove(ex.id)}
              style={styles.removeGlyph}
            >
              <Text style={styles.removeGlyphText}>×</Text>
            </Pressable>
          </Pressable>
        ))}

        {showAdd ? (
          <View style={styles.addForm}>
            <View style={styles.addInputsRow}>
              <TextInput
                style={[styles.input, styles.inputName]}
                placeholder="Exercise name"
                placeholderTextColor={color.text.faint}
                value={draftName}
                onChangeText={setDraftName}
              />
            </View>
            <View style={styles.addInputsRow}>
              <TextInput
                style={[styles.input, styles.inputSmall]}
                placeholder="Scheme (4 × 8)"
                placeholderTextColor={color.text.faint}
                value={draftScheme}
                onChangeText={setDraftScheme}
              />
              <TextInput
                style={[styles.input, styles.inputSmall]}
                placeholder="Weight (185 lb)"
                placeholderTextColor={color.text.faint}
                value={draftWeight}
                onChangeText={setDraftWeight}
              />
            </View>
            <View style={styles.addActionsRow}>
              <Pressable
                style={[styles.prToggle, draftPr && styles.prToggleActive]}
                onPress={() => setDraftPr((v) => !v)}
              >
                <Text style={[styles.prToggleText, draftPr && styles.prToggleTextActive]}>PR</Text>
              </Pressable>
              <View style={styles.addActionsSpacer} />
              <Pressable style={styles.cancelBtn} onPress={resetDraft}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.addBtn} onPress={submitDraft}>
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addTrigger} onPress={() => setShowAdd(true)}>
            <Text style={styles.addTriggerText}>+ Add exercise</Text>
          </Pressable>
        )}
      </GlassCard>

      <GlassCard style={styles.volumeCard}>
        <View style={styles.volumeHeader}>
          <Text style={styles.cardTitle}>Weekly volume</Text>
          <Text style={styles.volumeCaption}>lbs lifted</Text>
        </View>
        <View style={styles.chartArea}>
          {volumeBars.map((bar) => (
            <View key={bar.dayOfWeek} style={styles.chartColumn}>
              <View style={styles.chartBarTrack}>
                <LinearGradient
                  colors={accent.vertical().colors}
                  start={accent.vertical().start}
                  end={accent.vertical().end}
                  style={[styles.chartBar, { height: `${bar.pct}%` }]}
                />
              </View>
              <Text style={styles.chartLabel}>{bar.letter}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <View style={styles.prRow}>
        {prs.rows.map((pr) => (
          <GlassChip key={pr.id} style={styles.prChip}>
            <Text style={styles.prValue}>{pr.value}</Text>
            <Text style={styles.prLift}>{pr.lift}</Text>
          </GlassChip>
        ))}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: type.screenTitle.fontSize,
    fontWeight: type.screenTitle.fontWeight,
    letterSpacing: type.screenTitle.letterSpacing,
    color: color.text.primaryAlt,
  },
  subtitle: {
    fontSize: type.body.fontSize,
    color: color.text.secondaryAlt,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    color: color.text.primaryAlt,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: type.itemTitle.fontWeight,
    color: color.text.primaryAlt,
  },
  exerciseScheme: {
    fontSize: type.meta.fontSize,
    color: color.text.tertiary,
    marginTop: 2,
  },
  prPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  prPillText: {
    fontSize: type.pill.fontSize,
    fontWeight: type.pill.fontWeight,
    color: '#ffffff',
  },
  exerciseWeight: {
    fontSize: type.bodyMedium.fontSize,
    fontWeight: '700',
    color: color.text.primaryAlt,
    minWidth: 54,
    textAlign: 'right',
  },
  removeGlyph: {
    paddingLeft: 4,
  },
  removeGlyphText: {
    fontSize: 18,
    color: color.text.faint,
    fontWeight: '600',
  },
  addTrigger: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  addTriggerText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
    color: color.text.secondary,
  },
  addForm: {
    marginTop: 4,
    paddingTop: 12,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    gap: 8,
  },
  addInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: 'rgba(120,110,150,0.2)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: type.meta.fontSize,
    color: color.text.primaryAlt,
  },
  inputName: {},
  inputSmall: {},
  addActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addActionsSpacer: {
    flex: 1,
  },
  prToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(120,110,150,0.25)',
  },
  prToggleActive: {
    backgroundColor: '#ff9540',
    borderColor: '#ff9540',
  },
  prToggleText: {
    fontSize: type.pill.fontSize,
    fontWeight: type.pill.fontWeight,
    color: color.text.tertiary,
  },
  prToggleTextActive: {
    color: '#ffffff',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: type.metaSemibold.fontSize,
    color: color.text.tertiary,
    fontWeight: '600',
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.input,
    backgroundColor: color.text.primaryAlt,
  },
  addBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
  volumeCard: {
    marginTop: 14,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  volumeCaption: {
    fontSize: type.meta.fontSize,
    color: color.text.tertiary,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: CHART_HEIGHT,
    paddingHorizontal: 4,
  },
  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBarTrack: {
    width: '100%',
    height: CHART_HEIGHT - 20,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: color.text.quaternary,
  },
  prRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  prChip: {
    flex: 1,
  },
  prValue: {
    fontSize: 22,
    fontWeight: '700',
    color: color.text.primaryAlt,
    textAlign: 'center',
  },
  prLift: {
    fontSize: type.caption.fontSize,
    color: color.text.tertiary,
    marginTop: 2,
    textAlign: 'center',
  },
});

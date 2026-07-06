import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from '../../components/GlassCard';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useRepo } from '../../hooks/useRepo';
import { SplitEditor } from './SplitEditor';
import { HistoryModal } from './HistoryModal';
import {
  DEMO_SESSIONS,
  SPLITS,
  getDefaultSlots,
  getMuscle,
  getSlotOptions,
  findSlot,
  todaySplit,
  type ExerciseOption,
} from '../../data/workouts';
import type { GymSessionExercise, GymSessionRow, GymSet, GymSplitConfigEntry } from '../../lib/types';

// ---------------------------------------------------------------------------
// Local state shapes (LogTab-only; not persisted directly — see saveSession)
// ---------------------------------------------------------------------------

type SetStatus = 'pending' | 'hit' | 'miss';

type LocalSet = {
  weight: number | string;
  reps: number | string;
  status: SetStatus;
  /** Known target rep count carried forward from the last session, or null
   * if this exercise has never been logged before (drives the "direct log"
   * bare-input case per spec §6.4). */
  target: number | string | null;
};

type LocalExercise = {
  slot: string;
  id: string;
  name: string;
  muscle: string;
  options: ExerciseOption[];
  sets: [LocalSet, LocalSet, LocalSet];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function hasRepValue(reps: number | string): boolean {
  if (typeof reps === 'number') return reps > 0;
  return reps !== '' && reps != null;
}

/** For every exercise id seen across all sessions (excluding today), the most
 * recent prior sets logged for it. Mirrors spec §6.3 step 2. */
function buildLastData(sessions: GymSessionRow[], today: string): Record<string, GymSet[]> {
  const result: Record<string, GymSet[]> = {};
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sorted) {
    if (session.date === today) continue;
    for (const ex of session.exercises) {
      if (!(ex.id in result)) {
        result[ex.id] = ex.sets;
      }
    }
  }
  return result;
}

/** Merges a slot's static-library options with any user-added alternatives
 * persisted on the split config entry (see `GymSplitConfigEntry.extraOptions`). */
function mergeSlotOptions(slot: string, extraOptions: ExerciseOption[] | undefined): ExerciseOption[] {
  const options = getSlotOptions(slot);
  if (!extraOptions || extraOptions.length === 0) return options;
  return [...options, ...extraOptions.filter((o) => !options.some((x) => x.id === o.id))];
}

function buildSets(last: GymSet[] | undefined, fallbackWeight: number): [LocalSet, LocalSet, LocalSet] {
  if (last && last.length === 3) {
    return last.map((s) => ({
      weight: s.weight,
      reps: '',
      status: 'pending' as SetStatus,
      target: hasRepValue(s.reps) ? s.reps : null,
    })) as [LocalSet, LocalSet, LocalSet];
  }
  return [0, 1, 2].map(() => ({
    weight: fallbackWeight || 0,
    reps: '',
    status: 'pending' as SetStatus,
    target: null,
  })) as [LocalSet, LocalSet, LocalSet];
}

/** buildExerciseList per spec §6.3: config entries (or default slots when no
 * config exists yet) -> hydrated LocalExercise list, seeded from lastData. */
function buildExerciseList(
  splitId: string,
  lastData: Record<string, GymSet[]>,
  config: GymSplitConfigEntry[] | null
): LocalExercise[] {
  const entries: GymSplitConfigEntry[] =
    config && config.length > 0
      ? config
      : getDefaultSlots(splitId).map((s) => ({ slot: s.slot, id: s.slot }) as GymSplitConfigEntry);

  const built: LocalExercise[] = [];
  for (const entry of entries) {
    if (entry.custom) {
      built.push({
        slot: entry.slot,
        id: entry.id,
        name: entry.name,
        muscle: entry.muscle,
        options: [{ id: entry.id, name: entry.name, defaultWeight: entry.defaultWeight }],
        sets: buildSets(lastData[entry.id], entry.defaultWeight),
      });
      continue;
    }
    const options = mergeSlotOptions(entry.slot, entry.extraOptions);
    if (options.length === 0) continue; // slot no longer exists in the library
    const selected = options.find((o) => o.id === entry.id) ?? options[0];
    built.push({
      slot: entry.slot,
      id: selected.id,
      name: selected.name,
      muscle: getMuscle(entry.slot) ?? '',
      options,
      sets: buildSets(lastData[selected.id], selected.defaultWeight),
    });
  }
  return built;
}

/** Rehydrates from an already-saved today+split session (spec §6.3 step 4).
 * `config` (the split's current config, if any) supplies persisted custom
 * alternatives so the Swap sheet still lists them for an already-logged day. */
function rehydrateFromSession(
  session: GymSessionRow,
  config: GymSplitConfigEntry[] | null
): { exercises: LocalExercise[]; collapsed: Set<number> } {
  const extraOptionsBySlot = new Map<string, ExerciseOption[]>();
  for (const entry of config ?? []) {
    if (!entry.custom && entry.extraOptions && entry.extraOptions.length > 0) {
      extraOptionsBySlot.set(entry.slot, entry.extraOptions);
    }
  }
  const collapsed = new Set<number>();
  const exercises = session.exercises.map((ex, idx) => {
    const slot = ex.slot || findSlot(ex.id);
    const options = mergeSlotOptions(slot, extraOptionsBySlot.get(slot));
    const sets = ex.sets.map((s) => {
      const hit = hasRepValue(s.reps);
      return {
        weight: s.weight,
        reps: s.reps,
        status: (hit ? 'hit' : 'pending') as SetStatus,
        target: hit ? s.reps : null,
      };
    }) as [LocalSet, LocalSet, LocalSet];
    if (sets.every((s) => s.status !== 'pending')) collapsed.add(idx);
    return {
      slot,
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      options: options.length > 0 ? options : [{ id: ex.id, name: ex.name, defaultWeight: Number(ex.sets[0]?.weight) || 0 }],
      sets,
    };
  });
  return { exercises, collapsed };
}

// ---------------------------------------------------------------------------
// LogTab
// ---------------------------------------------------------------------------

export function LogTab() {
  const sessionsRepo = useRepo('gym_sessions', DEMO_SESSIONS);
  const configRepo = useRepo('gym_split_config');

  const today = useMemo(() => todayIso(), []);
  const [selectedSplit, setSelectedSplit] = useState<string | null>(todaySplit());
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [swapOpenIdx, setSwapOpenIdx] = useState<number | null>(null);
  const [historyModalEx, setHistoryModalEx] = useState<LocalExercise | null>(null);
  const [tuneIdx, setTuneIdx] = useState<number | null>(null);
  const [tuneValue, setTuneValue] = useState('');
  const [editHitKey, setEditHitKey] = useState<string | null>(null);
  const [editHitValue, setEditHitValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const lastData = useMemo(() => buildLastData(sessionsRepo.rows, today), [sessionsRepo.rows, today]);

  const splitLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of SPLITS) {
      map[s.id] = configRepo.rows.find((c) => c.split_id === s.id)?.label || s.label;
    }
    return map;
  }, [configRepo.rows]);

  // Rebuild/rehydrate the exercise list whenever the selected split changes,
  // or the underlying repos settle/mutate (e.g. right after Save Session).
  useEffect(() => {
    if (sessionsRepo.loading || configRepo.loading) return;
    if (!selectedSplit) {
      setExercises([]);
      setCollapsed(new Set());
      setCurrentSessionId(null);
      setSaved(false);
      setSwapOpenIdx(null);
      setEditMode(false);
      return;
    }
    const configRow = configRepo.rows.find((c) => c.split_id === selectedSplit);
    const existing = sessionsRepo.rows.find((s) => s.date === today && s.split === selectedSplit);
    if (existing) {
      const { exercises: ex, collapsed: col } = rehydrateFromSession(existing, configRow?.config ?? null);
      setExercises(ex);
      setCollapsed(col);
      setCurrentSessionId(existing.id);
      setSaved(true);
    } else {
      setExercises(buildExerciseList(selectedSplit, lastData, configRow?.config ?? null));
      setCollapsed(new Set());
      setCurrentSessionId(null);
      setSaved(false);
    }
    setSwapOpenIdx(null);
    setEditMode(false);
  }, [selectedSplit, sessionsRepo.loading, configRepo.loading, sessionsRepo.rows, configRepo.rows, lastData, today]);

  // --- set-logging state machine (spec §6.4) --------------------------------

  function mutateExercise(exIdx: number, fn: (ex: LocalExercise) => LocalExercise) {
    setExercises((prev) => prev.map((ex, i) => (i === exIdx ? fn(ex) : ex)));
    setSaved(false);
  }

  function mutateSet(exIdx: number, setIdx: number, fn: (s: LocalSet) => LocalSet) {
    mutateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? fn(s) : s)) as [LocalSet, LocalSet, LocalSet],
    }));
  }

  function checkAutoCollapse(exIdx: number, sets: [LocalSet, LocalSet, LocalSet]) {
    if (sets.every((s) => s.status !== 'pending')) {
      setCollapsed((prev) => new Set(prev).add(exIdx));
    }
  }

  function hitSet(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx];
    const target = ex.sets[setIdx].target;
    const nextSets = ex.sets.map((s, j) =>
      j === setIdx ? { ...s, reps: target ?? s.reps, status: 'hit' as SetStatus } : s
    ) as [LocalSet, LocalSet, LocalSet];
    setExercises((prev) => prev.map((e, i) => (i === exIdx ? { ...e, sets: nextSets } : e)));
    setSaved(false);
    checkAutoCollapse(exIdx, nextSets);
  }

  function startMiss(exIdx: number, setIdx: number) {
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: '', status: 'miss' }));
  }

  function setMissReps(exIdx: number, setIdx: number, value: string) {
    const ex = exercises[exIdx];
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: value }));
    if (value.trim() !== '') {
      const nextSets = ex.sets.map((s, j) => (j === setIdx ? { ...s, reps: value } : s)) as [LocalSet, LocalSet, LocalSet];
      checkAutoCollapse(exIdx, nextSets);
    }
  }

  function directLog(exIdx: number, setIdx: number, value: string) {
    const ex = exercises[exIdx];
    const status: SetStatus = value.trim() !== '' ? 'hit' : 'pending';
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: value, status }));
    if (status === 'hit') {
      const nextSets = ex.sets.map((s, j) => (j === setIdx ? { ...s, reps: value, status } : s)) as [
        LocalSet,
        LocalSet,
        LocalSet,
      ];
      checkAutoCollapse(exIdx, nextSets);
    }
  }

  function updateHitReps(exIdx: number, setIdx: number, value: string) {
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: value }));
  }

  function resetSet(exIdx: number, setIdx: number) {
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: '', status: 'pending' }));
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(exIdx);
      return next;
    });
  }

  function updateWeight(exIdx: number, value: number | string) {
    mutateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s, weight: value })) as [LocalSet, LocalSet, LocalSet],
    }));
  }

  function swapExercise(exIdx: number, newId: string) {
    const ex = exercises[exIdx];
    const option = ex.options.find((o) => o.id === newId);
    if (!option) return;
    const last = lastData[newId];
    mutateExercise(exIdx, () => ({
      ...ex,
      id: option.id,
      name: option.name,
      sets: buildSets(last, option.defaultWeight),
    }));
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(exIdx);
      return next;
    });
    setSwapOpenIdx(null);
  }

  // --- split editor (spec §6.8) ----------------------------------------------

  async function handleEditorSave(newConfig: GymSplitConfigEntry[], newLabel: string) {
    if (!selectedSplit) return;
    const defaultLabel = SPLITS.find((s) => s.id === selectedSplit)?.label ?? selectedSplit;
    const trimmed = newLabel.trim();
    const labelOverride = trimmed && trimmed !== defaultLabel ? trimmed : null;
    const existingConfig = configRepo.rows.find((c) => c.split_id === selectedSplit);
    if (existingConfig) {
      await configRepo.update(existingConfig.id, { split_id: selectedSplit, config: newConfig, label: labelOverride });
    } else {
      await configRepo.insert({ split_id: selectedSplit, config: newConfig, label: labelOverride });
    }
    setExercises(buildExerciseList(selectedSplit, lastData, newConfig));
    setCollapsed(new Set());
    setSwapOpenIdx(null);
    setSaved(false);
    setEditMode(false);
  }

  // --- session history deletion (spec-adjacent; opened from HistoryModal) ----

  async function deleteHistoryEntry(exerciseId: string, date: string) {
    const session = sessionsRepo.rows.find((s) => s.date === date && s.exercises.some((e) => e.id === exerciseId));
    if (!session) return;
    const remaining = session.exercises.filter((e) => e.id !== exerciseId);
    if (remaining.length === 0) {
      await sessionsRepo.remove(session.id);
    } else {
      await sessionsRepo.update(session.id, { exercises: remaining });
    }
  }

  // --- save session (spec §6.9) ----------------------------------------------

  async function saveSession() {
    if (!selectedSplit) return;
    const payload: GymSessionExercise[] = exercises.map((ex) => ({
      slot: ex.slot,
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })) as [GymSet, GymSet, GymSet],
    }));
    const existing = sessionsRepo.rows.find((s) => s.date === today && s.split === selectedSplit);
    if (existing) {
      await sessionsRepo.update(existing.id, { date: today, split: selectedSplit, exercises: payload });
      setCurrentSessionId(existing.id);
    } else {
      const created = await sessionsRepo.insert({ date: today, split: selectedSplit, exercises: payload });
      setCurrentSessionId(created.id);
    }
    setSaved(true);
  }

  // --- render ------------------------------------------------------------

  const { palette } = useTheme();

  return (
    <View>
      <SplitPicker
        selected={selectedSplit}
        labels={splitLabels}
        onSelect={setSelectedSplit}
        onEdit={() => setEditMode(true)}
      />

      {!selectedSplit ? (
        <GlassCard style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>No split selected — choose one above.</Text>
        </GlassCard>
      ) : editMode ? (
        <SplitEditor
          splitId={selectedSplit}
          currentConfig={configRepo.rows.find((c) => c.split_id === selectedSplit)?.config ?? null}
          currentLabel={splitLabels[selectedSplit] ?? selectedSplit}
          onSave={handleEditorSave}
          onCancel={() => setEditMode(false)}
        />
      ) : (
        <>
          {exercises.map((ex, idx) =>
            collapsed.has(idx) ? (
              <DoneExerciseCard key={`${ex.slot}-${idx}`} exercise={ex} onExpand={() => {
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  next.delete(idx);
                  return next;
                });
              }} />
            ) : (
              <ExerciseCard
                key={`${ex.slot}-${idx}`}
                exIdx={idx}
                exercise={ex}
                lastWeight={lastData[ex.id]?.[0]?.weight}
                tuning={tuneIdx === idx}
                tuneValue={tuneValue}
                onTuneStart={() => {
                  setTuneIdx(idx);
                  setTuneValue(String(ex.sets[0].weight ?? ''));
                }}
                onTuneChange={setTuneValue}
                onTuneCommit={() => {
                  const num = Number(tuneValue);
                  updateWeight(idx, Number.isFinite(num) && tuneValue.trim() !== '' ? num : tuneValue);
                  setTuneIdx(null);
                }}
                onSwapOpen={() => setSwapOpenIdx(idx)}
                onHistoryOpen={() => setHistoryModalEx(ex)}
                editHitKey={editHitKey}
                onEditHitStart={(setIdx) => {
                  setEditHitKey(`${idx}-${setIdx}`);
                  setEditHitValue(String(ex.sets[setIdx].reps ?? ''));
                }}
                editHitValue={editHitValue}
                onEditHitChange={setEditHitValue}
                onEditHitCommit={(setIdx) => {
                  updateHitReps(idx, setIdx, editHitValue);
                  setEditHitKey(null);
                }}
                onHit={(setIdx) => hitSet(idx, setIdx)}
                onMissStart={(setIdx) => startMiss(idx, setIdx)}
                onMissChange={(setIdx, value) => setMissReps(idx, setIdx, value)}
                onDirectLog={(setIdx, value) => directLog(idx, setIdx, value)}
                onReset={(setIdx) => resetSet(idx, setIdx)}
              />
            )
          )}

          {exercises.length > 0 && (
            <Pressable
              style={[
                styles.saveBtn,
                { backgroundColor: saved ? palette.successBg : palette.success, shadowColor: palette.success },
                saved && styles.saveBtnSaved,
              ]}
              onPress={saveSession}
              disabled={saved}
            >
              <Text style={[styles.saveBtnText, saved && { color: palette.success }]}>
                {saved ? '✓ Saved' : 'Save Session'}
              </Text>
            </Pressable>
          )}

          {swapOpenIdx !== null && (
            <SwapModal
              exercise={exercises[swapOpenIdx]}
              onSelect={(id) => swapExercise(swapOpenIdx, id)}
              onClose={() => setSwapOpenIdx(null)}
            />
          )}

          {historyModalEx && (
            <HistoryModal
              exercise={historyModalEx}
              sessions={sessionsRepo.rows}
              onClose={() => setHistoryModalEx(null)}
              onDeleteEntry={(date) => deleteHistoryEntry(historyModalEx.id, date)}
            />
          )}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SplitPicker — horizontal pill row (RN has no <select>; see spec §6.2)
// ---------------------------------------------------------------------------

function SplitPicker({
  selected,
  labels,
  onSelect,
  onEdit,
}: {
  selected: string | null;
  labels: Record<string, string>;
  onSelect: (id: string | null) => void;
  onEdit: () => void;
}) {
  const { palette } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.splitScroll} contentContainerStyle={styles.splitRow}>
      {SPLITS.map((s) => {
        const active = s.id === selected;
        return (
          <Pressable
            key={s.id}
            style={[
              styles.splitPill,
              { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
              active && { backgroundColor: palette.accentText, borderColor: palette.accentText },
            ]}
            onPress={() => onSelect(s.id)}
          >
            <Text style={[styles.splitPillText, { color: active ? '#ffffff' : palette.text.secondary }]}>{labels[s.id] ?? s.label}</Text>
          </Pressable>
        );
      })}
      {/* Edit button (split config editor) — only visible once a split is
       * selected, per spec §6.8. */}
      {selected != null && (
        <Pressable style={styles.editBtn} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil-outline" size={14} color={palette.text.tertiary} />
          <Text style={[styles.editBtnText, { color: palette.text.tertiary }]}>Edit</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// ExerciseCard (spec §6.5) + set row controls (spec §6.4)
// ---------------------------------------------------------------------------

type ExerciseCardProps = {
  exIdx: number;
  exercise: LocalExercise;
  lastWeight: number | string | undefined;
  tuning: boolean;
  tuneValue: string;
  onTuneStart: () => void;
  onTuneChange: (v: string) => void;
  onTuneCommit: () => void;
  onSwapOpen: () => void;
  onHistoryOpen: () => void;
  editHitKey: string | null;
  onEditHitStart: (setIdx: number) => void;
  editHitValue: string;
  onEditHitChange: (v: string) => void;
  onEditHitCommit: (setIdx: number) => void;
  onHit: (setIdx: number) => void;
  onMissStart: (setIdx: number) => void;
  onMissChange: (setIdx: number, value: string) => void;
  onDirectLog: (setIdx: number, value: string) => void;
  onReset: (setIdx: number) => void;
};

const ROMAN = ['i', 'ii', 'iii'];

function ExerciseCard(props: ExerciseCardProps) {
  const { palette, glass } = useTheme();
  const { exercise: ex } = props;
  const weight = ex.sets[0]?.weight ?? '';

  return (
    <GlassCard style={styles.exerciseCard}>
      <View style={styles.exerciseHeaderRow}>
        <Text style={[styles.exerciseName, { color: palette.text.primaryAlt }]}>{ex.name}</Text>
        {props.lastWeight != null && props.lastWeight !== '' && (
          <Text style={[styles.lastTag, { color: palette.text.quaternary }]}>LAST {props.lastWeight} LBS</Text>
        )}
      </View>

      <View style={styles.actionRow}>
        {ex.options.length > 1 && (
          <Pressable
            style={[styles.actionPill, { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }]}
            onPress={props.onSwapOpen}
          >
            <Text style={[styles.actionPillText, { color: palette.text.secondary }]}>⇄ Swap</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionPill, { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }]}
          onPress={props.onHistoryOpen}
        >
          <Text style={[styles.actionPillText, { color: palette.text.secondary }]}>↗ History</Text>
        </Pressable>
        <View style={styles.actionSpacer} />
        {props.tuning ? (
          <TextInput
            style={[styles.weightInput, { backgroundColor: glass.fill, borderColor: palette.accentText, color: palette.text.primaryAlt }]}
            value={props.tuneValue}
            onChangeText={props.onTuneChange}
            onBlur={props.onTuneCommit}
            onSubmitEditing={props.onTuneCommit}
            keyboardType="numeric"
            autoFocus
          />
        ) : (
          <Pressable
            style={[styles.weightPill, { backgroundColor: palette.track }]}
            onPress={props.onTuneStart}
          >
            <Text style={[styles.weightPillText, { color: palette.text.primaryAlt }]}>≡ {weight} lbs</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.setsList}>
        {ex.sets.map((set, setIdx) => (
          <SetRow
            key={setIdx}
            roman={ROMAN[setIdx]}
            set={set}
            weight={weight}
            isEditingHit={props.editHitKey === `${props.exIdx}-${setIdx}`}
            editHitValue={props.editHitValue}
            onEditHitStart={() => props.onEditHitStart(setIdx)}
            onEditHitChange={props.onEditHitChange}
            onEditHitCommit={() => props.onEditHitCommit(setIdx)}
            onHit={() => props.onHit(setIdx)}
            onMissStart={() => props.onMissStart(setIdx)}
            onMissChange={(value) => props.onMissChange(setIdx, value)}
            onDirectLog={(value) => props.onDirectLog(setIdx, value)}
            onReset={() => props.onReset(setIdx)}
          />
        ))}
      </View>
    </GlassCard>
  );
}

type SetRowProps = {
  roman: string;
  set: LocalSet;
  weight: number | string;
  isEditingHit: boolean;
  editHitValue: string;
  onEditHitStart: () => void;
  onEditHitChange: (v: string) => void;
  onEditHitCommit: () => void;
  onHit: () => void;
  onMissStart: () => void;
  onMissChange: (value: string) => void;
  onDirectLog: (value: string) => void;
  onReset: () => void;
};

function SetRow(props: SetRowProps) {
  const { palette, glass } = useTheme();
  const { set } = props;
  const targetLabel = set.target != null && set.target !== '' ? ` × ${set.target}` : '';

  return (
    <View
      style={[
        styles.setRow,
        { backgroundColor: 'rgba(120,110,150,0.06)', borderColor: 'rgba(120,110,150,0.12)' },
        set.status === 'hit' && { backgroundColor: palette.successBg, borderColor: palette.successBorder },
        set.status === 'miss' && { backgroundColor: palette.dangerBg, borderColor: palette.dangerBorder, opacity: 0.85 },
      ]}
    >
      <Text style={[styles.setRoman, { color: palette.text.quaternary }]}>{props.roman}</Text>
      <Text style={[styles.setInfo, { color: palette.text.secondary }, set.status === 'hit' && { color: palette.success, fontWeight: '600' }]}>
        {props.weight} lbs{targetLabel}
      </Text>

      <View style={styles.setControls}>
        {set.status === 'pending' && set.target != null && (
          <>
            <Pressable
              style={[styles.hitBtn, { backgroundColor: palette.successBg, borderColor: palette.successBorder }]}
              onPress={props.onHit}
            >
              <Text style={[styles.hitBtnText, { color: palette.success }]}>hit it ✓</Text>
            </Pressable>
            <Pressable
              style={[styles.missBtn, { backgroundColor: palette.dangerBg, borderColor: palette.dangerBorder }]}
              onPress={props.onMissStart}
            >
              <Text style={[styles.missBtnText, { color: palette.danger }]}>miss</Text>
            </Pressable>
          </>
        )}
        {set.status === 'pending' && set.target == null && (
          <TextInput
            style={[styles.repsInput, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
            placeholder="reps"
            placeholderTextColor={palette.text.faint}
            keyboardType="numeric"
            value={typeof set.reps === 'number' ? String(set.reps) : set.reps}
            onChangeText={props.onDirectLog}
          />
        )}
        {set.status === 'hit' && props.isEditingHit && (
          <TextInput
            style={[styles.repsInput, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
            value={props.editHitValue}
            onChangeText={props.onEditHitChange}
            onBlur={props.onEditHitCommit}
            onSubmitEditing={props.onEditHitCommit}
            keyboardType="numeric"
            autoFocus
          />
        )}
        {set.status === 'hit' && !props.isEditingHit && (
          <>
            <Pressable onPress={props.onEditHitStart}>
              <Text style={[styles.hitChip, { color: palette.success }]}>{set.reps} reps</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={props.onReset}>
              <Text style={[styles.resetGlyph, { color: palette.text.faint }]}>↺</Text>
            </Pressable>
          </>
        )}
        {set.status === 'miss' && (
          <>
            <TextInput
              style={[styles.repsInput, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
              placeholder="how many?"
              placeholderTextColor={palette.text.faint}
              keyboardType="numeric"
              value={typeof set.reps === 'number' ? String(set.reps) : set.reps}
              onChangeText={props.onMissChange}
              autoFocus
            />
            <Pressable hitSlop={8} onPress={props.onReset}>
              <Text style={[styles.resetGlyph, { color: palette.text.faint }]}>↺</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Done/collapsed summary card (spec §6.4 / §6.10)
// ---------------------------------------------------------------------------

function DoneExerciseCard({ exercise, onExpand }: { exercise: LocalExercise; onExpand: () => void }) {
  const { palette } = useTheme();
  const weight = exercise.sets[0]?.weight ?? '';
  const repsSummary = exercise.sets.map((s) => (s.reps === '' || s.reps == null ? '—' : s.reps)).join(' / ');
  return (
    <Pressable onPress={onExpand}>
      <GlassCard style={styles.doneCard}>
        <View style={styles.doneRow}>
          <View style={[styles.doneBadge, { backgroundColor: palette.success }]}>
            <Text style={styles.doneBadgeText}>✓</Text>
          </View>
          <View style={styles.doneInfo}>
            <Text style={[styles.doneName, { color: palette.text.secondary }]}>{exercise.name}</Text>
            <Text style={[styles.doneSummary, { color: palette.success }]}>{`${weight} lbs · ${repsSummary}`}</Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Swap overlay (spec §6.6) — RN Modal + translucent scrim instead of a web
// fixed-position bottom sheet.
// ---------------------------------------------------------------------------

function SwapModal({
  exercise,
  onSelect,
  onClose,
}: {
  exercise: LocalExercise;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { palette, glass } = useTheme();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
          <View style={styles.sheet}>
            <View style={[styles.sheetHandle, { backgroundColor: palette.track }]} />
            <Text style={[styles.sheetTitle, { color: palette.text.primary }]}>Swap exercise</Text>
            {exercise.options.map((opt) => {
              const active = opt.id === exercise.id;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.swapRow, active && { backgroundColor: palette.successBg }]}
                  onPress={() => onSelect(opt.id)}
                >
                  <Text style={[styles.swapRowName, { color: active ? palette.success : palette.text.primary }]}>{opt.name}</Text>
                  <Text style={[styles.swapRowWeight, { color: palette.text.tertiary }]}>{opt.defaultWeight} lbs</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  splitScroll: {
    marginBottom: 16,
  },
  splitRow: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  splitPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  splitPillText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginLeft: 4,
  },
  editBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: type.body.fontSize,
  },
  exerciseCard: {
    marginBottom: spacing.rowGapMd,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.rowGapSm,
  },
  exerciseName: {
    fontSize: 19,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  lastTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.rowGapMd,
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionPillText: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
  },
  actionSpacer: {
    flex: 1,
  },
  weightPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  weightPillText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  weightInput: {
    width: 70,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: type.caption.fontSize,
    textAlign: 'center',
  },
  setsList: {
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
  },
  setRoman: {
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: undefined,
    width: 16,
  },
  setInfo: {
    flex: 1,
    fontSize: type.meta.fontSize,
  },
  setControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  hitBtnText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  missBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  missBtnText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  repsInput: {
    width: 78,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    fontSize: type.caption.fontSize,
    textAlign: 'center',
  },
  hitChip: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
  },
  resetGlyph: {
    fontSize: 16,
  },
  doneCard: {
    marginBottom: spacing.rowGapMd,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  doneBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  doneInfo: {
    flex: 1,
  },
  doneName: {
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  doneSummary: {
    fontSize: type.caption.fontSize,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 4,
    paddingVertical: 15,
    borderRadius: radius.input,
    alignItems: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  saveBtnSaved: {
    shadowOpacity: 0,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,15,30,0.5)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
  },
  sheet: {
    paddingHorizontal: spacing.screenSide,
    paddingTop: 12,
    paddingBottom: 90,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: '700',
    marginBottom: 10,
  },
  swapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.input,
    marginBottom: 6,
  },
  swapRowName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: '600',
  },
  swapRowWeight: {
    fontSize: type.meta.fontSize,
  },
});

export default LogTab;

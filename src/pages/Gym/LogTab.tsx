import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassCard } from '../../components/GlassCard';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useRepo } from '../../hooks/useRepo';
import { SplitEditor } from './SplitEditor';
import { HistoryModal } from './HistoryModal';
import {
  SPLITS,
  getAllSplits,
  getVisibleSplits,
  getDefaultSlots,
  getMuscle,
  getSlotOptions,
  findSlot,
  todaySplit,
  type ExerciseOption,
  type Split,
} from '../../data/workouts';
import type { GymSessionExercise, GymSessionRow, GymSet, GymSplitConfigEntry } from '../../lib/types';
import { todayIso } from '../../lib/week';

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
 * persisted on the split config entry (see `GymSplitConfigEntry.extraOptions`),
 * excluding any base options the user explicitly removed (see
 * `GymSplitConfigEntry.removedOptionIds`). */
function mergeSlotOptions(
  slot: string,
  extraOptions: ExerciseOption[] | undefined,
  removedOptionIds?: string[]
): ExerciseOption[] {
  const removed = removedOptionIds && removedOptionIds.length > 0 ? new Set(removedOptionIds) : null;
  const options = removed ? getSlotOptions(slot).filter((o) => !removed.has(o.id)) : getSlotOptions(slot);
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
    config == null
      ? getDefaultSlots(splitId).map((s) => ({ slot: s.slot, id: s.slot }) as GymSplitConfigEntry)
      : config;

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
    const options = mergeSlotOptions(entry.slot, entry.extraOptions, entry.removedOptionIds);
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
  config: GymSplitConfigEntry[] | null,
  lastData: Record<string, GymSet[]>
): { exercises: LocalExercise[]; collapsed: Set<number> } {
  const extraOptionsBySlot = new Map<string, ExerciseOption[]>();
  const removedOptionIdsBySlot = new Map<string, string[]>();
  for (const entry of config ?? []) {
    if (!entry.custom && entry.extraOptions && entry.extraOptions.length > 0) {
      extraOptionsBySlot.set(entry.slot, entry.extraOptions);
    }
    if (!entry.custom && entry.removedOptionIds && entry.removedOptionIds.length > 0) {
      removedOptionIdsBySlot.set(entry.slot, entry.removedOptionIds);
    }
  }
  const collapsed = new Set<number>();
  const exercises = session.exercises.map((ex, idx) => {
    const slot = ex.slot || findSlot(ex.id);
    const options = mergeSlotOptions(slot, extraOptionsBySlot.get(slot), removedOptionIdsBySlot.get(slot));
    const priorSets = lastData[ex.id];
    const sets = ex.sets.map((s, setIdx) => {
      const hit = hasRepValue(s.reps);
      // A set not yet committed today still needs its hit/miss target carried
      // forward from the prior session — otherwise a mid-session auto-persist
      // (which re-runs this rehydration) would silently downgrade untouched
      // sets from hit/miss buttons to a bare reps box.
      const priorReps = priorSets?.[setIdx]?.reps;
      const carriedTarget = !hit && priorReps != null && hasRepValue(priorReps) ? priorReps : null;
      return {
        weight: s.weight,
        reps: s.reps,
        status: (hit ? 'hit' : 'pending') as SetStatus,
        target: hit ? s.reps : carriedTarget,
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
  const sessionsRepo = useRepo('gym_sessions');
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
  const skipNextAutoPersist = useRef(true);

  const lastData = useMemo(() => buildLastData(sessionsRepo.rows, today), [sessionsRepo.rows, today]);

  // Unfiltered (includes hidden) so label lookups always resolve — see
  // `visibleSplits` below for the picker's filtered list.
  const allSplits = useMemo(() => getAllSplits(configRepo.rows), [configRepo.rows]);
  const visibleSplits = useMemo(() => getVisibleSplits(configRepo.rows), [configRepo.rows]);

  const splitLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allSplits) {
      map[s.id] = configRepo.rows.find((c) => c.split_id === s.id)?.label || s.label;
    }
    return map;
  }, [allSplits, configRepo.rows]);

  // If the selected split gets hidden/deleted (by this device or another),
  // fall back to the "no split selected" state rather than showing a split
  // that's no longer pickable.
  useEffect(() => {
    if (configRepo.loading) return;
    if (selectedSplit && !visibleSplits.some((s) => s.id === selectedSplit)) {
      setSelectedSplit(null);
    }
  }, [selectedSplit, visibleSplits, configRepo.loading]);

  // Rebuild/rehydrate the exercise list whenever the selected split changes,
  // or the underlying repos settle/mutate (e.g. right after Save Session).
  useEffect(() => {
    if (sessionsRepo.loading || configRepo.loading) return;
    skipNextAutoPersist.current = true;
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
    if (existing && existing.id === currentSessionId) {
      // sessionsRepo.rows just changed because our own persistDraft/saveSession
      // wrote to this exact session (auto-persist runs on every pause in
      // typing) — local `exercises` state is already authoritative, so skip
      // the full rebuild to avoid clobbering in-progress, uncommitted input.
      return;
    }
    if (existing) {
      const { exercises: ex, collapsed: col } = rehydrateFromSession(existing, configRow?.config ?? null, lastData);
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
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: value }));
  }

  function commitMissReps(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx];
    const reps = ex.sets[setIdx].reps;
    const strReps = typeof reps === 'number' ? String(reps) : reps;
    if (strReps.trim() !== '') {
      checkAutoCollapse(exIdx, ex.sets);
    }
    void persistDraft();
  }

  function directLog(exIdx: number, setIdx: number, value: string) {
    mutateSet(exIdx, setIdx, (s) => ({ ...s, reps: value }));
  }

  function commitDirectLog(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx];
    const reps = ex.sets[setIdx].reps;
    const strReps = typeof reps === 'number' ? String(reps) : reps;
    const status: SetStatus = strReps.trim() !== '' ? 'hit' : 'pending';
    const nextSets = ex.sets.map((s, j) => (j === setIdx ? { ...s, status } : s)) as [LocalSet, LocalSet, LocalSet];
    const nextExercises = exercises.map((e, i) => (i === exIdx ? { ...e, sets: nextSets } : e));
    setExercises(nextExercises);
    setSaved(false);
    if (status === 'hit') {
      checkAutoCollapse(exIdx, nextSets);
    }
    void persistDraft(nextExercises);
  }

  function updateHitReps(exIdx: number, setIdx: number, value: string) {
    const ex = exercises[exIdx];
    const nextSets = ex.sets.map((s, j) => (j === setIdx ? { ...s, reps: value } : s)) as [LocalSet, LocalSet, LocalSet];
    const nextExercises = exercises.map((e, i) => (i === exIdx ? { ...e, sets: nextSets } : e));
    setExercises(nextExercises);
    setSaved(false);
    void persistDraft(nextExercises);
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
    const ex = exercises[exIdx];
    const nextSets = ex.sets.map((s) => ({ ...s, weight: value })) as [LocalSet, LocalSet, LocalSet];
    const nextExercises = exercises.map((e, i) => (i === exIdx ? { ...e, sets: nextSets } : e));
    setExercises(nextExercises);
    setSaved(false);
    void persistDraft(nextExercises);
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
    const existingConfig = configRepo.rows.find((c) => c.split_id === selectedSplit);
    const trimmed = newLabel.trim();
    // Custom splits have no static `SPLITS` label to fall back to, so their
    // label is always persisted directly rather than treated as an
    // "override" of a default (an unchanged label must not be written as
    // null, since null would otherwise resolve back to the raw split id).
    let labelOverride: string | null;
    if (existingConfig?.is_custom) {
      labelOverride = trimmed || splitLabels[selectedSplit] || selectedSplit;
    } else {
      const defaultLabel = SPLITS.find((s) => s.id === selectedSplit)?.label ?? selectedSplit;
      labelOverride = trimmed && trimmed !== defaultLabel ? trimmed : null;
    }
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

  // --- create/delete splits (Gym tab: manage splits) --------------------

  async function createSplit(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = `custom_split_${Date.now()}`;
    await configRepo.insert({ split_id: id, config: [], label: trimmed, is_custom: true });
    setSelectedSplit(id);
  }

  async function deleteSplit(splitId: string) {
    const configRow = configRepo.rows.find((c) => c.split_id === splitId);
    if (configRow?.is_custom) {
      await configRepo.remove(configRow.id);
    } else if (configRow) {
      await configRepo.update(configRow.id, { hidden: true });
    } else {
      await configRepo.insert({ split_id: splitId, config: [], hidden: true });
    }
    if (selectedSplit === splitId) {
      setSelectedSplit(null);
    }
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

  async function persistDraft(source: LocalExercise[] = exercises) {
    if (!selectedSplit) return;
    // Sets still 'pending' may hold an uncommitted in-progress keystroke (see
    // directLog/setMissReps) — only persist reps once a set is actually
    // committed (hit/miss), so auto-persist can't be mistaken for a commit by
    // rehydrateFromSession's hasRepValue check.
    const payload: GymSessionExercise[] = source.map((ex) => ({
      slot: ex.slot,
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.status === 'pending' ? '' : s.reps })) as [
        GymSet,
        GymSet,
        GymSet,
      ],
    }));
    const existing = sessionsRepo.rows.find((s) => s.date === today && s.split === selectedSplit);
    if (existing) {
      await sessionsRepo.update(existing.id, { date: today, split: selectedSplit, exercises: payload });
      setCurrentSessionId(existing.id);
    } else {
      const created = await sessionsRepo.insert({ date: today, split: selectedSplit, exercises: payload });
      setCurrentSessionId(created.id);
    }
  }

  /** Saves the session and flips to the "saved" summary state (spec §6.9).
   * Unlike an earlier version of this function, it does NOT clear `exercises`
   * afterward — the form state stays exactly as it was persisted. Rendering
   * gates on `saved` instead: the render below swaps the editable exercise
   * list + Save button for a summary card while `saved` is true. Because the
   * real (non-blank) data stays in state, any later auto-persist or direct
   * edit (commitDirectLog/updateHitReps/etc., which call persistDraft with
   * the current in-memory exercises) can never overwrite today's saved row
   * with a near-empty list — there is no code path left that blanks
   * `exercises` while `currentSessionId` still points at a saved session. */
  async function saveSession() {
    if (!selectedSplit) return;
    await persistDraft();
    setSaved(true);
  }

  // Auto-persist in-progress logging so it survives sub-tab switches, app
  // backgrounding, and page reloads (skip the run right after mount/rehydration).
  useEffect(() => {
    if (skipNextAutoPersist.current) {
      skipNextAutoPersist.current = false;
      return;
    }
    if (!selectedSplit || exercises.length === 0) return;
    const timer = setTimeout(() => {
      void persistDraft();
    }, 700);
    const flush = () => {
      if (document.hidden) {
        clearTimeout(timer);
        void persistDraft();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', flush);
    }
    return () => {
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', flush);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises]);

  // --- render ------------------------------------------------------------

  const { palette } = useTheme();

  return (
    <View>
      <SplitPicker
        selected={selectedSplit}
        labels={splitLabels}
        splits={visibleSplits}
        onSelect={setSelectedSplit}
        onEdit={() => setEditMode(true)}
        onCreate={createSplit}
        onDelete={deleteSplit}
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
          {saved ? (
            <GlassCard style={styles.savedCard}>
              <View style={styles.savedRow}>
                <View style={[styles.savedBadge, { backgroundColor: palette.success }]}>
                  <MaterialCommunityIcons name="check" size={18} color="#ffffff" />
                </View>
                <View style={styles.savedInfo}>
                  <Text style={[styles.savedTitle, { color: palette.text.primaryAlt }]}>Session saved</Text>
                  <Text style={[styles.savedSubtitle, { color: palette.text.tertiary }]}>
                    {`${splitLabels[selectedSplit] ?? selectedSplit} · ${exercises.length} exercise${exercises.length === 1 ? '' : 's'} logged`}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.editSessionBtn, { backgroundColor: palette.track }]}
                onPress={() => setSaved(false)}
              >
                <Text style={[styles.editSessionBtnText, { color: palette.text.primaryAlt }]}>Edit session</Text>
              </Pressable>
            </GlassCard>
          ) : exercises.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>
                No exercises in this split — use Edit Split to add some.
              </Text>
            </GlassCard>
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
                    onMissCommit={(setIdx) => commitMissReps(idx, setIdx)}
                    onDirectLog={(setIdx, value) => directLog(idx, setIdx, value)}
                    onDirectLogCommit={(setIdx) => commitDirectLog(idx, setIdx)}
                    onReset={(setIdx) => resetSet(idx, setIdx)}
                  />
                )
              )}

              <Pressable
                style={[styles.saveBtn, { backgroundColor: palette.success, shadowColor: palette.success }]}
                onPress={saveSession}
              >
                <Text style={styles.saveBtnText}>Save Session</Text>
              </Pressable>
            </>
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
// SplitPicker — button that opens a modal list (RN has no <select>; see spec
// §6.2). Reuses the same Modal + translucent scrim pattern as SwapModal.
// ---------------------------------------------------------------------------

function SplitPicker({
  selected,
  labels,
  splits,
  onSelect,
  onEdit,
  onCreate,
  onDelete,
}: {
  selected: string | null;
  labels: Record<string, string>;
  splits: Split[];
  onSelect: (id: string | null) => void;
  onEdit: () => void;
  onCreate: (label: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const { palette, glass } = useTheme();
  const [listOpen, setListOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newSplitName, setNewSplitName] = useState('');
  const selectedLabel = selected != null ? labels[selected] ?? splits.find((s) => s.id === selected)?.label ?? selected : null;

  function closeList() {
    setListOpen(false);
    setConfirmDeleteId(null);
    setNewSplitName('');
  }

  async function handleCreate() {
    const trimmed = newSplitName.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
    closeList();
  }

  function handleDeletePress(id: string) {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }

  return (
    <View style={styles.splitPickerRow}>
      <View style={styles.splitButtonShadow}>
        <View style={[styles.splitButtonClip, { borderColor: glass.borderBase }]}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
          <Pressable style={styles.splitButton} onPress={() => setListOpen(true)}>
            <Text style={[styles.splitButtonText, { color: selectedLabel ? palette.text.primaryAlt : palette.text.tertiary }]}>
              {selectedLabel ?? 'Choose a split'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={palette.text.tertiary} />
          </Pressable>
        </View>
      </View>
      {/* Edit button (split config editor) — only visible once a split is
       * selected, per spec §6.8. */}
      {selected != null && (
        <Pressable style={styles.editBtn} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil-outline" size={14} color={palette.text.tertiary} />
          <Text style={[styles.editBtnText, { color: palette.text.tertiary }]}>Edit</Text>
        </Pressable>
      )}

      {listOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={closeList}>
          <Pressable style={styles.scrim} onPress={closeList}>
            <Pressable style={styles.sheetWrap} onPress={(e) => e.stopPropagation()}>
              <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
              <View style={styles.sheet}>
                <View style={[styles.sheetHandle, { backgroundColor: palette.track }]} />
                <Text style={[styles.sheetTitle, { color: palette.text.primary }]}>Choose a split</Text>
                {splits.map((s) => {
                  const active = s.id === selected;
                  const confirming = confirmDeleteId === s.id;
                  return (
                    <View key={s.id} style={[styles.swapRow, active && { backgroundColor: palette.successBg }]}>
                      <Pressable
                        style={styles.splitRowMain}
                        onPress={() => {
                          onSelect(s.id);
                          closeList();
                        }}
                      >
                        <Text style={[styles.swapRowName, { color: active ? palette.success : palette.text.primary }]}>
                          {labels[s.id] ?? s.label}
                        </Text>
                        {confirming && (
                          <Text style={[styles.confirmDeleteHint, { color: palette.danger }]}>Tap again to remove</Text>
                        )}
                      </Pressable>
                      <Pressable hitSlop={8} style={styles.splitRowDelete} onPress={() => handleDeletePress(s.id)}>
                        <MaterialCommunityIcons
                          name={confirming ? 'trash-can' : 'trash-can-outline'}
                          size={16}
                          color={confirming ? palette.danger : palette.text.tertiary}
                        />
                      </Pressable>
                    </View>
                  );
                })}

                <View style={styles.createRow}>
                  <TextInput
                    style={[styles.createInput, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
                    placeholder="New split name"
                    placeholderTextColor={palette.text.faint}
                    value={newSplitName}
                    onChangeText={setNewSplitName}
                    onSubmitEditing={handleCreate}
                  />
                  <Pressable style={[styles.createBtn, { backgroundColor: palette.accentText }]} onPress={handleCreate}>
                    <Text style={styles.createBtnText}>+ Create</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
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
  onMissCommit: (setIdx: number) => void;
  onDirectLog: (setIdx: number, value: string) => void;
  onDirectLogCommit: (setIdx: number) => void;
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
            onMissCommit={() => props.onMissCommit(setIdx)}
            onDirectLog={(value) => props.onDirectLog(setIdx, value)}
            onDirectLogCommit={() => props.onDirectLogCommit(setIdx)}
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
  onMissCommit: () => void;
  onDirectLog: (value: string) => void;
  onDirectLogCommit: () => void;
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
            onBlur={props.onDirectLogCommit}
            onSubmitEditing={props.onDirectLogCommit}
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
              onBlur={props.onMissCommit}
              onSubmitEditing={props.onMissCommit}
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
  splitPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  splitButtonShadow: {
    flex: 1,
    borderRadius: radius.chip,
    shadowColor: 'rgba(0,0,0,0.28)',
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  splitButtonClip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    overflow: 'hidden',
  },
  splitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  splitButtonText: {
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
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  savedCard: {
    alignItems: 'stretch',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.rowGapMd,
  },
  savedBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
  },
  savedSubtitle: {
    fontSize: type.meta.fontSize,
    marginTop: 2,
  },
  editSessionBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.chip,
  },
  editSessionBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
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
  splitRowMain: {
    flex: 1,
  },
  splitRowDelete: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  confirmDeleteHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  createRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  createInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.input,
    borderWidth: 1,
    fontSize: type.itemTitle.fontSize,
  },
  createBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.input,
  },
  createBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default LogTab;

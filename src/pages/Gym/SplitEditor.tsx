import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GlassCard } from '../../components/GlassCard';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { MUSCLES, getDefaultSlots, getMuscle, getSlotOptions, type ExerciseOption } from '../../data/workouts';
import type { GymSplitConfigEntry } from '../../lib/types';

// ---------------------------------------------------------------------------
// SplitEditor (spec §6.8) — separate file per this app's idiom (the spec
// describes it as an inline sub-component of LogTab.jsx for the web version;
// this codebase splits pages into their own files, so it ships as its own
// module and is imported by LogTab instead).
// ---------------------------------------------------------------------------

type EditorRow = {
  /** Unique row key. For library rows this is the slot's primary id; for
   * custom rows it's the generated `custom_<ts>` id (slot === id). */
  slot: string;
  enabled: boolean;
  custom: boolean;
  muscle: string;
  // Library-row-only fields:
  options: ExerciseOption[];
  selectedId: string;
  // Custom-row-only fields:
  name: string;
  defaultWeight: number;
};

function libraryRow(id: string, muscle: string, enabled: boolean): EditorRow {
  const options = getSlotOptions(id);
  const primary = options[0];
  return {
    slot: id,
    enabled,
    custom: false,
    muscle,
    options,
    selectedId: id,
    name: primary?.name ?? id,
    defaultWeight: primary?.defaultWeight ?? 0,
  };
}

function customRow(entry: Extract<GymSplitConfigEntry, { custom: true }>): EditorRow {
  return {
    slot: entry.slot,
    enabled: true,
    custom: true,
    muscle: entry.muscle,
    options: [],
    selectedId: entry.id,
    name: entry.name,
    defaultWeight: entry.defaultWeight,
  };
}

/** Builds the ordered `rows` state per spec §6.8. */
function buildRows(splitId: string, currentConfig: GymSplitConfigEntry[] | null): EditorRow[] {
  if (currentConfig && currentConfig.length > 0) {
    const enabledRows: EditorRow[] = [];
    const customRows: EditorRow[] = [];
    const usedSlots = new Set<string>();

    for (const entry of currentConfig) {
      usedSlots.add(entry.slot);
      if (entry.custom) {
        customRows.push(customRow(entry));
      } else {
        const row = libraryRow(entry.slot, getMuscle(entry.slot) ?? '', true);
        // Re-merge any previously-added custom alternatives (persisted on the
        // config entry, since they aren't part of the static MUSCLES library).
        const options =
          entry.extraOptions && entry.extraOptions.length > 0
            ? [...row.options, ...entry.extraOptions.filter((o) => !row.options.some((x) => x.id === o.id))]
            : row.options;
        const selected = options.find((o) => o.id === entry.id) ?? options[0];
        enabledRows.push({ ...row, options, selectedId: selected?.id ?? entry.id, name: selected?.name ?? row.name });
      }
    }

    const disabledRows: EditorRow[] = [];
    for (const [muscle, exercises] of Object.entries(MUSCLES)) {
      for (const ex of exercises) {
        if (usedSlots.has(ex.id)) continue;
        disabledRows.push(libraryRow(ex.id, muscle, false));
      }
    }

    return [...enabledRows, ...customRows, ...disabledRows];
  }

  // No config yet: one row per library exercise, enabled iff in default slots,
  // stable-sorted so enabled rows float to the top.
  const defaultSlotIds = new Set(getDefaultSlots(splitId).map((s) => s.slot));
  const rows: EditorRow[] = [];
  for (const [muscle, exercises] of Object.entries(MUSCLES)) {
    for (const ex of exercises) {
      rows.push(libraryRow(ex.id, muscle, defaultSlotIds.has(ex.id)));
    }
  }
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.enabled === b.r.enabled ? a.i - b.i : a.r.enabled ? -1 : 1))
    .map((x) => x.r);
}

function sortEnabledFirst(rows: EditorRow[]): EditorRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.enabled === b.r.enabled ? a.i - b.i : a.r.enabled ? -1 : 1))
    .map((x) => x.r);
}

type Props = {
  splitId: string;
  currentConfig: GymSplitConfigEntry[] | null;
  currentLabel: string;
  onSave: (config: GymSplitConfigEntry[], label: string) => void;
  onCancel: () => void;
};

export function SplitEditor({ splitId, currentConfig, currentLabel, onSave, onCancel }: Props) {
  const [rows, setRows] = useState<EditorRow[]>(() => buildRows(splitId, currentConfig));
  const [labelInput, setLabelInput] = useState(currentLabel);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newMuscle, setNewMuscle] = useState<string>(Object.keys(MUSCLES)[0] ?? '');
  const { palette, glass } = useTheme();

  function toggle(slot: string) {
    setRows((prev) => sortEnabledFirst(prev.map((r) => (r.slot === slot ? { ...r, enabled: !r.enabled } : r))));
  }

  function pickAlt(slot: string, id: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.slot !== slot || r.custom) return r;
        const opt = r.options.find((o) => o.id === id);
        if (!opt) return r;
        return { ...r, selectedId: id, name: opt.name, defaultWeight: opt.defaultWeight };
      })
    );
  }

  /** Adds a brand-new, user-named alternative to a library slot (not one of
   * the slot's preset `options`) and selects it. Persisted via the row's
   * `options` diffed against the static library at save time. */
  function addAlternative(slot: string, name: string, weight: number) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const opt: ExerciseOption = { id: `alt_${Date.now()}`, name: trimmed, defaultWeight: Number.isFinite(weight) ? weight : 0 };
    setRows((prev) =>
      prev.map((r) =>
        r.slot === slot && !r.custom
          ? { ...r, options: [...r.options, opt], selectedId: opt.id, name: opt.name, defaultWeight: opt.defaultWeight }
          : r
      )
    );
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setRows((prev) => {
      const next = prev.slice();
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setRows((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = prev.slice();
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  function removeCustom(slot: string) {
    setRows((prev) => prev.filter((r) => r.slot !== slot));
  }

  function addCustom() {
    const name = newName.trim();
    if (!name) return;
    const weight = Number(newWeight);
    const id = `custom_${Date.now()}`;
    const row: EditorRow = {
      slot: id,
      enabled: true,
      custom: true,
      muscle: newMuscle,
      options: [],
      selectedId: id,
      name,
      defaultWeight: Number.isFinite(weight) ? weight : 0,
    };
    setRows((prev) => [...prev, row]);
    setNewName('');
    setNewWeight('');
  }

  function handleSave() {
    const config: GymSplitConfigEntry[] = rows
      .filter((r) => r.enabled)
      .map((r) => {
        if (r.custom) {
          return {
            slot: r.slot,
            id: r.selectedId,
            name: r.name,
            defaultWeight: r.defaultWeight,
            muscle: r.muscle,
            custom: true as const,
          };
        }
        const baseOptions = getSlotOptions(r.slot);
        const extraOptions = r.options.filter((o) => !baseOptions.some((b) => b.id === o.id));
        return extraOptions.length > 0
          ? { slot: r.slot, id: r.selectedId, extraOptions }
          : { slot: r.slot, id: r.selectedId };
      });
    onSave(config, labelInput);
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: palette.text.primaryAlt }]}>Edit split</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.cancelBtn, { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }]}
            onPress={onCancel}
          >
            <Text style={[styles.cancelBtnText, { color: palette.text.secondary }]}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, { backgroundColor: palette.success }]} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.labelRow}>
        <Text style={[styles.labelCaption, { color: palette.text.tertiary }]}>SPLIT NAME</Text>
        <TextInput
          style={[styles.labelInput, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
          value={labelInput}
          onChangeText={setLabelInput}
          placeholder={currentLabel}
          placeholderTextColor={palette.text.faint}
        />
      </View>

      <GlassCard style={styles.listCard}>
        {rows.map((row, idx) => (
          <EditorRowView
            key={row.slot}
            row={row}
            isFirst={idx === 0}
            isLast={idx === rows.length - 1}
            onToggle={() => toggle(row.slot)}
            onPickAlt={(id) => pickAlt(row.slot, id)}
            onAddAlt={(name, weight) => addAlternative(row.slot, name, weight)}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
            onRemove={() => removeCustom(row.slot)}
          />
        ))}
      </GlassCard>

      <GlassCard style={styles.addCard}>
        <Text style={[styles.addLabel, { color: palette.text.secondary }]}>Add custom exercise</Text>
        <View style={styles.addInputRow}>
          <TextInput
            style={[styles.addInput, styles.addInputName, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
            placeholder="Name"
            placeholderTextColor={palette.text.faint}
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={addCustom}
          />
          <TextInput
            style={[styles.addInput, styles.addInputWeight, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
            placeholder="lbs"
            placeholderTextColor={palette.text.faint}
            keyboardType="numeric"
            value={newWeight}
            onChangeText={setNewWeight}
            onSubmitEditing={addCustom}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.musclePillRow}>
          {Object.keys(MUSCLES).map((muscle) => {
            const active = muscle === newMuscle;
            return (
              <Pressable
                key={muscle}
                style={[
                  styles.musclePill,
                  { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
                  active && { backgroundColor: palette.accentText, borderColor: palette.accentText },
                ]}
                onPress={() => setNewMuscle(muscle)}
              >
                <Text style={[styles.musclePillText, { color: active ? '#ffffff' : palette.text.secondary }]}>{muscle}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={[styles.addBtn, { backgroundColor: palette.accentText }]} onPress={addCustom}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </Pressable>
      </GlassCard>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row view
// ---------------------------------------------------------------------------

function EditorRowView({
  row,
  isFirst,
  isLast,
  onToggle,
  onPickAlt,
  onAddAlt,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: EditorRow;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onPickAlt: (id: string) => void;
  onAddAlt: (name: string, weight: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { palette, glass } = useTheme();
  const [addingAlt, setAddingAlt] = useState(false);
  const [altName, setAltName] = useState('');
  const [altWeight, setAltWeight] = useState('');

  function commitAlt() {
    if (!altName.trim()) return;
    onAddAlt(altName, Number(altWeight));
    setAddingAlt(false);
    setAltName('');
    setAltWeight('');
  }

  return (
    <View style={[styles.row, { borderBottomColor: palette.hairline }, !row.enabled && styles.rowDisabled]}>
      {/* Rounded-square toggle (matches Home/habit-tracker's checkbox shape language,
          rather than the fully-round knob this used previously). */}
      <Pressable
        style={[
          styles.toggleKnob,
          { backgroundColor: 'rgba(120,110,150,0.14)', borderColor: 'rgba(120,110,150,0.25)' },
          row.enabled && { backgroundColor: palette.success, borderColor: palette.success },
        ]}
        onPress={onToggle}
        hitSlop={6}
      >
        {row.enabled && <Text style={styles.toggleKnobGlyph}>✓</Text>}
      </Pressable>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: row.enabled ? palette.text.primaryAlt : palette.text.tertiary }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.rowMuscle, { color: palette.text.quaternary }]}>{row.muscle}</Text>
        {!row.custom && row.enabled && (
          <View style={styles.altPillRow}>
            {row.options.length > 1 &&
              row.options.map((opt) => {
                const active = opt.id === row.selectedId;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.altPill,
                      { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' },
                      active && { backgroundColor: palette.accentText, borderColor: palette.accentText },
                    ]}
                    onPress={() => onPickAlt(opt.id)}
                  >
                    <Text style={[styles.altPillText, { color: active ? '#ffffff' : palette.text.secondary }]}>{opt.name}</Text>
                  </Pressable>
                );
              })}
            {!addingAlt && (
              <Pressable
                style={[styles.altPill, styles.addAltPill, { borderColor: palette.accentText }]}
                onPress={() => setAddingAlt(true)}
              >
                <Text style={[styles.altPillText, { color: palette.accentText }]}>+ Add alternative</Text>
              </Pressable>
            )}
          </View>
        )}
        {!row.custom && row.enabled && addingAlt && (
          <View style={styles.addAltForm}>
            <TextInput
              style={[styles.addAltInput, styles.addAltInputName, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
              placeholder="Alternative name"
              placeholderTextColor={palette.text.faint}
              value={altName}
              onChangeText={setAltName}
              onSubmitEditing={commitAlt}
              autoFocus
            />
            <TextInput
              style={[styles.addAltInput, styles.addAltInputWeight, { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primaryAlt }]}
              placeholder="lbs"
              placeholderTextColor={palette.text.faint}
              keyboardType="numeric"
              value={altWeight}
              onChangeText={setAltWeight}
              onSubmitEditing={commitAlt}
            />
            <Pressable style={[styles.addAltBtn, { backgroundColor: palette.accentText }]} onPress={commitAlt}>
              <Text style={styles.addAltBtnText}>Add</Text>
            </Pressable>
            <Pressable hitSlop={6} onPress={() => setAddingAlt(false)}>
              <Text style={[styles.addAltCancel, { color: palette.text.tertiary }]}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.rowActions}>
        {row.custom ? (
          <Pressable style={[styles.removeBtn, { backgroundColor: palette.dangerBg }]} onPress={onRemove} hitSlop={8}>
            <Text style={[styles.removeBtnText, { color: palette.danger }]}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.reorderCol}>
            <Pressable style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]} onPress={onMoveUp} disabled={isFirst} hitSlop={4}>
              <Text style={[styles.reorderBtnText, { color: palette.text.tertiary }]}>▲</Text>
            </Pressable>
            <Pressable style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]} onPress={onMoveDown} disabled={isLast} hitSlop={4}>
              <Text style={[styles.reorderBtnText, { color: palette.text.tertiary }]}>▼</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.rowGapMd,
  },
  headerTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
  labelRow: {
    marginBottom: spacing.rowGapMd,
  },
  labelCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  labelInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.input,
    borderWidth: 1,
    fontSize: type.itemTitle.fontSize,
    fontWeight: '600',
  },
  listCard: {
    marginBottom: spacing.rowGapMd,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  toggleKnobGlyph: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: '600',
  },
  rowMuscle: {
    fontSize: type.caption.fontSize,
    marginTop: 1,
  },
  altPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  altPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  altPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addAltPill: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  addAltForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  addAltInput: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 12,
  },
  addAltInputName: {
    flexGrow: 1,
    minWidth: 110,
  },
  addAltInputWeight: {
    width: 56,
    textAlign: 'center',
  },
  addAltBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addAltBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  addAltCancel: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderCol: {
    gap: 2,
  },
  reorderBtn: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  reorderBtnDisabled: {
    opacity: 0.25,
  },
  reorderBtnText: {
    fontSize: 11,
  },
  removeBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  removeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  addCard: {
    marginBottom: spacing.rowGapMd,
  },
  addLabel: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    marginBottom: 10,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.input,
    borderWidth: 1,
    fontSize: type.body.fontSize,
  },
  addInputName: {
    flex: 1,
  },
  addInputWeight: {
    width: 70,
    textAlign: 'center',
  },
  musclePillRow: {
    gap: 8,
    paddingBottom: 12,
  },
  musclePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  musclePillText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.input,
  },
  addBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default SplitEditor;

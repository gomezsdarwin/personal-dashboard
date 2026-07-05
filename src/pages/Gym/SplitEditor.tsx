import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GlassCard } from '../../components/GlassCard';
import { color, radius, spacing, type } from '../../theme/tokens';
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
        const selected = row.options.find((o) => o.id === entry.id) ?? row.options[0];
        enabledRows.push({ ...row, selectedId: selected?.id ?? entry.id, name: selected?.name ?? row.name });
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
  onSave: (config: GymSplitConfigEntry[]) => void;
  onCancel: () => void;
};

export function SplitEditor({ splitId, currentConfig, onSave, onCancel }: Props) {
  const [rows, setRows] = useState<EditorRow[]>(() => buildRows(splitId, currentConfig));
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newMuscle, setNewMuscle] = useState<string>(Object.keys(MUSCLES)[0] ?? '');

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
      .map((r) =>
        r.custom
          ? {
              slot: r.slot,
              id: r.selectedId,
              name: r.name,
              defaultWeight: r.defaultWeight,
              muscle: r.muscle,
              custom: true as const,
            }
          : { slot: r.slot, id: r.selectedId }
      );
    onSave(config);
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Edit split</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>
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
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
            onRemove={() => removeCustom(row.slot)}
          />
        ))}
      </GlassCard>

      <GlassCard style={styles.addCard}>
        <Text style={styles.addLabel}>Add custom exercise</Text>
        <View style={styles.addInputRow}>
          <TextInput
            style={[styles.addInput, styles.addInputName]}
            placeholder="Name"
            placeholderTextColor={color.text.faint}
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={addCustom}
          />
          <TextInput
            style={[styles.addInput, styles.addInputWeight]}
            placeholder="lbs"
            placeholderTextColor={color.text.faint}
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
                style={[styles.musclePill, active && styles.musclePillActive]}
                onPress={() => setNewMuscle(muscle)}
              >
                <Text style={[styles.musclePillText, active && styles.musclePillTextActive]}>{muscle}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={styles.addBtn} onPress={addCustom}>
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
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: EditorRow;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onPickAlt: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.row, !row.enabled && styles.rowDisabled]}>
      <Pressable style={[styles.toggleKnob, row.enabled && styles.toggleKnobOn]} onPress={onToggle} hitSlop={6}>
        {row.enabled && <Text style={styles.toggleKnobGlyph}>✓</Text>}
      </Pressable>

      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, !row.enabled && styles.rowNameDisabled]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.rowMuscle}>{row.muscle}</Text>
        {!row.custom && row.enabled && row.options.length > 1 && (
          <View style={styles.altPillRow}>
            {row.options.map((opt) => {
              const active = opt.id === row.selectedId;
              return (
                <Pressable
                  key={opt.id}
                  style={[styles.altPill, active && styles.altPillActive]}
                  onPress={() => onPickAlt(opt.id)}
                >
                  <Text style={[styles.altPillText, active && styles.altPillTextActive]}>{opt.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.rowActions}>
        {row.custom ? (
          <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={8}>
            <Text style={styles.removeBtnText}>×</Text>
          </Pressable>
        ) : (
          <View style={styles.reorderCol}>
            <Pressable style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]} onPress={onMoveUp} disabled={isFirst} hitSlop={4}>
              <Text style={styles.reorderBtnText}>▲</Text>
            </Pressable>
            <Pressable style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]} onPress={onMoveDown} disabled={isLast} hitSlop={4}>
              <Text style={styles.reorderBtnText}>▼</Text>
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
    color: color.text.primaryAlt,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cancelBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
    color: color.text.secondary,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: color.success,
  },
  saveBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
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
    borderBottomColor: color.hairline,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120,110,150,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(120,110,150,0.25)',
  },
  toggleKnobOn: {
    backgroundColor: color.success,
    borderColor: color.success,
    shadowColor: color.success,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
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
    color: color.text.primaryAlt,
  },
  rowNameDisabled: {
    color: color.text.tertiary,
  },
  rowMuscle: {
    fontSize: type.caption.fontSize,
    color: color.text.quaternary,
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  altPillActive: {
    backgroundColor: color.accentText,
    borderColor: color.accentText,
  },
  altPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: color.text.secondary,
  },
  altPillTextActive: {
    color: '#ffffff',
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
    color: color.text.tertiary,
  },
  removeBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: color.dangerBg,
  },
  removeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: color.danger,
    lineHeight: 18,
  },
  addCard: {
    marginBottom: spacing.rowGapMd,
  },
  addLabel: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: color.text.secondary,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(120,110,150,0.3)',
    fontSize: type.body.fontSize,
    color: color.text.primaryAlt,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  musclePillActive: {
    backgroundColor: color.accentText,
    borderColor: color.accentText,
  },
  musclePillText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '600',
    color: color.text.secondary,
  },
  musclePillTextActive: {
    color: '#ffffff',
  },
  addBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.input,
    backgroundColor: color.accentText,
  },
  addBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default SplitEditor;

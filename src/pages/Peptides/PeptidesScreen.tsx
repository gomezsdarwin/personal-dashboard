import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme, withAlpha } from '../../theme/ThemeContext';
import { accent } from '../../theme/accent';
import { useRepo } from '../../hooks/useRepo';
import type { NewRow, PeptideDoseRow, PeptideFrequency, PeptideInventoryRow, PeptideKind } from '../../lib/types';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const KIND_LABEL: Record<PeptideKind, string> = { peptide: 'Peptides', supplement: 'Supplements' };
const KIND_ORDER: PeptideKind[] = ['peptide', 'supplement'];

const DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type KindGroup<T> = { kind: PeptideKind; items: T[] };

/** Splits a flat row list into peptide/supplement groups (in that order),
 * dropping any group with no rows — used to render both lists with a light
 * "Peptides" / "Supplements" caption between subsections, without splitting
 * them into separate cards. */
function groupByKind<T extends { kind: PeptideKind }>(rows: T[]): KindGroup<T>[] {
  return KIND_ORDER.map((kind) => ({ kind, items: rows.filter((row) => row.kind === kind) })).filter(
    (group) => group.items.length > 0
  );
}

/** Rows persisted before `kind` existed have no such field; treat missing/falsy
 * `kind` as 'peptide' (the pre-existing default) so they don't vanish from both groups. */
function normalizeKind<T extends { kind: PeptideKind }>(rows: T[]): T[] {
  return rows.map((row) => (row.kind ? row : { ...row, kind: 'peptide' }));
}

/** Total amount on hand, in mg — `vials * vial_mg` generalizes across both
 * kinds since `vial_mg` doubles as "amount per unit (mg)" for supplements. */
function amountTotalMg(item: Pick<PeptideInventoryRow, 'vials' | 'vial_mg'>): number {
  const vials = item.vials || 0;
  const vialMg = item.vial_mg || 0;
  return vials * vialMg;
}

/** Formats an mg amount for display, trimming float noise (e.g. 199.99999999997 -> "200"). */
function formatMg(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** Computed recon summary string for a peptide row with valid structured
 * fields, e.g. "5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL" — mirrors the format
 * of the old hand-typed `recon` text. Returns null when the row isn't a
 * peptide, or is missing/zeroed structured fields, so callers can fall back
 * to the legacy `recon` string. */
function reconSummary(item: PeptideInventoryRow): string | null {
  if (item.kind !== 'peptide') return null;
  if (!(item.vial_mg > 0) || !(item.bac_ml > 0) || !(item.dose_mcg > 0)) return null;
  const concentration = item.vial_mg / item.bac_ml; // mg/mL
  const volumePerDose = item.dose_mcg / 1000 / concentration; // mL
  return `${item.vial_mg} mg vial · ${item.bac_ml} mL BAC → ${item.dose_mcg} mcg = ${volumePerDose.toFixed(2)} mL`;
}

/** Short display label for an inventory item's dosing cadence. Defaults to
 * "Daily" when `frequency` is missing (rows persisted before this field
 * existed). */
function frequencyLabel(item: PeptideInventoryRow): string {
  const freq = item.frequency || 'daily';
  switch (freq) {
    case 'everyN': {
      const n = item.frequency_n || 1;
      return `Every ${n} day${n === 1 ? '' : 's'}`;
    }
    case 'weekdays':
      return item.frequency_days
        ? item.frequency_days
            .split(',')
            .filter(Boolean)
            .join(', ')
        : 'Specific days';
    case 'asNeeded':
      return 'As needed';
    case 'daily':
    default:
      return 'Daily';
  }
}

/** Relative "time since last dose" label for an inventory item's
 * `last_taken_at` timestamp. Null (never taken) reads as "No doses logged". */
function lastDoseLabel(lastTakenAt: string | null | undefined): string {
  if (!lastTakenAt) return 'No doses logged';
  const taken = new Date(lastTakenAt);
  if (Number.isNaN(taken.getTime())) return 'No doses logged';
  const now = new Date();
  const startOfTaken = new Date(taken.getFullYear(), taken.getMonth(), taken.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((startOfToday.getTime() - startOfTaken.getTime()) / 86400000);
  if (days <= 0) return 'Taken today';
  if (days === 1) return 'Last dose: yesterday';
  return `Last dose: ${days} days ago`;
}

/**
 * Peptides — dose schedule + inventory. Ports Phone.dc.html's PEPTIDES screen:
 * a "Today's schedule" glass card of toggleable doses, and one glass inventory
 * card per compound with a recon note + doses-remaining progress bar.
 *
 * Scheduling now lives entirely on the inventory item: editing a compound's
 * schedule (amount + time) upserts today's `peptide_doses` row for that
 * compound by name; there is no more freestanding "add a dose" form.
 */
export default function PeptidesScreen() {
  const { palette, glass } = useTheme();
  const doses = useRepo('peptide_doses');
  const inventory = useRepo('peptide_inventory');
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const activeDoseRows = useMemo(
    () =>
      doses.rows.filter((dose) => {
        const invItem = inventory.rows.find((item) => item.name === dose.name);
        return !invItem?.on_break;
      }),
    [doses.rows, inventory.rows]
  );
  const doseGroups = useMemo(() => groupByKind(normalizeKind(activeDoseRows)), [activeDoseRows]);
  const inventoryGroups = useMemo(() => groupByKind(normalizeKind(inventory.rows)), [inventory.rows]);

  const handleDoseToggle = async (dose: PeptideDoseRow) => {
    const nextTaken = !dose.taken;
    await doses.update(dose.id, { taken: nextTaken });

    const invItem = inventory.rows.find((item) => item.name === dose.name);
    if (invItem) {
      const doseMg = invItem.dose_mg || 0;
      const total = amountTotalMg(invItem);
      const currentLeft = invItem.amount_left_mg ?? total;
      const delta = nextTaken ? -doseMg : doseMg;
      const nextLeft = Math.max(0, Math.min(total, currentLeft + delta));
      await inventory.update(invItem.id, {
        amount_left_mg: nextLeft,
        ...(nextTaken ? { last_taken_at: new Date().toISOString() } : {}),
      });
    }
  };

  const handleToggleBreak = async (item: PeptideInventoryRow) => {
    await inventory.update(item.id, { on_break: !item.on_break });
  };

  const handleScheduleSave = async (item: PeptideInventoryRow, amount: string, timeLabel: string, note: string) => {
    const trimmedAmount = amount.trim();
    const trimmedTime = timeLabel.trim();
    await inventory.update(item.id, {
      schedule_amount: trimmedAmount,
      schedule_time_label: trimmedTime,
      note: note.trim(),
    });

    const today = todayIso();
    const existing = doses.rows.find((dose) => dose.name === item.name && dose.scheduled_for === today);

    if (!trimmedAmount && !trimmedTime) {
      if (existing) await doses.remove(existing.id);
      setEditingId(null);
      return;
    }

    if (existing) {
      await doses.update(existing.id, { amount: trimmedAmount, time_label: trimmedTime, kind: item.kind });
    } else {
      await doses.insert({
        name: item.name,
        amount: trimmedAmount,
        time_label: trimmedTime,
        taken: false,
        scheduled_for: today,
        kind: item.kind,
      });
    }
    setEditingId(null);
  };

  return (
    <AppShell>
      <GlassCard style={styles.sectionGap}>
        <Text style={[styles.cardTitle, { color: palette.text.primary }]}>Today&apos;s schedule</Text>
        <View style={styles.doseList}>
          {doseGroups.map((group, index) => (
            <View key={group.kind}>
              {index > 0 ? <View style={[styles.groupDivider, { backgroundColor: palette.hairline }]} /> : null}
              <Text style={[styles.groupLabel, { color: palette.text.tertiary }]}>{KIND_LABEL[group.kind]}</Text>
              <View style={styles.doseGroupList}>
                {group.items.map((dose) => (
                  <DoseRow key={dose.id} dose={dose} onToggle={() => handleDoseToggle(dose)} />
                ))}
              </View>
            </View>
          ))}
          {doses.rows.length === 0 && !doses.loading ? (
            <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>
              No doses scheduled. Set a schedule on an inventory item below.
            </Text>
          ) : null}
        </View>
      </GlassCard>

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: palette.text.primary }]}>Inventory</Text>
        <Pressable
          onPress={() => setShowAddInventory((v) => !v)}
          hitSlop={8}
          style={[styles.addToggleBtn, { backgroundColor: glass.fill }]}
          accessibilityRole="button"
          accessibilityLabel={showAddInventory ? 'Cancel adding compound' : 'Add compound'}
        >
          <Text style={[styles.addToggleGlyph, { color: palette.text.primaryAlt }]}>{showAddInventory ? '×' : '+'}</Text>
        </Pressable>
      </View>

      {showAddInventory ? (
        <GlassCard style={styles.sectionGap}>
          {addError ? <Text style={[styles.addErrorText, { color: palette.danger }]}>{addError}</Text> : null}
          <AddInventoryForm
            onAdd={async (row) => {
              setAddError(null);
              try {
                await inventory.insert(row);
                setShowAddInventory(false);
              } catch (err) {
                setAddError(err instanceof Error ? err.message : 'Failed to add compound. Please try again.');
                throw err;
              }
            }}
          />
        </GlassCard>
      ) : null}

      <View style={styles.inventoryList}>
        {inventoryGroups.map((group, index) => (
          <View key={group.kind} style={styles.inventoryGroup}>
            {index > 0 ? <View style={[styles.groupDivider, { backgroundColor: palette.hairline }]} /> : null}
            <Text style={[styles.groupLabel, { color: palette.text.tertiary }]}>{KIND_LABEL[group.kind]}</Text>
            <View style={styles.inventoryGroupList}>
              {group.items.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  onToggleEdit={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
                  onSaveSchedule={(amount, timeLabel, note) => handleScheduleSave(item, amount, timeLabel, note)}
                  onRemove={() => inventory.remove(item.id)}
                  onToggleBreak={() => handleToggleBreak(item)}
                />
              ))}
            </View>
          </View>
        ))}
        {inventory.rows.length === 0 && !inventory.loading ? (
          <GlassCard>
            <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>No compounds tracked.</Text>
          </GlassCard>
        ) : null}
      </View>
    </AppShell>
  );
}

function DoseRow({ dose, onToggle }: { dose: PeptideDoseRow; onToggle: () => void }) {
  const { palette, mode } = useTheme();
  // Unchecked: border-white/30 + bg-white/5 (dark) — checked: border-primary +
  // bg-primary/30 tinted fill, matching sampleindex.html's task checkboxes exactly.
  const uncheckedBorder = mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';
  const uncheckedBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  return (
    <View style={styles.doseRow}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkboxWrap}>
        {dose.taken ? (
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
      <View style={styles.doseInfo}>
        <Text
          style={[
            styles.doseName,
            { color: palette.text.primary },
            dose.taken && { textDecorationLine: 'line-through', color: palette.text.dimmed },
          ]}
        >
          {dose.name}
        </Text>
        <Text style={[styles.doseAmount, { color: palette.text.tertiary }]}>{dose.amount}</Text>
      </View>
      <Text style={[styles.doseTime, { color: palette.text.quaternary }]}>{dose.time_label}</Text>
    </View>
  );
}

function InventoryCard({
  item,
  isEditing,
  onToggleEdit,
  onSaveSchedule,
  onRemove,
  onToggleBreak,
}: {
  item: PeptideInventoryRow;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSaveSchedule: (amount: string, timeLabel: string, note: string) => void;
  onRemove: () => void;
  onToggleBreak: () => void;
}) {
  const { palette, glass } = useTheme();
  const [amount, setAmount] = useState(item.schedule_amount);
  const [timeLabel, setTimeLabel] = useState(item.schedule_time_label);
  const [note, setNote] = useState(item.note);

  useEffect(() => {
    if (isEditing) {
      setAmount(item.schedule_amount);
      setTimeLabel(item.schedule_time_label);
      setNote(item.note);
    }
  }, [isEditing, item.schedule_amount, item.schedule_time_label, item.note]);

  const total = amountTotalMg(item);
  const left = item.amount_left_mg ?? total;
  const pct = useMemo(() => {
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (left / total) * 100));
  }, [left, total]);
  const gradient = accent.horizontal();
  const hasSchedule = !!(item.schedule_amount || item.schedule_time_label);
  const onHandLabel = item.kind === 'supplement' ? 'on hand' : 'vials on hand';
  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary };
  const reconText = reconSummary(item) ?? item.recon;

  return (
    <GlassCard radius={radius.inventoryCard} style={styles.inventoryCardGap} contentStyle={styles.inventoryContent}>
      <View style={styles.inventoryHeaderRow}>
        <Text style={[styles.inventoryName, { color: palette.text.primary }]}>{item.name}</Text>
        <Text style={[styles.inventoryVials, { color: palette.text.tertiary }]}>
          {item.vials} {onHandLabel}
        </Text>
      </View>
      {reconText ? <Text style={[styles.inventoryRecon, { color: palette.text.quaternary }]}>{reconText}</Text> : null}
      {item.on_break ? (
        <Text style={[styles.onBreakBadge, { color: palette.text.quaternary, backgroundColor: glass.fill }]}>
          ⏸ On break
        </Text>
      ) : null}
      {hasSchedule ? (
        <Text style={[styles.scheduleSummary, { color: palette.text.tertiary }]}>
          Scheduled · {[item.schedule_amount, item.schedule_time_label].filter(Boolean).join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.scheduleSummary, { color: palette.text.faint }]}>Not scheduled</Text>
      )}
      <Text style={[styles.frequencyTag, { color: palette.text.quaternary }]}>{frequencyLabel(item)}</Text>
      <Text style={[styles.frequencyTag, { color: palette.text.quaternary }]}>{lastDoseLabel(item.last_taken_at)}</Text>
      {!isEditing && item.note ? (
        <Text style={[styles.noteText, { color: palette.text.tertiary }]}>{item.note}</Text>
      ) : null}
      <View style={[styles.progressTrack, { backgroundColor: palette.track }]}>
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>
      <View style={styles.inventoryFooterRow}>
        <Text style={[styles.inventoryCaption, { color: palette.text.tertiary }]}>
          {formatMg(left)} mg remaining{total > 0 ? ` of ${formatMg(total)} mg` : ''}
        </Text>
        <View style={styles.inventoryActions}>
          <Pressable
            onPress={onToggleBreak}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={item.on_break ? 'Resume schedule' : 'Pause schedule (on break)'}
          >
            <MaterialCommunityIcons
              name={item.on_break ? 'play-circle-outline' : 'pause-circle-outline'}
              size={16}
              color={palette.text.faint}
            />
          </Pressable>
          <Pressable
            onPress={onToggleEdit}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Cancel editing schedule' : 'Edit schedule'}
          >
            <MaterialCommunityIcons
              name={isEditing ? 'close' : 'pencil-outline'}
              size={16}
              color={palette.text.faint}
            />
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
            <Text style={[styles.removeGlyph, { color: palette.text.faint }]}>×</Text>
          </Pressable>
        </View>
      </View>
      {isEditing ? (
        <View style={styles.scheduleFormWrap}>
          <View style={styles.scheduleForm}>
            <TextInput
              style={[styles.input, styles.inputAmount, inputStyle]}
              placeholder="Amount · route"
              placeholderTextColor={palette.text.faint}
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={[styles.input, styles.inputTime, inputStyle]}
              placeholder="Time"
              placeholderTextColor={palette.text.faint}
              value={timeLabel}
              onChangeText={setTimeLabel}
            />
          </View>
          <TextInput
            style={[styles.input, styles.inputNote, inputStyle]}
            placeholder="Note to self — e.g. bump to 300mcg after Aug 1"
            placeholderTextColor={palette.text.faint}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Pressable
            onPress={() => onSaveSchedule(amount, timeLabel, note)}
            style={[styles.saveBtn, styles.saveBtnFullWidth, { backgroundColor: glass.borderElevated }]}
          >
            <Text style={[styles.saveBtnText, { color: palette.text.primaryAlt }]}>Save</Text>
          </Pressable>
        </View>
      ) : null}
    </GlassCard>
  );
}

function AddInventoryForm({ onAdd }: { onAdd: (row: NewRow<PeptideInventoryRow>) => void | Promise<void> }) {
  const { palette, glass } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PeptideKind>('peptide');
  const [vials, setVials] = useState('');
  const [recon, setRecon] = useState('');
  const [vialMg, setVialMg] = useState('');
  const [bacMl, setBacMl] = useState('');
  const [doseMg, setDoseMg] = useState('');
  const [frequencyDays, setFrequencyDays] = useState<string[]>([]);

  const toggleDay = (day: string) => {
    setFrequencyDays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]));
  };

  const reset = () => {
    setName('');
    setKind('peptide');
    setVials('');
    setRecon('');
    setVialMg('');
    setBacMl('');
    setDoseMg('');
    setFrequencyDays([]);
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const vialsNum = Number.parseInt(vials, 10);
    const vialsClean = Number.isFinite(vialsNum) ? vialsNum : 0;
    const vialMgNum = Number.parseFloat(vialMg);
    const vialMgClean = Number.isFinite(vialMgNum) ? vialMgNum : 0;
    const doseMgNum = Number.parseFloat(doseMg);
    const doseMgClean = Number.isFinite(doseMgNum) ? doseMgNum : 0;
    const amountTotal = vialsClean * vialMgClean;

    const base = {
      name: trimmedName,
      vials: vialsClean,
      kind,
      schedule_amount: '',
      schedule_time_label: '',
      frequency: 'weekdays' as PeptideFrequency,
      frequency_n: 1,
      frequency_days: frequencyDays.join(','),
      note: '',
      vial_mg: vialMgClean,
      dose_mg: doseMgClean,
      amount_left_mg: amountTotal,
      on_break: false,
      last_taken_at: null,
    };

    try {
      if (kind === 'peptide') {
        const bacMlNum = Number.parseFloat(bacMl);
        const bacMlClean = Number.isFinite(bacMlNum) ? bacMlNum : 0;
        await onAdd({
          ...base,
          recon: '',
          bac_ml: bacMlClean,
          dose_mcg: doseMgClean * 1000,
          doses_total: 1,
          doses_left: 0,
        });
      } else {
        await onAdd({
          ...base,
          recon: recon.trim(),
          bac_ml: 0,
          dose_mcg: 0,
          doses_total: 1,
          doses_left: 0,
        });
      }
      reset();
    } catch {
      // Keep the form's entered values so the user can retry — the parent
      // surfaces the error message above the form.
    }
  };

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary };

  return (
    <View style={styles.addCompoundForm}>
      <Text style={[styles.addCompoundLabel, { color: palette.text.primary }]}>Add compound</Text>
      <View style={styles.kindToggleRow}>
        {KIND_ORDER.map((option) => {
          const active = kind === option;
          return (
            <Pressable
              key={option}
              onPress={() => setKind(option)}
              style={[
                styles.kindToggleBtn,
                { borderColor: glass.borderElevated },
                active && { backgroundColor: withAlpha(palette.accentText, 0.22), borderColor: palette.accentText },
              ]}
            >
              <Text
                style={[
                  styles.kindToggleText,
                  { color: active ? palette.accentText : palette.text.tertiary },
                ]}
              >
                {KIND_LABEL[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputName, inputStyle]}
          placeholder="Name"
          placeholderTextColor={palette.text.faint}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.inputVials, inputStyle]}
          placeholder="Vials"
          placeholderTextColor={palette.text.faint}
          value={vials}
          onChangeText={setVials}
          keyboardType="number-pad"
        />
      </View>

      {kind === 'peptide' ? (
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.inputVials, inputStyle]}
            placeholder="Vial size (mg)"
            placeholderTextColor={palette.text.faint}
            value={vialMg}
            onChangeText={setVialMg}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.inputVials, inputStyle]}
            placeholder="BAC water (mL)"
            placeholderTextColor={palette.text.faint}
            value={bacMl}
            onChangeText={setBacMl}
            keyboardType="decimal-pad"
          />
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.input, styles.inputRecon, inputStyle]}
            placeholder="Description (e.g. 5 g scoop · 1 tub = 60 servings)"
            placeholderTextColor={palette.text.faint}
            value={recon}
            onChangeText={setRecon}
          />
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, styles.inputVials, inputStyle]}
              placeholder="Amount per unit (mg)"
              placeholderTextColor={palette.text.faint}
              value={vialMg}
              onChangeText={setVialMg}
              keyboardType="decimal-pad"
            />
          </View>
        </>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputVials, inputStyle]}
          placeholder="Dose (mg)"
          placeholderTextColor={palette.text.faint}
          value={doseMg}
          onChangeText={setDoseMg}
          keyboardType="decimal-pad"
        />
      </View>

      <Text style={[styles.frequencySectionLabel, { color: palette.text.tertiary }]}>Days</Text>
      <View style={styles.dayPillRow}>
        {DAY_ABBRS.map((day) => {
          const active = frequencyDays.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              style={[
                styles.dayPillBtn,
                { borderColor: glass.borderElevated },
                active && { backgroundColor: withAlpha(palette.accentText, 0.22), borderColor: palette.accentText },
              ]}
            >
              <Text style={[styles.dayPillText, { color: active ? palette.accentText : palette.text.tertiary }]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={submit} style={styles.submitBtnWrap} accessibilityRole="button" accessibilityLabel="Add to inventory">
        <LinearGradient
          colors={accent.default}
          start={accent.diagonal().start}
          end={accent.diagonal().end}
          style={styles.submitBtn}
        >
          <Text style={styles.addBtnGlyph}>+</Text>
          <Text style={styles.submitBtnText}>Add to inventory</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionGap: {
    marginBottom: spacing.rowGapLg,
  },
  cardTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    marginBottom: spacing.rowGapSm,
  },
  addErrorText: {
    fontSize: type.meta.fontSize,
    marginBottom: spacing.rowGapSm,
  },
  onBreakBadge: {
    alignSelf: 'flex-start',
    fontSize: type.caption.fontSize,
    fontWeight: '700',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.chip,
    overflow: 'hidden',
  },
  doseList: {
    gap: spacing.rowGapSm,
  },
  doseGroupList: {
    gap: spacing.rowGapSm,
  },
  emptyText: {
    fontSize: type.meta.fontSize,
    paddingVertical: 8,
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGapMd,
  },
  checkboxWrap: {
    flexShrink: 0,
  },
  // 24px box, rounded-lg (8px), border-2 — matches Home's To-Do checkboxes and
  // sampleindex.html's task checkboxes exactly.
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  doseInfo: {
    flex: 1,
  },
  doseName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: type.itemTitle.fontWeight,
  },
  doseAmount: {
    fontSize: type.meta.fontSize,
    marginTop: 1,
  },
  doseTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeBtn: {
    paddingHorizontal: 4,
  },
  removeGlyph: {
    fontSize: 18,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGapSm,
    marginTop: spacing.rowGapMd,
  },
  input: {
    height: 40,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 14,
  },
  inputName: {
    flex: 1.2,
  },
  inputAmount: {
    flex: 1.4,
  },
  inputTime: {
    flex: 0.9,
  },
  inputVials: {
    flex: 1,
  },
  inputRecon: {
    marginTop: spacing.rowGapSm,
  },
  inputFrequencyN: {
    marginTop: spacing.rowGapSm,
    width: 140,
  },
  inputNote: {
    marginTop: spacing.rowGapSm,
    minHeight: 40,
    paddingTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: spacing.rowGapSm,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  addToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToggleGlyph: {
    fontSize: 18,
    fontWeight: '700',
  },
  groupLabel: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.rowGapSm,
  },
  groupDivider: {
    height: 1,
    marginBottom: spacing.rowGapMd,
  },
  inventoryList: {
    gap: spacing.rowGapMd,
  },
  inventoryGroup: {
    gap: spacing.rowGapSm,
  },
  inventoryGroupList: {
    gap: spacing.rowGapMd,
  },
  inventoryCardGap: {
    borderRadius: radius.inventoryCard,
  },
  inventoryContent: {
    padding: spacing.cardPaddingSm,
  },
  inventoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  inventoryName: {
    fontSize: 17,
    fontWeight: '700',
  },
  inventoryVials: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: type.metaSemibold.fontWeight,
  },
  inventoryRecon: {
    fontSize: type.meta.fontSize,
    marginTop: 6,
  },
  scheduleSummary: {
    fontSize: type.meta.fontSize,
    marginTop: 4,
  },
  frequencyTag: {
    fontSize: type.caption.fontSize,
    marginTop: 2,
  },
  noteText: {
    fontSize: type.meta.fontSize,
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  inventoryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  inventoryCaption: {
    fontSize: type.caption.fontSize,
    fontWeight: type.caption.fontWeight,
  },
  inventoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGapSm,
  },
  iconBtn: {
    paddingHorizontal: 4,
  },
  scheduleFormWrap: {
    marginTop: spacing.rowGapMd,
    gap: spacing.rowGapSm,
  },
  scheduleForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGapSm,
  },
  saveBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnFullWidth: {
    alignSelf: 'stretch',
  },
  saveBtnText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
  },
  addCompoundForm: {
    marginTop: 0,
  },
  addCompoundLabel: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
  },
  kindToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.rowGapSm,
    marginTop: spacing.rowGapSm,
  },
  kindToggleBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindToggleText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: type.metaSemibold.fontWeight,
  },
  frequencySectionLabel: {
    fontSize: type.meta.fontSize,
    fontWeight: '700',
    marginTop: spacing.rowGapMd,
  },
  dayPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.rowGapSm,
  },
  dayPillBtn: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: {
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  addBtnGlyph: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  submitBtnWrap: {
    marginTop: spacing.rowGapMd,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: radius.input,
    gap: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
  },
});

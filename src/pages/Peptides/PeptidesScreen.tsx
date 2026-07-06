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
import type { NewRow, PeptideDoseRow, PeptideInventoryRow, PeptideKind } from '../../lib/types';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const seedDoses: NewRow<PeptideDoseRow>[] = [
  { name: 'BPC-157', amount: '250 mcg · SubQ', time_label: '8:00 AM', taken: true, scheduled_for: todayIso(), kind: 'peptide' },
  { name: 'Ipamorelin', amount: '200 mcg · SubQ', time_label: '10:00 PM', taken: false, scheduled_for: todayIso(), kind: 'peptide' },
  { name: 'TB-500', amount: '2 mg · weekly', time_label: 'Sun', taken: false, scheduled_for: todayIso(), kind: 'peptide' },
  { name: 'Creatine', amount: '5 g · with breakfast', time_label: '8:00 AM', taken: false, scheduled_for: todayIso(), kind: 'supplement' },
  { name: 'Ashwagandha', amount: '600 mg', time_label: '9:00 PM', taken: false, scheduled_for: todayIso(), kind: 'supplement' },
];

const seedInventory: NewRow<PeptideInventoryRow>[] = [
  {
    name: 'BPC-157',
    vials: 2,
    recon: '5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL',
    doses_left: 38,
    doses_total: 50,
    kind: 'peptide',
    schedule_amount: '250 mcg · SubQ',
    schedule_time_label: '8:00 AM',
  },
  {
    name: 'Ipamorelin',
    vials: 1,
    recon: '5 mg vial · 2.5 mL BAC → 200 mcg = 0.10 mL',
    doses_left: 14,
    doses_total: 50,
    kind: 'peptide',
    schedule_amount: '200 mcg · SubQ',
    schedule_time_label: '10:00 PM',
  },
  {
    name: 'TB-500',
    vials: 3,
    recon: '5 mg vial · 2 mL BAC → 2 mg = 0.80 mL',
    doses_left: 7,
    doses_total: 8,
    kind: 'peptide',
    schedule_amount: '2 mg · weekly',
    schedule_time_label: 'Sun',
  },
  {
    name: 'Creatine',
    vials: 1,
    recon: '5 g scoop · 1 tub = 60 servings',
    doses_left: 45,
    doses_total: 60,
    kind: 'supplement',
    schedule_amount: '5 g · with breakfast',
    schedule_time_label: '8:00 AM',
  },
  {
    name: 'Ashwagandha',
    vials: 1,
    recon: '600 mg capsule · 1 bottle = 60 caps',
    doses_left: 22,
    doses_total: 60,
    kind: 'supplement',
    schedule_amount: '600 mg',
    schedule_time_label: '9:00 PM',
  },
];

const KIND_LABEL: Record<PeptideKind, string> = { peptide: 'Peptides', supplement: 'Supplements' };
const KIND_ORDER: PeptideKind[] = ['peptide', 'supplement'];

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
  const doses = useRepo('peptide_doses', seedDoses);
  const inventory = useRepo('peptide_inventory', seedInventory);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const doseGroups = useMemo(() => groupByKind(normalizeKind(doses.rows)), [doses.rows]);
  const inventoryGroups = useMemo(() => groupByKind(normalizeKind(inventory.rows)), [inventory.rows]);

  const handleScheduleSave = async (item: PeptideInventoryRow, amount: string, timeLabel: string) => {
    const trimmedAmount = amount.trim();
    const trimmedTime = timeLabel.trim();
    await inventory.update(item.id, { schedule_amount: trimmedAmount, schedule_time_label: trimmedTime });

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
      <View style={styles.header}>
        <Text style={[styles.subtitle, { color: palette.text.secondaryAlt }]}>Schedule & inventory</Text>
      </View>

      <GlassCard style={styles.sectionGap}>
        <Text style={[styles.cardTitle, { color: palette.text.primary }]}>Today&apos;s schedule</Text>
        <View style={styles.doseList}>
          {doseGroups.map((group, index) => (
            <View key={group.kind}>
              {index > 0 ? <View style={[styles.groupDivider, { backgroundColor: palette.hairline }]} /> : null}
              <Text style={[styles.groupLabel, { color: palette.text.tertiary }]}>{KIND_LABEL[group.kind]}</Text>
              <View style={styles.doseGroupList}>
                {group.items.map((dose) => (
                  <DoseRow key={dose.id} dose={dose} onToggle={() => doses.update(dose.id, { taken: !dose.taken })} />
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
          <AddInventoryForm
            onAdd={(row) => {
              inventory.insert(row);
              setShowAddInventory(false);
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
                  onSaveSchedule={(amount, timeLabel) => handleScheduleSave(item, amount, timeLabel)}
                  onRemove={() => inventory.remove(item.id)}
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
}: {
  item: PeptideInventoryRow;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSaveSchedule: (amount: string, timeLabel: string) => void;
  onRemove: () => void;
}) {
  const { palette, glass } = useTheme();
  const [amount, setAmount] = useState(item.schedule_amount);
  const [timeLabel, setTimeLabel] = useState(item.schedule_time_label);

  useEffect(() => {
    if (isEditing) {
      setAmount(item.schedule_amount);
      setTimeLabel(item.schedule_time_label);
    }
  }, [isEditing, item.schedule_amount, item.schedule_time_label]);

  const pct = useMemo(() => {
    if (item.doses_total <= 0) return 0;
    return Math.max(0, Math.min(100, (item.doses_left / item.doses_total) * 100));
  }, [item.doses_left, item.doses_total]);
  const gradient = accent.horizontal();
  const hasSchedule = !!(item.schedule_amount || item.schedule_time_label);
  const onHandLabel = item.kind === 'supplement' ? 'on hand' : 'vials on hand';
  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary };

  return (
    <GlassCard radius={radius.inventoryCard} style={styles.inventoryCardGap} contentStyle={styles.inventoryContent}>
      <View style={styles.inventoryHeaderRow}>
        <Text style={[styles.inventoryName, { color: palette.text.primary }]}>{item.name}</Text>
        <Text style={[styles.inventoryVials, { color: palette.text.tertiary }]}>
          {item.vials} {onHandLabel}
        </Text>
      </View>
      <Text style={[styles.inventoryRecon, { color: palette.text.quaternary }]}>{item.recon}</Text>
      {hasSchedule ? (
        <Text style={[styles.scheduleSummary, { color: palette.text.tertiary }]}>
          Scheduled · {[item.schedule_amount, item.schedule_time_label].filter(Boolean).join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.scheduleSummary, { color: palette.text.faint }]}>Not scheduled</Text>
      )}
      <View style={[styles.progressTrack, { backgroundColor: palette.track }]}>
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>
      <View style={styles.inventoryFooterRow}>
        <Text style={[styles.inventoryCaption, { color: palette.text.tertiary }]}>{item.doses_left} doses remaining</Text>
        <View style={styles.inventoryActions}>
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
            onSubmitEditing={() => onSaveSchedule(amount, timeLabel)}
          />
          <Pressable
            onPress={() => onSaveSchedule(amount, timeLabel)}
            style={[styles.saveBtn, { backgroundColor: glass.borderElevated }]}
          >
            <Text style={[styles.saveBtnText, { color: palette.text.primaryAlt }]}>Save</Text>
          </Pressable>
        </View>
      ) : null}
    </GlassCard>
  );
}

function AddInventoryForm({ onAdd }: { onAdd: (row: NewRow<PeptideInventoryRow>) => void }) {
  const { palette, glass } = useTheme();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PeptideKind>('peptide');
  const [vials, setVials] = useState('');
  const [recon, setRecon] = useState('');
  const [dosesLeft, setDosesLeft] = useState('');
  const [dosesTotal, setDosesTotal] = useState('');

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const vialsNum = Number.parseInt(vials, 10);
    const dosesLeftNum = Number.parseInt(dosesLeft, 10);
    const dosesTotalNum = Number.parseInt(dosesTotal, 10);
    onAdd({
      name: trimmedName,
      vials: Number.isFinite(vialsNum) ? vialsNum : 0,
      recon: recon.trim(),
      doses_left: Number.isFinite(dosesLeftNum) ? dosesLeftNum : 0,
      doses_total: Number.isFinite(dosesTotalNum) && dosesTotalNum > 0 ? dosesTotalNum : 1,
      kind,
      schedule_amount: '',
      schedule_time_label: '',
    });
    setName('');
    setKind('peptide');
    setVials('');
    setRecon('');
    setDosesLeft('');
    setDosesTotal('');
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
      <TextInput
        style={[styles.input, styles.inputRecon, inputStyle]}
        placeholder="Recon recipe (e.g. 5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL)"
        placeholderTextColor={palette.text.faint}
        value={recon}
        onChangeText={setRecon}
      />
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputVials, inputStyle]}
          placeholder="Doses left"
          placeholderTextColor={palette.text.faint}
          value={dosesLeft}
          onChangeText={setDosesLeft}
          keyboardType="number-pad"
        />
        <TextInput
          style={[styles.input, styles.inputVials, inputStyle]}
          placeholder="Doses total"
          placeholderTextColor={palette.text.faint}
          value={dosesTotal}
          onChangeText={setDosesTotal}
          keyboardType="number-pad"
          onSubmitEditing={submit}
        />
        <Pressable onPress={submit} hitSlop={8} style={styles.addBtnWrap}>
          <LinearGradient
            colors={accent.default}
            start={accent.diagonal().start}
            end={accent.diagonal().end}
            style={styles.addBtn}
          >
            <Text style={styles.addBtnGlyph}>+</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: type.body.fontSize,
  },
  sectionGap: {
    marginBottom: spacing.rowGapLg,
  },
  cardTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    marginBottom: spacing.rowGapSm,
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
  addBtnWrap: {
    flexShrink: 0,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnGlyph: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
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
  scheduleForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.rowGapSm,
    marginTop: spacing.rowGapMd,
  },
  saveBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
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
});

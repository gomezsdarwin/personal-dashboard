import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { color, radius, spacing, type } from '../../theme/tokens';
import { accent } from '../../theme/accent';
import { useRepo } from '../../hooks/useRepo';
import type { NewRow, PeptideDoseRow, PeptideInventoryRow } from '../../lib/types';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const seedDoses: NewRow<PeptideDoseRow>[] = [
  { name: 'BPC-157', amount: '250 mcg · SubQ', time_label: '8:00 AM', taken: true, scheduled_for: todayIso() },
  { name: 'Ipamorelin', amount: '200 mcg · SubQ', time_label: '10:00 PM', taken: false, scheduled_for: todayIso() },
  { name: 'TB-500', amount: '2 mg · weekly', time_label: 'Sun', taken: false, scheduled_for: todayIso() },
];

const seedInventory: NewRow<PeptideInventoryRow>[] = [
  {
    name: 'BPC-157',
    vials: 2,
    recon: '5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL',
    doses_left: 38,
    doses_total: 50,
  },
  {
    name: 'Ipamorelin',
    vials: 1,
    recon: '5 mg vial · 2.5 mL BAC → 200 mcg = 0.10 mL',
    doses_left: 14,
    doses_total: 50,
  },
  {
    name: 'TB-500',
    vials: 3,
    recon: '5 mg vial · 2 mL BAC → 2 mg = 0.80 mL',
    doses_left: 7,
    doses_total: 8,
  },
];

/**
 * Peptides — dose schedule + inventory. Ports Phone.dc.html's PEPTIDES screen:
 * a "Today's schedule" glass card of toggleable doses, and one glass inventory
 * card per compound with a recon note + doses-remaining progress bar.
 */
export default function PeptidesScreen() {
  const doses = useRepo('peptide_doses', seedDoses);
  const inventory = useRepo('peptide_inventory', seedInventory);

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={styles.title}>💊 Peptides</Text>
        <Text style={styles.subtitle}>Schedule & inventory</Text>
      </View>

      <GlassCard style={styles.sectionGap}>
        <Text style={styles.cardTitle}>Today&apos;s schedule</Text>
        <View style={styles.doseList}>
          {doses.rows.map((dose) => (
            <DoseRow
              key={dose.id}
              dose={dose}
              onToggle={() => doses.update(dose.id, { taken: !dose.taken })}
              onRemove={() => doses.remove(dose.id)}
            />
          ))}
          {doses.rows.length === 0 && !doses.loading ? (
            <Text style={styles.emptyText}>No doses scheduled.</Text>
          ) : null}
        </View>
        <AddDoseForm onAdd={(row) => doses.insert(row)} />
      </GlassCard>

      <Text style={styles.sectionLabel}>Inventory</Text>
      <View style={styles.inventoryList}>
        {inventory.rows.map((item) => (
          <InventoryCard key={item.id} item={item} onRemove={() => inventory.remove(item.id)} />
        ))}
        {inventory.rows.length === 0 && !inventory.loading ? (
          <GlassCard>
            <Text style={styles.emptyText}>No compounds tracked.</Text>
          </GlassCard>
        ) : null}
      </View>
      <GlassCard style={styles.sectionGap}>
        <AddInventoryForm onAdd={(row) => inventory.insert(row)} />
      </GlassCard>
    </AppShell>
  );
}

function DoseRow({
  dose,
  onToggle,
  onRemove,
}: {
  dose: PeptideDoseRow;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const gradient = accent.diagonal();
  return (
    <View style={styles.doseRow}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkboxWrap}>
        {dose.taken ? (
          <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={styles.checkbox}>
            <Text style={styles.checkboxMark}>✓</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.checkbox, styles.checkboxEmpty]} />
        )}
      </Pressable>
      <View style={styles.doseInfo}>
        <Text style={[styles.doseName, dose.taken && styles.doseNameTaken]}>{dose.name}</Text>
        <Text style={styles.doseAmount}>{dose.amount}</Text>
      </View>
      <Text style={styles.doseTime}>{dose.time_label}</Text>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
        <Text style={styles.removeGlyph}>×</Text>
      </Pressable>
    </View>
  );
}

function AddDoseForm({ onAdd }: { onAdd: (row: NewRow<PeptideDoseRow>) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [timeLabel, setTimeLabel] = useState('');

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onAdd({
      name: trimmedName,
      amount: amount.trim(),
      time_label: timeLabel.trim(),
      taken: false,
      scheduled_for: todayIso(),
    });
    setName('');
    setAmount('');
    setTimeLabel('');
  };

  return (
    <View style={styles.addRow}>
      <TextInput
        style={[styles.input, styles.inputName]}
        placeholder="Name"
        placeholderTextColor={color.text.faint}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
      />
      <TextInput
        style={[styles.input, styles.inputAmount]}
        placeholder="Amount · route"
        placeholderTextColor={color.text.faint}
        value={amount}
        onChangeText={setAmount}
        onSubmitEditing={submit}
      />
      <TextInput
        style={[styles.input, styles.inputTime]}
        placeholder="Time"
        placeholderTextColor={color.text.faint}
        value={timeLabel}
        onChangeText={setTimeLabel}
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
  );
}

function InventoryCard({ item, onRemove }: { item: PeptideInventoryRow; onRemove: () => void }) {
  const pct = useMemo(() => {
    if (item.doses_total <= 0) return 0;
    return Math.max(0, Math.min(100, (item.doses_left / item.doses_total) * 100));
  }, [item.doses_left, item.doses_total]);
  const gradient = accent.horizontal();

  return (
    <GlassCard style={styles.inventoryCardGap} contentStyle={styles.inventoryContent}>
      <View style={styles.inventoryHeaderRow}>
        <Text style={styles.inventoryName}>{item.name}</Text>
        <Text style={styles.inventoryVials}>{item.vials} vials on hand</Text>
      </View>
      <Text style={styles.inventoryRecon}>{item.recon}</Text>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>
      <View style={styles.inventoryFooterRow}>
        <Text style={styles.inventoryCaption}>{item.doses_left} doses remaining</Text>
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <Text style={styles.removeGlyph}>×</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function AddInventoryForm({ onAdd }: { onAdd: (row: NewRow<PeptideInventoryRow>) => void }) {
  const [name, setName] = useState('');
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
    });
    setName('');
    setVials('');
    setRecon('');
    setDosesLeft('');
    setDosesTotal('');
  };

  return (
    <View style={styles.addCompoundForm}>
      <Text style={styles.addCompoundLabel}>Add compound</Text>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputName]}
          placeholder="Name"
          placeholderTextColor={color.text.faint}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, styles.inputVials]}
          placeholder="Vials"
          placeholderTextColor={color.text.faint}
          value={vials}
          onChangeText={setVials}
          keyboardType="number-pad"
        />
      </View>
      <TextInput
        style={[styles.input, styles.inputRecon]}
        placeholder="Recon recipe (e.g. 5 mg vial · 2 mL BAC → 250 mcg = 0.10 mL)"
        placeholderTextColor={color.text.faint}
        value={recon}
        onChangeText={setRecon}
      />
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.inputVials]}
          placeholder="Doses left"
          placeholderTextColor={color.text.faint}
          value={dosesLeft}
          onChangeText={setDosesLeft}
          keyboardType="number-pad"
        />
        <TextInput
          style={[styles.input, styles.inputVials]}
          placeholder="Doses total"
          placeholderTextColor={color.text.faint}
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
  sectionGap: {
    marginBottom: spacing.rowGapLg,
  },
  cardTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    color: color.text.primary,
    marginBottom: spacing.rowGapSm,
  },
  doseList: {
    gap: spacing.rowGapSm,
  },
  emptyText: {
    fontSize: type.meta.fontSize,
    color: color.text.tertiary,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxEmpty: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(120,110,150,0.35)',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  doseInfo: {
    flex: 1,
  },
  doseName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: type.itemTitle.fontWeight,
    color: color.text.primary,
  },
  doseNameTaken: {
    textDecorationLine: 'line-through',
    color: color.text.dimmed,
  },
  doseAmount: {
    fontSize: type.meta.fontSize,
    color: color.text.tertiary,
    marginTop: 1,
  },
  doseTime: {
    fontSize: 14,
    fontWeight: '600',
    color: color.text.quaternary,
  },
  removeBtn: {
    paddingHorizontal: 4,
  },
  removeGlyph: {
    fontSize: 18,
    color: color.text.faint,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    color: color.text.primary,
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: color.text.primary,
    marginBottom: spacing.rowGapSm,
    marginTop: 4,
  },
  inventoryList: {
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
    color: color.text.primary,
  },
  inventoryVials: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: type.metaSemibold.fontWeight,
    color: color.text.tertiary,
  },
  inventoryRecon: {
    fontSize: type.meta.fontSize,
    color: color.text.quaternary,
    marginTop: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: color.track,
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
    color: color.text.tertiary,
  },
  addCompoundForm: {
    marginTop: 0,
  },
  addCompoundLabel: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    color: color.text.primary,
  },
});

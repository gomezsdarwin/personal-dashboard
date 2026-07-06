import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { HeaderBar } from '../../components/HeaderBar';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
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
  const { palette } = useTheme();
  const doses = useRepo('peptide_doses', seedDoses);
  const inventory = useRepo('peptide_inventory', seedInventory);

  return (
    <AppShell>
      <HeaderBar />

      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text.primaryAlt }]}>Peptides</Text>
        <Text style={[styles.subtitle, { color: palette.text.secondaryAlt }]}>Schedule & inventory</Text>
      </View>

      <GlassCard style={styles.sectionGap}>
        <Text style={[styles.cardTitle, { color: palette.text.primary }]}>Today&apos;s schedule</Text>
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
            <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>No doses scheduled.</Text>
          ) : null}
        </View>
        <AddDoseForm onAdd={(row) => doses.insert(row)} />
      </GlassCard>

      <Text style={[styles.sectionLabel, { color: palette.text.primary }]}>Inventory</Text>
      <View style={styles.inventoryList}>
        {inventory.rows.map((item) => (
          <InventoryCard key={item.id} item={item} onRemove={() => inventory.remove(item.id)} />
        ))}
        {inventory.rows.length === 0 && !inventory.loading ? (
          <GlassCard>
            <Text style={[styles.emptyText, { color: palette.text.tertiary }]}>No compounds tracked.</Text>
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
  const { palette, glass } = useTheme();
  const gradient = accent.diagonal();
  return (
    <View style={styles.doseRow}>
      <Pressable onPress={onToggle} hitSlop={8} style={styles.checkboxWrap}>
        {dose.taken ? (
          <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={styles.checkbox}>
            <Text style={styles.checkboxMark}>✓</Text>
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.checkbox,
              { backgroundColor: glass.fill, borderColor: glass.borderElevated },
            ]}
          />
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
      <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
        <Text style={[styles.removeGlyph, { color: palette.text.faint }]}>×</Text>
      </Pressable>
    </View>
  );
}

function AddDoseForm({ onAdd }: { onAdd: (row: NewRow<PeptideDoseRow>) => void }) {
  const { palette, glass } = useTheme();
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

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary };

  return (
    <View style={styles.addRow}>
      <TextInput
        style={[styles.input, styles.inputName, inputStyle]}
        placeholder="Name"
        placeholderTextColor={palette.text.faint}
        value={name}
        onChangeText={setName}
        onSubmitEditing={submit}
      />
      <TextInput
        style={[styles.input, styles.inputAmount, inputStyle]}
        placeholder="Amount · route"
        placeholderTextColor={palette.text.faint}
        value={amount}
        onChangeText={setAmount}
        onSubmitEditing={submit}
      />
      <TextInput
        style={[styles.input, styles.inputTime, inputStyle]}
        placeholder="Time"
        placeholderTextColor={palette.text.faint}
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
  const { palette } = useTheme();
  const pct = useMemo(() => {
    if (item.doses_total <= 0) return 0;
    return Math.max(0, Math.min(100, (item.doses_left / item.doses_total) * 100));
  }, [item.doses_left, item.doses_total]);
  const gradient = accent.horizontal();

  return (
    <GlassCard radius={radius.inventoryCard} style={styles.inventoryCardGap} contentStyle={styles.inventoryContent}>
      <View style={styles.inventoryHeaderRow}>
        <Text style={[styles.inventoryName, { color: palette.text.primary }]}>{item.name}</Text>
        <Text style={[styles.inventoryVials, { color: palette.text.tertiary }]}>{item.vials} vials on hand</Text>
      </View>
      <Text style={[styles.inventoryRecon, { color: palette.text.quaternary }]}>{item.recon}</Text>
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
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <Text style={[styles.removeGlyph, { color: palette.text.faint }]}>×</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function AddInventoryForm({ onAdd }: { onAdd: (row: NewRow<PeptideInventoryRow>) => void }) {
  const { palette, glass } = useTheme();
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

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated, color: palette.text.primary };

  return (
    <View style={styles.addCompoundForm}>
      <Text style={[styles.addCompoundLabel, { color: palette.text.primary }]}>Add compound</Text>
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
  title: {
    fontSize: type.screenTitle.fontSize,
    fontWeight: type.screenTitle.fontWeight,
    letterSpacing: type.screenTitle.letterSpacing,
  },
  subtitle: {
    fontSize: type.body.fontSize,
    marginTop: 4,
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
  // Rounded-square (radius 7 on a 24px box), matching Home's To-Do checkboxes
  // and the habit-tracker's cells — previously this used radius.checkbox (12,
  // fully round), which no longer matches the app's toggle-shape language.
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
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
  },
  inventoryVials: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: type.metaSemibold.fontWeight,
  },
  inventoryRecon: {
    fontSize: type.meta.fontSize,
    marginTop: 6,
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
  addCompoundForm: {
    marginTop: 0,
  },
  addCompoundLabel: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
  },
});

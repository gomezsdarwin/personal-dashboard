import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { HeaderBar } from '../../components/HeaderBar';
import { HeroCard } from '../../components/HeroCard';
import { UrgencyPill } from '../../components/UrgencyPill';
import { useRepo } from '../../hooks/useRepo';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import type { NewRow, SubscriptionRow } from '../../lib/types';

/** Same-day-offset ISO helper as Phone.dc.html's `iso(n)` — relative to "today". */
function isoInDays(n: number): string {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

/** rawSubs from Phone.dc.html, with `due` (day offset) resolved to a real ISO date. */
const SEED_SUBSCRIPTIONS: NewRow<SubscriptionRow>[] = [
  { name: 'Netflix', category: 'Streaming', amount: 15.49, icon: '🎬', renews_on: isoInDays(9) },
  { name: 'Spotify', category: 'Music', amount: 10.99, icon: '🎵', renews_on: isoInDays(1) },
  { name: 'iCloud+', category: 'Software', amount: 2.99, icon: '☁️', renews_on: isoInDays(17) },
  { name: 'ChatGPT Plus', category: 'Software', amount: 20.0, icon: '🤖', renews_on: isoInDays(4) },
  { name: 'Equinox', category: 'Fitness', amount: 45.0, icon: '🏋️', renews_on: isoInDays(0) },
  { name: 'YouTube Premium', category: 'Streaming', amount: 13.99, icon: '📺', renews_on: isoInDays(22) },
  { name: 'NYT', category: 'News', amount: 4.25, icon: '📰', renews_on: isoInDays(14) },
];

/** Mirrors Phone.dc.html's `usd`/`usd0` helpers. */
const usd = (n: number): string => `$${n.toFixed(2)}`;
const usd0 = (n: number): string => `$${n.toFixed(0)}`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function FinanceScreen() {
  const { palette, glass } = useTheme();
  const { rows, insert, remove } = useRepo('subscriptions', SEED_SUBSCRIPTIONS);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [icon, setIcon] = useState('');
  const [renewsOn, setRenewsOn] = useState('');

  const total = useMemo(() => rows.reduce((sum, s) => sum + s.amount, 0), [rows]);

  const categories = useMemo(() => {
    const subtotals: Record<string, number> = {};
    rows.forEach((s) => {
      subtotals[s.category] = (subtotals[s.category] ?? 0) + s.amount;
    });
    return Object.keys(subtotals)
      .sort((a, b) => subtotals[b] - subtotals[a])
      .map((catName) => ({ name: catName, subtotal: subtotals[catName] }));
  }, [rows]);

  const resetForm = () => {
    setName('');
    setCategory('');
    setAmount('');
    setIcon('');
    setRenewsOn('');
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const parsedAmount = parseFloat(amount);
    if (!trimmedName || Number.isNaN(parsedAmount)) return;

    const trimmedRenew = renewsOn.trim();
    const renews_on = ISO_DATE_RE.test(trimmedRenew) ? trimmedRenew : null;

    await insert({
      name: trimmedName,
      category: category.trim() || 'Other',
      amount: parsedAmount,
      icon: icon.trim() || '💳',
      renews_on,
    });
    resetForm();
    setShowAdd(false);
  };

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated };

  return (
    <AppShell>
      <HeaderBar />

      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text.primaryAlt }]}>Finance</Text>
        <Text style={[styles.subtitle, { color: palette.text.secondaryAlt }]}>Subscriptions</Text>
      </View>

      <HeroCard>
        <Text style={[styles.heroLabel, { color: palette.text.tertiary }]}>Total monthly</Text>
        <Text style={[styles.heroTotal, { color: palette.text.primaryAlt }]}>{usd0(total)}</Text>
        <Text style={[styles.heroCaption, { color: palette.text.quaternary }]}>{rows.length} active subscriptions</Text>
      </HeroCard>

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroller}
        >
          {categories.map((cat) => (
            <GlassChip key={cat.name} style={styles.chip}>
              <Text style={[styles.chipLabel, { color: palette.text.tertiary }]}>{cat.name}</Text>
              <Text style={[styles.chipValue, { color: palette.text.primaryAlt }]}>{usd0(cat.subtotal)}</Text>
            </GlassChip>
          ))}
        </ScrollView>
      )}

      <GlassCard style={styles.listCard} contentStyle={styles.listCardContent}>
        <View style={styles.addSection}>
          <View style={styles.addToggleRow}>
            <Text style={[styles.addToggleTitle, { color: palette.text.primaryAlt }]}>Subscriptions</Text>
            <Pressable
              onPress={() => setShowAdd((v) => !v)}
              style={[styles.addButton, { backgroundColor: glass.fill }]}
            >
              <Text style={[styles.addButtonGlyph, { color: palette.text.primaryAlt }]}>{showAdd ? '×' : '+'}</Text>
            </Pressable>
          </View>

          {showAdd && (
            <View style={styles.form}>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.iconInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="🎬"
                  placeholderTextColor={palette.text.faint}
                  value={icon}
                  onChangeText={setIcon}
                  maxLength={4}
                />
                <TextInput
                  style={[styles.input, styles.flexInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="Name"
                  placeholderTextColor={palette.text.faint}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.flexInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="Category"
                  placeholderTextColor={palette.text.faint}
                  value={category}
                  onChangeText={setCategory}
                />
                <TextInput
                  style={[styles.input, styles.amountInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="$0.00"
                  placeholderTextColor={palette.text.faint}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.flexInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="Renews YYYY-MM-DD (optional)"
                  placeholderTextColor={palette.text.faint}
                  value={renewsOn}
                  onChangeText={setRenewsOn}
                />
                <Pressable onPress={handleAdd} style={[styles.submitButton, { backgroundColor: glass.borderElevated }]}>
                  <Text style={[styles.submitButtonText, { color: palette.text.primaryAlt }]}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {rows.map((sub) => (
          <View key={sub.id} style={[styles.row, { borderTopColor: palette.hairline }]}>
            <View style={[styles.iconTile, { backgroundColor: glass.fill }]}>
              <Text style={styles.iconGlyph}>{sub.icon}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={[styles.rowName, { color: palette.text.primaryAlt }]}>{sub.name}</Text>
              <Text style={[styles.rowCategory, { color: palette.text.quaternary }]}>{sub.category}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.rowCost, { color: palette.text.primaryAlt }]}>{usd(sub.amount)}</Text>
              <UrgencyPill dueDate={sub.renews_on} style={styles.rowPill} />
            </View>
            <Pressable onPress={() => remove(sub.id)} style={styles.removeButton} hitSlop={8}>
              <Text style={[styles.removeGlyph, { color: palette.text.dimmed }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </GlassCard>
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
  },
  subtitle: {
    fontSize: type.body.fontSize,
    marginTop: 4,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  heroTotal: {
    fontSize: type.heroNumber.fontSize,
    fontWeight: type.heroNumber.fontWeight,
    letterSpacing: type.heroNumber.letterSpacing,
    marginTop: 2,
  },
  heroCaption: {
    fontSize: 14,
    marginTop: 2,
  },
  chipScroller: {
    marginTop: spacing.rowGapMd,
  },
  chipRow: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    minWidth: 84,
  },
  chipLabel: {
    fontSize: type.caption.fontSize,
  },
  chipValue: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    marginTop: 1,
  },
  listCard: {
    marginTop: spacing.rowGapLg,
  },
  listCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addSection: {
    paddingVertical: 8,
  },
  addToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addToggleTitle: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonGlyph: {
    fontSize: 18,
    fontWeight: '700',
  },
  form: {
    marginTop: 10,
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    height: 42,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: type.body.fontSize,
  },
  iconInput: {
    width: 50,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  flexInput: {
    flex: 1,
  },
  amountInput: {
    width: 90,
  },
  submitButton: {
    width: 64,
    height: 42,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: radius.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 22,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: type.itemTitle.fontSize,
    fontWeight: type.itemTitle.fontWeight,
  },
  rowCategory: {
    fontSize: type.meta.fontSize,
    marginTop: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowCost: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowPill: {
    marginTop: 3,
  },
  removeButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: {
    fontSize: 18,
    fontWeight: '600',
  },
});

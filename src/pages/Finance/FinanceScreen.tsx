import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { HeroCard } from '../../components/HeroCard';
import { UrgencyPill } from '../../components/UrgencyPill';
import { useRepo } from '../../hooks/useRepo';
import { color, radius, spacing, type } from '../../theme/tokens';
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

  return (
    <AppShell>
      <View style={styles.header}>
        <Text style={styles.title}>💰 Finance</Text>
        <Text style={styles.subtitle}>Subscriptions</Text>
      </View>

      <HeroCard>
        <Text style={styles.heroLabel}>Total monthly</Text>
        <Text style={styles.heroTotal}>{usd0(total)}</Text>
        <Text style={styles.heroCaption}>{rows.length} active subscriptions</Text>
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
              <Text style={styles.chipLabel}>{cat.name}</Text>
              <Text style={styles.chipValue}>{usd0(cat.subtotal)}</Text>
            </GlassChip>
          ))}
        </ScrollView>
      )}

      <GlassCard style={styles.listCard} contentStyle={styles.listCardContent}>
        <View style={styles.addSection}>
          <View style={styles.addToggleRow}>
            <Text style={styles.addToggleTitle}>Subscriptions</Text>
            <Pressable onPress={() => setShowAdd((v) => !v)} style={styles.addButton}>
              <Text style={styles.addButtonGlyph}>{showAdd ? '×' : '+'}</Text>
            </Pressable>
          </View>

          {showAdd && (
            <View style={styles.form}>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.iconInput]}
                  placeholder="🎬"
                  placeholderTextColor={color.text.faint}
                  value={icon}
                  onChangeText={setIcon}
                  maxLength={4}
                />
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Name"
                  placeholderTextColor={color.text.faint}
                  value={name}
                  onChangeText={setName}
                />
              </View>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Category"
                  placeholderTextColor={color.text.faint}
                  value={category}
                  onChangeText={setCategory}
                />
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="$0.00"
                  placeholderTextColor={color.text.faint}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  placeholder="Renews YYYY-MM-DD (optional)"
                  placeholderTextColor={color.text.faint}
                  value={renewsOn}
                  onChangeText={setRenewsOn}
                />
                <Pressable onPress={handleAdd} style={styles.submitButton}>
                  <Text style={styles.submitButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {rows.map((sub) => (
          <View key={sub.id} style={styles.row}>
            <View style={styles.iconTile}>
              <Text style={styles.iconGlyph}>{sub.icon}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{sub.name}</Text>
              <Text style={styles.rowCategory}>{sub.category}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowCost}>{usd(sub.amount)}</Text>
              <UrgencyPill dueDate={sub.renews_on} style={styles.rowPill} />
            </View>
            <Pressable onPress={() => remove(sub.id)} style={styles.removeButton} hitSlop={8}>
              <Text style={styles.removeGlyph}>×</Text>
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
    color: color.text.primaryAlt,
  },
  subtitle: {
    fontSize: type.body.fontSize,
    color: color.text.secondaryAlt,
    marginTop: 4,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: color.text.tertiary,
  },
  heroTotal: {
    fontSize: type.heroNumber.fontSize,
    fontWeight: type.heroNumber.fontWeight,
    letterSpacing: type.heroNumber.letterSpacing,
    color: color.text.primaryAlt,
    marginTop: 2,
  },
  heroCaption: {
    fontSize: 14,
    color: color.text.quaternary,
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
    color: color.text.tertiary,
  },
  chipValue: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
    color: color.text.primaryAlt,
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
    color: color.text.primaryAlt,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonGlyph: {
    fontSize: 18,
    fontWeight: '700',
    color: color.text.primaryAlt,
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
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 12,
    fontSize: type.body.fontSize,
    color: color.text.primary,
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
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: type.metaSemibold.fontSize,
    fontWeight: '700',
    color: color.text.primaryAlt,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: radius.iconTile,
    backgroundColor: 'rgba(255,255,255,0.28)',
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
    color: color.text.primaryAlt,
  },
  rowCategory: {
    fontSize: type.meta.fontSize,
    color: color.text.quaternary,
    marginTop: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowCost: {
    fontSize: 16,
    fontWeight: '700',
    color: color.text.primaryAlt,
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
    color: color.text.dimmed,
    fontWeight: '600',
  },
});

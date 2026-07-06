import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppShell } from '../../components/AppShell';
import { GlassCard } from '../../components/GlassCard';
import { GlassChip } from '../../components/GlassChip';
import { HeroCard } from '../../components/HeroCard';
import { UrgencyPill } from '../../components/UrgencyPill';
import { useRepo } from '../../hooks/useRepo';
import { radius, spacing, type } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import type { NewRow, SubscriptionCategory, SubscriptionRow } from '../../lib/types';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Fixed category set + their icon-font glyphs — replaces the old free-typed category/emoji fields. */
const CATEGORIES: { key: SubscriptionCategory; label: string; icon: MCIName }[] = [
  { key: 'Bills', label: 'Bills', icon: 'receipt' },
  { key: 'Streaming', label: 'Streaming', icon: 'movie-open-outline' },
  { key: 'Music', label: 'Music', icon: 'music-note' },
  { key: 'Software', label: 'Software', icon: 'laptop' },
  { key: 'Fitness', label: 'Fitness', icon: 'dumbbell' },
  { key: 'Others', label: 'Others', icon: 'dots-horizontal-circle-outline' },
];

const CATEGORY_ICON: Record<SubscriptionCategory, MCIName> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.icon])
) as Record<SubscriptionCategory, MCIName>;

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));

/** Legacy/unrecognized category values (pre-dating the fixed union) fall back to 'Others'. */
function normalizeCategory(value: string): SubscriptionCategory {
  return (CATEGORY_KEYS.has(value) ? value : 'Others') as SubscriptionCategory;
}

/** Same-day-offset ISO helper as Phone.dc.html's `iso(n)` — relative to "today". */
function isoInDays(n: number): string {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

/** rawSubs from Phone.dc.html, remapped onto the fixed category set ("News" has no clean fit -> Others). */
const SEED_SUBSCRIPTIONS: NewRow<SubscriptionRow>[] = [
  { name: 'Netflix', category: 'Streaming', amount: 15.49, renews_on: isoInDays(9) },
  { name: 'Spotify', category: 'Music', amount: 10.99, renews_on: isoInDays(1) },
  { name: 'iCloud+', category: 'Software', amount: 2.99, renews_on: isoInDays(17) },
  { name: 'ChatGPT Plus', category: 'Software', amount: 20.0, renews_on: isoInDays(4) },
  { name: 'Equinox', category: 'Fitness', amount: 45.0, renews_on: isoInDays(0) },
  { name: 'YouTube Premium', category: 'Streaming', amount: 13.99, renews_on: isoInDays(22) },
  { name: 'NYT', category: 'Others', amount: 4.25, renews_on: isoInDays(14) },
];

/** Mirrors Phone.dc.html's `usd`/`usd0` helpers. */
const usd = (n: number): string => `$${n.toFixed(2)}`;
const usd0 = (n: number): string => `$${n.toFixed(0)}`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function FinanceScreen() {
  const { palette, glass } = useTheme();
  const { rows: rawRows, insert, remove } = useRepo('subscriptions', SEED_SUBSCRIPTIONS);
  const rows = useMemo(() => rawRows.map((r) => ({ ...r, category: normalizeCategory(r.category) })), [rawRows]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SubscriptionCategory>(CATEGORIES[0].key);
  const [amount, setAmount] = useState('');
  const [renewsOn, setRenewsOn] = useState('');

  const total = useMemo(() => rows.reduce((sum, s) => sum + s.amount, 0), [rows]);

  const billsTotal = useMemo(
    () => rows.filter((s) => s.category === 'Bills').reduce((sum, s) => sum + s.amount, 0),
    [rows]
  );
  const subscriptionsTotal = total - billsTotal;

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
    setCategory(CATEGORIES[0].key);
    setAmount('');
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
      category,
      amount: parsedAmount,
      renews_on,
    });
    resetForm();
    setShowAdd(false);
  };

  const inputStyle = { backgroundColor: glass.fill, borderColor: glass.borderElevated };

  return (
    <AppShell>
      <HeroCard style={styles.hero}>
        <Text style={[styles.heroLabel, { color: palette.text.tertiary }]}>Total monthly</Text>
        <Text style={[styles.heroTotal, { color: palette.text.primaryAlt }]}>{usd0(total)}</Text>
        <Text style={[styles.heroCaption, { color: palette.text.quaternary }]}>{rows.length} active subscriptions</Text>

        <View style={[styles.heroBreakdown, { borderTopColor: palette.hairline }]}>
          <View style={styles.heroBreakdownItem}>
            <Text style={[styles.heroBreakdownLabel, { color: palette.text.tertiary }]}>Bills</Text>
            <Text style={[styles.heroBreakdownValue, { color: palette.text.primaryAlt }]}>{usd0(billsTotal)}</Text>
          </View>
          <View style={styles.heroBreakdownItem}>
            <Text style={[styles.heroBreakdownLabel, { color: palette.text.tertiary }]}>Subscriptions</Text>
            <Text style={[styles.heroBreakdownValue, { color: palette.text.primaryAlt }]}>
              {usd0(subscriptionsTotal)}
            </Text>
          </View>
        </View>
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
                  style={[styles.input, styles.flexInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="Name"
                  placeholderTextColor={palette.text.faint}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.categoryPickerRow}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: active ? glass.borderElevated : glass.fill, borderColor: glass.borderBase },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={15}
                        color={active ? palette.accentText : palette.text.tertiary}
                      />
                      <Text
                        style={[
                          styles.categoryChipLabel,
                          { color: active ? palette.text.primaryAlt : palette.text.tertiary },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.formRow}>
                <TextInput
                  style={[styles.input, styles.amountInput, inputStyle, { color: palette.text.primary }]}
                  placeholder="$0.00"
                  placeholderTextColor={palette.text.faint}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
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
              <MaterialCommunityIcons name={CATEGORY_ICON[sub.category]} size={22} color={palette.text.primaryAlt} />
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
  hero: {
    marginTop: 16,
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
  heroBreakdown: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 24,
  },
  heroBreakdownItem: {
    gap: 2,
  },
  heroBreakdownLabel: {
    fontSize: type.caption.fontSize,
  },
  heroBreakdownValue: {
    fontSize: type.cardTitle.fontSize,
    fontWeight: type.cardTitle.fontWeight,
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
  flexInput: {
    flex: 1,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    borderWidth: 1,
  },
  categoryChipLabel: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
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

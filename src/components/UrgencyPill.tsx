import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { dueMeta } from '../lib/dueDate';
import { useTheme } from '../theme/ThemeContext';
import { type as typeScale } from '../theme/tokens';

type Props = {
  /** ISO date string ("YYYY-MM-DD") or null/undefined for "no date set". */
  dueDate: string | null | undefined;
  /** When true, renders as "Done" regardless of dueDate. */
  done?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Renders a neutral due-date/renewal-date pill (label only, no urgency color-coding). */
export function UrgencyPill({ dueDate, done, style }: Props) {
  const { palette, glass } = useTheme();
  const label = done ? 'Done' : dueMeta(dueDate).label;

  return (
    <View style={[styles.pill, { backgroundColor: glass.fill, borderColor: glass.borderBase }, style]}>
      <Text style={[styles.text, { color: palette.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typeScale.pill.fontSize,
    fontWeight: typeScale.pill.fontWeight,
  },
});

export default UrgencyPill;

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { dueMeta } from '../lib/dueDate';
import { doneColor, type as typeScale } from '../theme/tokens';

type Props = {
  /** ISO date string ("YYYY-MM-DD") or null/undefined for "no date set". */
  dueDate: string | null | undefined;
  /** When true, renders as "Done" using the done-state color regardless of dueDate. */
  done?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Renders a due-date/renewal-date urgency pill using dueMeta(); supports a "Done" override. */
export function UrgencyPill({ dueDate, done, style }: Props) {
  const label = done ? 'Done' : dueMeta(dueDate).label;
  const { bg, fg } = done ? doneColor : dueMeta(dueDate);

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 11,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typeScale.pill.fontSize,
    fontWeight: typeScale.pill.fontWeight,
  },
});

export default UrgencyPill;

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { accent } from '../theme/accent';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday-first weekday index (0=Mon..6=Sun) for a Date whose native getDay() is 0=Sun..6=Sat. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Pure-display weekly strip: M T W T F S S for the current calendar week, with today
 * emphasized via a filled accent circle + bold text. No interactivity this phase —
 * Phase 5/6 may wire day selection later if ever needed.
 */
export function WeekStrip() {
  const { palette } = useTheme();
  const todayIndex = useMemo(() => mondayIndex(new Date()), []);
  const diag = accent.diagonal();

  return (
    <View style={styles.row}>
      {DAY_LETTERS.map((letter, i) => {
        const isToday = i === todayIndex;
        return (
          <View key={i} style={styles.cell}>
            {isToday ? (
              <LinearGradient colors={diag.colors} start={diag.start} end={diag.end} style={styles.circle}>
                <Text style={styles.letterToday}>{letter}</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.letter, { color: palette.text.quaternary }]}>{letter}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cell: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 13,
    fontWeight: '600',
  },
  letterToday: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

export default WeekStrip;

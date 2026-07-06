import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Small glass chip: same theme-driven blur/fill/flat-border treatment as GlassCard, at
 * the chip corner radius. Used for PR chip cards + finance category chips.
 */
export function GlassChip({ children, style, contentStyle }: Props) {
  const { glass } = useTheme();
  const borderRadius = radius.chip;

  return (
    <View style={[{ borderRadius }, style]}>
      <View style={[styles.clip, { borderRadius, borderWidth: 1, borderColor: glass.borderBase }]}>
        <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  content: {
    padding: 12,
  },
});

export default GlassChip;

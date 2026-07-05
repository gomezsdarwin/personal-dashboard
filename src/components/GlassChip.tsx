import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Small glass chip per HANDOFF's "Small chip" recipe: rgba(255,255,255,0.14) tint,
 * blur(26) saturate(1.8), 1px rgba(255,255,255,0.35) border, 20px radius.
 * Used for PR chip cards + finance category chips.
 */
export function GlassChip({ children, style, contentStyle }: Props) {
  const g = glass.chip;
  return (
    <View
      style={[
        styles.clip,
        {
          borderRadius: g.borderRadius,
          borderColor: g.borderColor,
          borderWidth: g.borderWidth,
        },
        style,
      ]}
    >
      <BlurView intensity={g.intensity} tint={g.tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: g.backgroundColor }]} />
      <View style={styles.topHighlight} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  content: {
    padding: 12,
  },
});

export default GlassChip;

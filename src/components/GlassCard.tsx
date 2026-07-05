import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { glass } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override inner content padding (default matches HANDOFF card padding 16-18px). */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Translucent frosted-glass card per HANDOFF's "Card" recipe:
 * rgba(255,255,255,0.16) tint, blur(34) saturate(1.9), 1px rgba(255,255,255,0.4) border,
 * 28px radius, soft purple drop shadow + inset highlight.
 */
export function GlassCard({ children, style, contentStyle }: Props) {
  const g = glass.card;
  return (
    <View
      style={[
        {
          borderRadius: g.borderRadius,
          shadowColor: g.shadowColor,
          shadowOpacity: g.shadowOpacity,
          shadowRadius: g.shadowRadius,
          shadowOffset: g.shadowOffset,
          elevation: 6,
        },
        style,
      ]}
    >
      <View style={[styles.clip, { borderRadius: g.borderRadius, borderColor: g.borderColor, borderWidth: g.borderWidth }]}>
        <BlurView intensity={g.intensity} tint={g.tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: g.backgroundColor }]} />
        <View style={styles.topHighlight} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
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
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  content: {
    padding: 16,
  },
});

export default GlassCard;

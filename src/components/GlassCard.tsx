import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override inner content padding (default matches HANDOFF card padding 16-18px). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Override the corner radius (default = sampleindex.html's rounded-3xl, 24px). */
  radius?: number;
};

/**
 * Real frosted liquid-glass card: BlurView backdrop blur, neutral translucent fill, and a
 * flat 1px border (`border border-white/10` in the reference) — no specular gradient.
 * A prior pass here used a bright top-left -> faint bottom-right LinearGradient border;
 * sampleindex.html has no visible specular highlight, just a uniform hairline, so that
 * effect was simplified away.
 */
export function GlassCard({ children, style, contentStyle, radius: radiusOverride }: Props) {
  const { glass } = useTheme();
  const borderRadius = radiusOverride ?? radius.card;

  return (
    <View
      style={[
        {
          borderRadius,
          shadowColor: 'rgba(0,0,0,0.28)',
          shadowOpacity: 1,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 12 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        style={[styles.clip, { borderRadius, borderWidth: 1, borderColor: glass.borderBase }]}
      >
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
    padding: 16,
  },
});

export default GlassCard;

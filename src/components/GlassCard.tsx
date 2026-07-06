import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override inner content padding (default matches HANDOFF card padding 16-18px). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Override the corner radius (default = HANDOFF card 28px; e.g. 24 for inventory cards). */
  radius?: number;
};

/**
 * Real frosted liquid-glass card: BlurView backdrop blur, theme-driven translucent tint
 * fill, and a specular border simulated via a 1px LinearGradient wrapper (brightest at
 * top-left, fading toward the bottom-right) rather than a flat solid border color.
 */
export function GlassCard({ children, style, contentStyle, radius: radiusOverride }: Props) {
  const { glass } = useTheme();
  const borderRadius = radiusOverride ?? radius.card;

  return (
    <View
      style={[
        {
          borderRadius,
          shadowColor: 'rgba(0,0,0,0.22)',
          shadowOpacity: 1,
          shadowRadius: 34,
          shadowOffset: { width: 0, height: 12 },
          elevation: 6,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={glass.borderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderWrap, { borderRadius }]}
      >
        <View style={[styles.clip, { borderRadius: Math.max(borderRadius - 1, 0) }]}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  borderWrap: {
    padding: 1,
  },
  clip: {
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
});

export default GlassCard;

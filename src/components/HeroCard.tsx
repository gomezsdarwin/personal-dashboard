import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Gradient-tinted hero glass card (used for the Finance monthly total): same blur + flat-
 * border treatment as GlassCard, plus an extra diagonal tint glaze (glass.heroGradient,
 * brighter top-left) layered over the flat fill for a touch more presence than a plain
 * card. Border uses borderElevated (a touch stronger than a plain card's) since this
 * surface is meant to read as elevated/emphasized.
 */
export function HeroCard({ children, style, contentStyle }: Props) {
  const { glass } = useTheme();
  const borderRadius = radius.card;

  return (
    <View
      style={[
        {
          borderRadius,
          shadowColor: 'rgba(0,0,0,0.3)',
          shadowOpacity: 1,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 12 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        style={[styles.clip, { borderRadius, borderWidth: 1, borderColor: glass.borderElevated }]}
      >
        <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
        <LinearGradient
          colors={glass.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.77, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
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
    padding: 20,
  },
});

export default HeroCard;

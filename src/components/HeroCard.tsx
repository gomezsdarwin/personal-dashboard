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
 * Gradient-tinted hero glass card (used for the Finance monthly total): same blur +
 * specular-border treatment as GlassCard, plus an extra diagonal tint glaze
 * (glass.heroGradient, brighter top-left) layered over the flat fill for a touch more
 * presence than a plain card.
 */
export function HeroCard({ children, style, contentStyle }: Props) {
  const { glass } = useTheme();
  const borderRadius = radius.card;

  return (
    <View
      style={[
        {
          borderRadius,
          shadowColor: 'rgba(0,0,0,0.24)',
          shadowOpacity: 1,
          shadowRadius: 34,
          shadowOffset: { width: 0, height: 12 },
          elevation: 6,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={glass.borderGradientElevated}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderWrap, { borderRadius }]}
      >
        <View style={[styles.clip, { borderRadius: Math.max(borderRadius - 1, 0) }]}>
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
    padding: 20,
  },
});

export default HeroCard;

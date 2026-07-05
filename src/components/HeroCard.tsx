import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Gradient-tinted hero glass card per HANDOFF (used for the Finance monthly total).
 * background: linear-gradient(140deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))
 * over blur(34) saturate(1.9), 1px rgba(255,255,255,0.45) border, 28px radius.
 */
export function HeroCard({ children, style, contentStyle }: Props) {
  const g = glass.hero;
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
        <LinearGradient
          colors={g.gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.77, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
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
    padding: 20,
  },
});

export default HeroCard;

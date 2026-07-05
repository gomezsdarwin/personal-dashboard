import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, wallpaperMesh, type WallpaperName } from '../theme/tokens';

type Props = {
  children?: React.ReactNode;
  wallpaper?: WallpaperName;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Per-screen scroll wrapper: pastel wallpaper mesh background, top safe-area padding,
 * ~118px bottom padding to clear the floating tab bar, hidden scroll indicator, and a
 * 0.4s fade + rise-in animation on mount (mirrors Phone.dc.html's `floatIn` keyframes).
 */
export function AppShell({ children, wallpaper = 'Sunset', contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const mesh = wallpaperMesh[wallpaper];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={mesh.linear}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[
          {
            paddingTop: Math.max(insets.top, spacing.topSafe),
            paddingBottom: spacing.bottomTabClearance,
            paddingHorizontal: spacing.screenSide,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
});

export default AppShell;

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, type WallpaperName } from '../theme/tokens';
import { defaultArtwork } from '../data/artworks';

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

  return (
    <View style={styles.root}>
      <ImageBackground source={defaultArtwork.source} resizeMode="cover" style={StyleSheet.absoluteFill}>
        {/* Hardcoded dark scrim for legibility of glass cards over the painting.
            Will become theme-driven (per-artwork/dark-light aware) in a later phase. */}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />
      </ImageBackground>
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
  scrim: {
    backgroundColor: 'rgba(5,10,20,0.35)',
  },
  scroller: {
    flex: 1,
  },
});

export default AppShell;

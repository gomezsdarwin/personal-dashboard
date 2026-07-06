import React, { useEffect, useMemo, useRef } from 'react';
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
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { artworks, defaultArtwork } from '../data/artworks';
import { HeaderBar, HEADER_CONTENT_HEIGHT } from './HeaderBar';

type Props = {
  children?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Per-screen scroll wrapper: painted-artwork background, a fixed frosted HeaderBar
 * pinned above the scroll content (matching sampleindex.html's `fixed top-0` header —
 * scrolling content passes beneath it rather than scrolling it away), ~118px bottom
 * padding to clear the tab bar, hidden scroll indicator, and a 0.4s fade + rise-in
 * animation on mount (mirrors Phone.dc.html's `floatIn` keyframes).
 *
 * HeaderBar is mounted here (once, centrally) rather than per-screen — every screen used
 * to render its own `<HeaderBar />` as the first scrolling child, which meant it scrolled
 * away with the rest of the content instead of staying fixed like the reference.
 */
export function AppShell({ children, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const { glass, artworkId } = useTheme();
  const activeArtwork = useMemo(
    () => artworks.find((a) => a.id === artworkId) ?? defaultArtwork,
    [artworkId]
  );
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
      <ImageBackground source={activeArtwork.source} resizeMode="cover" style={StyleSheet.absoluteFill}>
        {/* Theme-driven scrim (dark/light-aware) for legibility of glass cards over the
            painting. Active artwork comes from Settings (useTheme().artworkId). */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: glass.scrim }]}
          pointerEvents="none"
        />
      </ImageBackground>
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={[
          {
            paddingTop: insets.top + HEADER_CONTENT_HEIGHT + 16,
            paddingBottom: spacing.bottomTabClearance,
            paddingHorizontal: spacing.screenSide,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
      </ScrollView>

      <HeaderBar />
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

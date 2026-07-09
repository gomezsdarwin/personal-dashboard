import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, withAlpha } from '../theme/ThemeContext';
import { accent } from '../theme/accent';
import { SettingsSheet } from './SettingsSheet';

/** Content height below the safe-area inset — matches sampleindex.html's `h-16` (64px). */
export const HEADER_CONTENT_HEIGHT = 64;

/**
 * Fixed, full-width frosted header bar — mounted once by AppShell (not per-screen), so it
 * stays pinned above the scrolling content exactly like sampleindex.html's
 * `<header class="fixed top-0 w-full ... bg-black/40 backdrop-blur-[80px]
 * border-b border-white/10">`. Left: avatar (+ optional display name). Right: bell +
 * settings gear, both styled as identical `bg-white/5` circle buttons — the reference
 * mock only shows a bell, but a settings entry point is load-bearing app functionality
 * (theme/opacity/artwork/name live there), so it's kept and styled to match the bell
 * rather than standing out as a mismatched addition.
 */
type Props = {
  sectionTitle?: string;
};

export function HeaderBar({ sectionTitle }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, glass, mode, displayName } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const initial = useMemo(() => {
    const trimmed = displayName.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : null;
  }, [displayName]);

  const nameText = sectionTitle ?? displayName.trim();

  const diag = accent.diagonal();
  const iconBtnBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const handleBellPress = () => {
    // Decorative for now — no real notifications this phase.
    console.log('[HeaderBar] bell pressed (no-op, notifications not built yet)');
  };

  return (
    <>
      <View
        style={[
          styles.wrapper,
          {
            height: insets.top + HEADER_CONTENT_HEIGHT,
            paddingTop: insets.top,
            borderBottomColor: glass.borderBase,
          },
        ]}
      >
        <BlurView intensity={glass.blurIntensityHeader} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fillHeader }]} />

        <View style={[styles.row, sectionTitle ? styles.rowIconsOnly : null]}>
          {sectionTitle ? null : (
            <View style={styles.identity}>
              <LinearGradient
                colors={diag.colors}
                start={diag.start}
                end={diag.end}
                style={[styles.avatar, { borderColor: withAlpha(palette.accentText, 0.4) }]}
              >
                {initial ? (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                ) : (
                  <MaterialCommunityIcons name="account" size={20} color="#fff" />
                )}
              </LinearGradient>
              {nameText ? (
                <Text style={[styles.name, { color: palette.text.primary }]} numberOfLines={1}>
                  {nameText}
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.icons}>
            <Pressable
              onPress={handleBellPress}
              style={[styles.iconButton, { backgroundColor: iconBtnBg }]}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <MaterialCommunityIcons name="bell" size={20} color={palette.text.primary} />
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              style={[styles.iconButton, { backgroundColor: iconBtnBg }]}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <MaterialCommunityIcons name="cog-outline" size={20} color={palette.text.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    borderBottomWidth: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowIconsOnly: {
    justifyContent: 'flex-end',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  icons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HeaderBar;

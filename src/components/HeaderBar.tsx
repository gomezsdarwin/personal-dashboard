import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { accent } from '../theme/accent';
import { radius } from '../theme/tokens';
import { SettingsSheet } from './SettingsSheet';

/**
 * Reusable top row: small avatar (initial from displayName, or a generic person glyph)
 * on the left, bell (decorative) + gear (opens Settings) on the right. Mounted on Home
 * this phase; Phase 6 adds it to the other 3 tabs. Phase 4 owns Home's full greeting
 * layout — this component intentionally stays simple (avatar+name row, icons row) so it
 * can be dropped into any screen without assuming surrounding layout.
 */
export function HeaderBar() {
  const { palette, glass, displayName } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const initial = useMemo(() => {
    const trimmed = displayName.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : null;
  }, [displayName]);

  const diag = accent.diagonal();

  const handleBellPress = () => {
    // Decorative for now — no real notifications this phase.
    console.log('[HeaderBar] bell pressed (no-op, notifications not built yet)');
  };

  return (
    <>
      <View style={styles.row}>
        <View style={styles.identity}>
          <LinearGradient colors={diag.colors} start={diag.start} end={diag.end} style={styles.avatar}>
            {initial ? (
              <Text style={styles.avatarInitial}>{initial}</Text>
            ) : (
              <Feather name="user" size={18} color="#fff" />
            )}
          </LinearGradient>
          {displayName.trim() ? (
            <Text style={[styles.name, { color: palette.text.primary }]} numberOfLines={1}>
              {displayName.trim()}
            </Text>
          ) : null}
        </View>

        <View style={styles.icons}>
          <Pressable
            onPress={handleBellPress}
            style={[styles.iconButton, { backgroundColor: glass.fill, borderColor: glass.borderBase }]}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Feather name="bell" size={18} color={palette.text.primary} />
          </Pressable>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={[styles.iconButton, { backgroundColor: glass.fill, borderColor: glass.borderBase }]}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={18} color={palette.text.primary} />
          </Pressable>
        </View>
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 15,
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
    width: 38,
    height: 38,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HeaderBar;

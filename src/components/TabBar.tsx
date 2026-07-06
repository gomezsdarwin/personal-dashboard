import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/tokens';

/**
 * Minimal structural subset of React Navigation's BottomTabBarProps that this
 * component actually uses. Defined locally (rather than importing from
 * @react-navigation/bottom-tabs) to avoid an extra direct dependency — expo-router's
 * <Tabs tabBar={...}> passes an object that satisfies this shape.
 */
export type TabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/** Feather icon names — one consistent vector-icon family across the whole app (matches HeaderBar's bell/settings/user glyphs), replacing the old mismatched emoji. */
const TAB_ICON: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  index: 'home',
  gym: 'activity',
  finance: 'dollar-sign',
  peptides: 'droplet',
};

const TAB_LABEL: Record<string, string> = {
  index: 'Home',
  gym: 'Gym',
  finance: 'Finance',
  peptides: 'Peptides',
};

/**
 * Custom floating glass bottom tab bar for expo-router's Tabs `tabBar` prop.
 * 56x56 rounded glass highlight sits behind the active tab's icon+label.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { glass, palette } = useTheme();
  const borderRadius = radius.tabBar;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <LinearGradient
        colors={glass.borderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderWrap, { borderRadius }]}
      >
        <View style={[styles.clip, { borderRadius: Math.max(borderRadius - 1, 0) }]}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;
              const label = TAB_LABEL[route.name] ?? (options.title ?? route.name);
              const iconName = TAB_ICON[route.name] ?? 'circle';

              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  style={styles.tab}
                >
                  {isFocused ? (
                    <View style={[styles.highlight, { backgroundColor: glass.borderElevated }]} />
                  ) : null}
                  <Feather
                    name={iconName}
                    size={22}
                    color={isFocused ? palette.text.primary : palette.text.secondary}
                  />
                  <Text style={[styles.label, { color: palette.text.secondary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  borderWrap: {
    padding: 1,
    shadowColor: 'rgba(0,0,0,0.28)',
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  clip: {
    height: 72,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  tab: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
  },
  highlight: {
    position: 'absolute',
    top: 2,
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  icon: {
    fontSize: 25,
    lineHeight: 28,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default TabBar;

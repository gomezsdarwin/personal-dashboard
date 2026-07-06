import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

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

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Matches sampleindex.html's Material Symbols choices (dashboard/fitness_center/
 *  payments/pill) via MaterialCommunityIcons' closest equivalents. Only Home swaps
 *  outline<->filled between states — the reference keeps the other three tabs' glyphs
 *  identical across active/inactive, differentiating purely by color + highlight pill. */
function tabIconName(routeName: string, focused: boolean): MCIName {
  switch (routeName) {
    case 'index':
      return focused ? 'view-dashboard' : 'view-dashboard-outline';
    case 'gym':
      return 'dumbbell';
    case 'finance':
      return 'cash-multiple';
    case 'peptides':
      return 'pill';
    default:
      return 'circle-outline';
  }
}

const TAB_LABEL: Record<string, string> = {
  index: 'Home',
  gym: 'Gym',
  finance: 'Finance',
  peptides: 'Supplements',
};

/**
 * Custom glass bottom tab bar for expo-router's Tabs `tabBar` prop. Edge-to-edge, bottom-
 * anchored, top-corners-only radius (`rounded-t-[32px]`) — matches sampleindex.html's
 * `<nav class="fixed bottom-0 left-0 w-full ... bg-black/60 backdrop-blur-[80px]
 * border-t border-white/15 rounded-t-[32px]">` exactly, replacing the previous floating
 * pill-shaped bar (16px side margins, fully-rounded corners).
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { glass, palette, mode } = useTheme();

  const inactiveColor = mode === 'dark' ? 'rgba(255,255,255,0.5)' : palette.text.tertiary;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.clip, { borderColor: glass.borderTabBar }]}>
        <BlurView intensity={glass.blurIntensityTabBar} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fillTabBar }]} />
        <View style={[styles.row, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const label = TAB_LABEL[route.name] ?? (options.title ?? route.name);
            const iconName = tabIconName(route.name, isFocused);
            const color = isFocused ? palette.accentText : inactiveColor;

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
                <View
                  style={[
                    styles.contentWrap,
                    isFocused && { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
                  ]}
                >
                  <MaterialCommunityIcons name={iconName} size={26} color={color} />
                  <Text style={[styles.label, { color }]}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  clip: {
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOpacity: 1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

export default TabBar;

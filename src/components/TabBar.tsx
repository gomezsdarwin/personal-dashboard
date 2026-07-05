import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { glass } from '../theme/tokens';

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

const TAB_ICON: Record<string, string> = {
  index: '🏠',
  gym: '🏋️',
  finance: '💰',
  peptides: '💊',
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
  const g = glass.tabBar;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View
        style={[
          styles.clip,
          { borderRadius: g.borderRadius, borderColor: g.borderColor, borderWidth: g.borderWidth },
        ]}
      >
        <BlurView intensity={g.intensity} tint={g.tint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: g.backgroundColor }]} />
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const label = TAB_LABEL[route.name] ?? (options.title ?? route.name);
            const icon = TAB_ICON[route.name] ?? '•';

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
                {isFocused ? <View style={styles.highlight} /> : null}
                <Text style={styles.icon}>{icon}</Text>
                <Text style={styles.label}>{label}</Text>
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
    left: 16,
    right: 16,
  },
  clip: {
    height: 72,
    overflow: 'hidden',
    shadowColor: 'rgba(90,70,130,0.22)',
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
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
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  icon: {
    fontSize: 25,
    lineHeight: 28,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a4558',
  },
});

export default TabBar;

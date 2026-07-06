import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { artworks } from '../data/artworks';
import { radius } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// Range widened to bracket the new 0.5 default (matching sampleindex.html's
// `bg-black/50` cards) — the old 0.06-0.35 range was tuned around the previous 0.16
// default and would clip the slider thumb below the new default's position.
const MIN_OPACITY = 0.2;
const MAX_OPACITY = 0.75;

// 'auto' is the default neutral tint (black-on-dark / white-on-light, see
// ThemeContext's buildGlass) — matches sampleindex.html's `bg-black/50` cards. The other
// presets are real tint colors a user can opt into for personalization.
const TINT_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Neutral', value: 'auto' },
  { label: 'Steel blue', value: '#7fa2c9' },
  { label: 'Cyan', value: '#6fd6e0' },
  { label: 'Lavender', value: '#b9a8ff' },
  { label: 'Warm amber', value: '#e8b673' },
];

/**
 * Bottom-sheet Settings modal: theme mode, glass opacity/tint, artwork picker, and
 * display name. All controls bind directly to ThemeContext setters (which already
 * persist to AsyncStorage), so there is no separate "Save" step — changes apply live
 * and are visible immediately behind/around the sheet.
 */
export function SettingsSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const {
    palette,
    glass,
    mode,
    setMode,
    glassOpacity,
    setGlassOpacity,
    glassTint,
    setGlassTint,
    artworkId,
    setArtworkId,
    displayName,
    setDisplayName,
  } = useTheme();

  const modeChip = (value: ThemeMode, label: string) => {
    const active = mode === value;
    return (
      <Pressable
        key={value}
        onPress={() => setMode(value)}
        style={[
          styles.modeChip,
          {
            backgroundColor: active ? glass.borderElevated : glass.fill,
            borderColor: glass.borderBase,
          },
        ]}
      >
        <Text style={[styles.modeChipText, { color: palette.text.primary }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View pointerEvents="box-none" style={styles.sheetWrap}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <BlurView intensity={glass.blurIntensity} tint={glass.blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />

          <View style={styles.content}>
            <View style={styles.grabberRow}>
              <View style={[styles.grabber, { backgroundColor: glass.borderElevated }]} />
            </View>

            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.text.primary }]}>Settings</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings">
                <MaterialCommunityIcons name="close" size={22} color={palette.text.secondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Mode */}
              <Text style={[styles.sectionLabel, { color: palette.text.secondary }]}>Appearance</Text>
              <View style={styles.modeRow}>
                {modeChip('dark', 'Dark')}
                {modeChip('light', 'Light')}
              </View>

              {/* Glass opacity */}
              <Text style={[styles.sectionLabel, { color: palette.text.secondary }]}>
                Glass opacity · {Math.round(glassOpacity * 100)}%
              </Text>
              <Slider
                minimumValue={MIN_OPACITY}
                maximumValue={MAX_OPACITY}
                value={glassOpacity}
                onValueChange={setGlassOpacity}
                minimumTrackTintColor={palette.accentText}
                maximumTrackTintColor={glass.borderBase}
                thumbTintColor={palette.accentText}
                style={styles.slider}
              />

              {/* Glass tint */}
              <Text style={[styles.sectionLabel, { color: palette.text.secondary }]}>Glass tint</Text>
              <View style={styles.swatchRow}>
                {TINT_PRESETS.map((preset) => {
                  const active = preset.value.toLowerCase() === glassTint.toLowerCase();
                  // 'auto' has no fixed hex — preview it as the neutral color it actually
                  // resolves to for the current mode (black-on-dark / white-on-light).
                  const previewColor =
                    preset.value === 'auto' ? (mode === 'dark' ? '#000000' : '#ffffff') : preset.value;
                  return (
                    <Pressable
                      key={preset.value}
                      onPress={() => setGlassTint(preset.value)}
                      accessibilityRole="button"
                      accessibilityLabel={preset.label}
                      style={styles.swatchTapArea}
                    >
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: previewColor },
                          active && [styles.swatchActive, { borderColor: palette.accentText }],
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>

              {/* Artwork picker */}
              <Text style={[styles.sectionLabel, { color: palette.text.secondary }]}>Background artwork</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.artworkScroll}>
                {artworks.map((art) => {
                  const active = art.id === artworkId;
                  return (
                    <Pressable
                      key={art.id}
                      onPress={() => setArtworkId(art.id)}
                      style={styles.artworkTapArea}
                    >
                      <View
                        style={[
                          styles.artworkThumbWrap,
                          active && [styles.artworkThumbWrapActive, { borderColor: palette.accentText }],
                        ]}
                      >
                        <Image source={art.source} style={styles.artworkThumb} resizeMode="cover" />
                      </View>
                      <Text
                        style={[styles.artworkTitle, { color: palette.text.primary }]}
                        numberOfLines={1}
                      >
                        {art.title}
                      </Text>
                      <Text
                        style={[styles.artworkArtist, { color: palette.text.quaternary }]}
                        numberOfLines={1}
                      >
                        {art.artist}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Display name */}
              <Text style={[styles.sectionLabel, { color: palette.text.secondary }]}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={palette.text.quaternary}
                style={[
                  styles.nameInput,
                  { color: palette.text.primary, borderColor: glass.borderBase, backgroundColor: glass.fill },
                ]}
              />
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '70%',
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.chip,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 36,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 14,
  },
  swatchTapArea: {
    padding: 4,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  swatchActive: {
    borderWidth: 3,
  },
  artworkScroll: {
    flexGrow: 0,
  },
  artworkTapArea: {
    width: 96,
    marginRight: 14,
  },
  artworkThumbWrap: {
    width: 96,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  artworkThumbWrapActive: {
    borderWidth: 3,
  },
  artworkThumb: {
    width: '100%',
    height: '100%',
  },
  artworkTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  artworkArtist: {
    fontSize: 11,
    marginTop: 1,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});

export default SettingsSheet;

import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled public-domain artworks used as the app's background art (see
 * scripts/fetch-artworks.mjs for provenance / re-fetching). Only artworks that
 * actually downloaded successfully are listed here.
 */
export type Artwork = {
  id: string;
  title: string;
  artist: string;
  source: ImageSourcePropType;
  luminance: 'dark' | 'light';
};

export const artworks: Artwork[] = [
  {
    id: 'starry-night',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    source: require('../../assets/art/starry-night.jpg'),
    luminance: 'dark',
  },
  {
    id: 'cafe-terrace-at-night',
    title: 'The Café Terrace at Night',
    artist: 'Vincent van Gogh',
    source: require('../../assets/art/cafe-terrace-at-night.jpg'),
    luminance: 'dark',
  },
  {
    id: 'wheatfield-with-cypresses',
    title: 'Wheatfield with Cypresses',
    artist: 'Vincent van Gogh',
    source: require('../../assets/art/wheatfield-with-cypresses.jpg'),
    luminance: 'light',
  },
  {
    id: 'sunday-afternoon-la-grande-jatte',
    title: 'A Sunday Afternoon on the Island of La Grande Jatte',
    artist: 'Georges Seurat',
    source: require('../../assets/art/sunday-afternoon-la-grande-jatte.jpg'),
    luminance: 'light',
  },
  {
    id: 'pine-tree-at-saint-tropez',
    title: 'The Pine Tree at Saint-Tropez',
    artist: 'Paul Signac',
    source: require('../../assets/art/pine-tree-at-saint-tropez.jpg'),
    luminance: 'light',
  },
  {
    id: 'impression-sunrise',
    title: 'Impression, Sunrise',
    artist: 'Claude Monet',
    source: require('../../assets/art/impression-sunrise.jpg'),
    luminance: 'dark',
  },
  {
    id: 'water-lilies',
    title: 'Water Lilies',
    artist: 'Claude Monet',
    source: require('../../assets/art/water-lilies.jpg'),
    luminance: 'light',
  },
  {
    id: 'bal-du-moulin-de-la-galette',
    title: 'Bal du moulin de la Galette',
    artist: 'Pierre-Auguste Renoir',
    source: require('../../assets/art/bal-du-moulin-de-la-galette.jpg'),
    luminance: 'light',
  },
  {
    id: 'boulevard-montmartre-at-night',
    title: 'The Boulevard Montmartre at Night',
    artist: 'Camille Pissarro',
    source: require('../../assets/art/boulevard-montmartre-at-night.jpg'),
    luminance: 'dark',
  },
  {
    id: 'the-dance-class',
    title: 'The Dance Class',
    artist: 'Edgar Degas',
    source: require('../../assets/art/the-dance-class.jpg'),
    luminance: 'light',
  },
];

export const defaultArtworkId = 'starry-night';

export const defaultArtwork: Artwork =
  artworks.find((a) => a.id === defaultArtworkId) ?? artworks[0];

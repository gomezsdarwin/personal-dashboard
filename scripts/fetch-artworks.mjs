#!/usr/bin/env node
/**
 * Fetches a fixed set of public-domain artworks from Wikimedia Commons and
 * saves them as local JPEGs in assets/art/<id>.jpg, for use as bundled
 * background art (no runtime network dependency at app runtime).
 *
 * Usage: node scripts/fetch-artworks.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'assets', 'art');
const USER_AGENT = 'PersonalDashboardApp/1.0 (personal use; contact: gomezsdarwin@gmail.com)';
const IMG_WIDTH = 1600;

/**
 * Each entry: id, title, artist, luminance ('dark' | 'light'), and a list of
 * candidate Wikimedia Commons `File:` titles to try in order (some artworks
 * have multiple plausible file names on Commons, e.g. with/without diacritics
 * or alternate spellings).
 */
const ARTWORKS = [
  {
    id: 'starry-night',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh',
    luminance: 'dark',
    candidates: ['Van Gogh - Starry Night - Google Art Project.jpg', 'VanGogh-starry_night.jpg'],
  },
  {
    id: 'cafe-terrace-at-night',
    title: 'The Café Terrace at Night',
    artist: 'Vincent van Gogh',
    luminance: 'dark',
    candidates: [
      'Vincent van Gogh (1853-1890) - Café Terrace at Night (Yorck).jpg',
      'Vincent Willem van Gogh - Cafe Terrace at Night (Yorck).jpg',
      'Van Gogh - Terrasse des Cafés an der Place du Forum in Arles am Abend1.jpeg',
    ],
  },
  {
    id: 'wheatfield-with-cypresses',
    title: 'Wheatfield with Cypresses',
    artist: 'Vincent van Gogh',
    luminance: 'light',
    candidates: [
      'Vincent van Gogh - Wheat Field with Cypresses - Google Art Project.jpg',
      'Van Gogh Wheat Field with Cypresses.jpg',
    ],
  },
  {
    id: 'sunday-afternoon-la-grande-jatte',
    title: 'A Sunday Afternoon on the Island of La Grande Jatte',
    artist: 'Georges Seurat',
    luminance: 'light',
    candidates: [
      'A Sunday on La Grande Jatte, Georges Seurat, 1884.jpg',
      'Georges Seurat - A Sunday on La Grande Jatte - Google Art Project.jpg',
    ],
  },
  {
    id: 'pine-tree-at-saint-tropez',
    title: 'The Pine Tree at Saint-Tropez',
    artist: 'Paul Signac',
    luminance: 'light',
    candidates: [
      'Paul Signac, 1909, The Pine Tree at Saint Tropez, oil on canvas, 72 x 92 cm, Pushkin Museum, Moscow.jpg',
      'Paul Signac - The Bonaventure Pine - Google Art Project.jpg',
    ],
  },
  {
    id: 'impression-sunrise',
    title: 'Impression, Sunrise',
    artist: 'Claude Monet',
    luminance: 'dark',
    candidates: [
      'Monet - Impression, Sunrise.jpg',
      'Claude Monet, Impression, soleil levant.jpg',
    ],
  },
  {
    id: 'water-lilies',
    title: 'Water Lilies',
    artist: 'Claude Monet',
    luminance: 'light',
    candidates: [
      'Claude Monet - Water Lilies - Google Art Project (462013).jpg',
      'Monet Water Lilies 1919.jpg',
      'Claude Monet - Water Lilies (1916).jpg',
    ],
  },
  {
    id: 'bal-du-moulin-de-la-galette',
    title: 'Bal du moulin de la Galette',
    artist: 'Pierre-Auguste Renoir',
    luminance: 'light',
    candidates: [
      'Renoir, Pierre-Auguste - Dance at Le Moulin de la Galette, 1876.jpg',
      'Auguste Renoir - Dance at Le Moulin de la Galette - Google Art Project.jpg',
    ],
  },
  {
    id: 'boulevard-montmartre-at-night',
    title: 'The Boulevard Montmartre at Night',
    artist: 'Camille Pissarro',
    luminance: 'dark',
    candidates: [
      'Camille Pissarro, The Boulevard Montmartre at Night, 1897.jpg',
      'Camille Pissarro - Boulevard Montmartre at Night - c 1897 - National Gallery UK.jpg',
    ],
  },
  {
    id: 'the-dance-class',
    title: 'The Dance Class',
    artist: 'Edgar Degas',
    luminance: 'light',
    candidates: [
      'Edgar Degas - The Dance Class - Google Art Project.jpg',
      'Edgar Degas - La Classe de danse.jpg',
    ],
  },
];

/** Queries the Commons API for a single File: title, returning a thumburl or null. */
async function resolveImageUrl(fileTitle) {
  const apiUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(`File:${fileTitle}`) +
    `&prop=imageinfo&iiprop=url&iiurlwidth=${IMG_WIDTH}&format=json`;

  const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const json = await res.json();
  const pages = json?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  const info = page.imageinfo?.[0];
  if (!info) return null;
  return info.thumburl || info.url || null;
}

async function downloadImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const results = [];

  for (const art of ARTWORKS) {
    const outPath = path.join(OUT_DIR, `${art.id}.jpg`);
    let resolvedUrl = null;
    let usedTitle = null;

    for (const candidate of art.candidates) {
      try {
        const url = await resolveImageUrl(candidate);
        if (url) {
          resolvedUrl = url;
          usedTitle = candidate;
          break;
        }
      } catch (err) {
        console.warn(`  (lookup error for "${candidate}": ${err.message})`);
      }
    }

    if (!resolvedUrl) {
      console.error(`FAILED  ${art.id}: no candidate File: title resolved (tried ${art.candidates.length})`);
      results.push({ ...art, ok: false });
      continue;
    }

    try {
      const buf = await downloadImage(resolvedUrl);
      if (buf.length < 20 * 1024) {
        throw new Error(`downloaded file too small (${buf.length} bytes) - likely not a real image`);
      }
      await writeFile(outPath, buf);
      console.log(`OK      ${art.id}  <- "${usedTitle}"  (${(buf.length / 1024).toFixed(0)} KB)`);
      results.push({ ...art, ok: true, bytes: buf.length });
    } catch (err) {
      console.error(`FAILED  ${art.id}: download error - ${err.message}`);
      results.push({ ...art, ok: false });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n${okCount}/${results.length} artworks downloaded successfully to ${OUT_DIR}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('Failed:', failed.map((r) => r.id).join(', '));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

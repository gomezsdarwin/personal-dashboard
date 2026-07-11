import { Platform, Share } from 'react-native';
import { createRepo } from './db';
import { todayIso } from './week';
import type { TableName } from './types';

/** Every table the app persists, in the order they should appear in an export. */
const EXPORT_TABLES: TableName[] = [
  'habits',
  'habit_completions',
  'tasks',
  'gym_sessions',
  'gym_split_config',
  'peptide_inventory',
  'peptide_doses',
  'subscriptions',
];

/**
 * Reads every table via the same Repo<T> layer the rest of the app uses (so this
 * works identically whether the account is Supabase-backed or on the local
 * AsyncStorage fallback) and returns one JSON-serializable snapshot.
 */
export async function gatherExportData(): Promise<Record<TableName, unknown[]>> {
  const entries = await Promise.all(
    EXPORT_TABLES.map(async (table) => {
      const repo = createRepo(table);
      const rows = await repo.list();
      return [table, rows] as const;
    })
  );
  return Object.fromEntries(entries) as Record<TableName, unknown[]>;
}

function exportFileName(): string {
  return `dashboard-export-${todayIso()}.json`;
}

/**
 * Gathers all app data and hands it off to the platform's download/share flow.
 * Web (this app is used as a bookmarked Safari site, not a native app): builds a
 * Blob + object URL and clicks a throwaway anchor to trigger a normal browser
 * download. Native: no expo-file-system dependency here, so it falls back to
 * react-native's `Share.share` with the raw JSON string.
 */
export async function exportAllData(): Promise<void> {
  const data = await gatherExportData();
  const json = JSON.stringify(data, null, 2);

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await Share.share({
    message: json,
    title: exportFileName(),
  });
}

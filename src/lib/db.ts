import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from './supabase';
import type { NewRow, TableName, TableRowMap } from './types';

export type Repo<T extends { id: string; user_id: string; created_at: string }> = {
  list(): Promise<T[]>;
  insert(row: NewRow<T>): Promise<T>;
  update(id: string, patch: Partial<NewRow<T>>): Promise<T>;
  remove(id: string): Promise<void>;
};

function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const LOCAL_USER_ID = 'local';

function storageKey(table: TableName): string {
  return `pd:${table}`;
}

async function readLocal<T>(table: TableName): Promise<T[]> {
  const raw = await AsyncStorage.getItem(storageKey(table));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function writeLocal<T>(table: TableName, rows: T[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(table), JSON.stringify(rows));
}

/**
 * Generic per-table repository. Supabase-backed (RLS-scoped to auth.uid()) when
 * EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are configured, otherwise falls back to
 * AsyncStorage under the `pd:<table>` key. Fallback is explicit, never silent —
 * check `isSupabaseConfigured` if a caller needs to know which mode is active.
 */
export function createRepo<K extends TableName>(table: K): Repo<TableRowMap[K]> {
  type T = TableRowMap[K];

  return {
    async list(): Promise<T[]> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as T[];
      }
      return readLocal<T>(table);
    },

    async insert(row: NewRow<T>): Promise<T> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.from(table).insert(row as never).select().single();
        if (error) throw error;
        return data as T;
      }
      const rows = await readLocal<T>(table);
      const created = {
        ...row,
        id: localId(),
        user_id: LOCAL_USER_ID,
        created_at: new Date().toISOString(),
      } as unknown as T;
      await writeLocal(table, [created, ...rows]);
      return created;
    },

    async update(id: string, patch: Partial<NewRow<T>>): Promise<T> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from(table)
          .update(patch as never)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as T;
      }
      const rows = await readLocal<T>(table);
      let updated: T | undefined;
      const next = rows.map((r) => {
        const row = r as T & { id: string };
        if (row.id === id) {
          updated = { ...row, ...patch } as T;
          return updated;
        }
        return r;
      });
      if (!updated) throw new Error(`Row ${id} not found in ${table}`);
      await writeLocal(table, next);
      return updated;
    },

    async remove(id: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        return;
      }
      const rows = await readLocal<T>(table);
      await writeLocal(
        table,
        rows.filter((r) => (r as T & { id: string }).id !== id)
      );
    },
  };
}

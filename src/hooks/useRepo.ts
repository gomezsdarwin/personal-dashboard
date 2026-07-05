import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRepo } from '../lib/db';
import type { NewRow, TableName, TableRowMap } from '../lib/types';

export type UseRepoResult<T extends { id: string; user_id: string; created_at: string }> = {
  rows: T[];
  loading: boolean;
  insert: (row: NewRow<T>) => Promise<T>;
  update: (id: string, patch: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
};

/**
 * Loads + manages one table's rows via the Repo<T> data layer, with optimistic
 * local updates and one-time fixture seeding (only fires once per table/device,
 * tracked via an AsyncStorage `pd:seeded:<table>` flag, and only when the table
 * is empty on first load).
 */
export function useRepo<K extends TableName>(
  table: K,
  seedFixtures?: NewRow<TableRowMap[K]>[]
): UseRepoResult<TableRowMap[K]> {
  type T = TableRowMap[K];
  const repoRef = useRef(createRepo(table));
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const repo = repoRef.current;
      let list = await repo.list();

      if (list.length === 0 && seedFixtures && seedFixtures.length > 0) {
        const seedKey = `pd:seeded:${table}`;
        const alreadySeeded = await AsyncStorage.getItem(seedKey);
        if (!alreadySeeded) {
          for (const fixture of seedFixtures) {
            // eslint-disable-next-line no-await-in-loop
            await repo.insert(fixture);
          }
          await AsyncStorage.setItem(seedKey, '1');
          list = await repo.list();
        }
      }

      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // seedFixtures is expected to be a stable/inline constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const insert = useCallback(
    async (row: NewRow<T>) => {
      const created = await repoRef.current.insert(row);
      setRows((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      try {
        const updated = await repoRef.current.update(id, patch);
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
        return updated;
      } catch (err) {
        const list = await repoRef.current.list();
        setRows(list);
        throw err;
      }
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    let removedRow: T | undefined;
    setRows((prev) => {
      removedRow = prev.find((r) => r.id === id);
      return prev.filter((r) => r.id !== id);
    });
    try {
      await repoRef.current.remove(id);
    } catch (err) {
      if (removedRow) {
        const restored = removedRow;
        setRows((prev) => [...prev, restored]);
      }
      throw err;
    }
  }, []);

  return { rows, loading, insert, update, remove };
}

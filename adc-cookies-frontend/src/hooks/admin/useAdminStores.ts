'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminGetStores, adminDeleteStoreStaff, type AdminStoresReport } from '@/lib/api';

/**
 * Store list with each store's staff logins. `onChanged` lets the shell re-check the Needs-attention
 * banner after a staff/store change, since unbilled-at-store orders surface there.
 */
export function useAdminStores(enabled: boolean, onChanged?: () => void) {
  const [storeReport, setStoreReport] = useState<AdminStoresReport | null>(null);
  const [staffBusy, setStaffBusy] = useState<number | null>(null);

  useEffect(() => {
    if (enabled && storeReport === null) adminGetStores().then(setStoreReport).catch(() => setStoreReport(null));
  }, [enabled, storeReport]);

  const refreshStores = useCallback(() => { adminGetStores().then(setStoreReport).catch(() => {}); }, []);

  const storeChanged = useCallback(() => { refreshStores(); onChanged?.(); }, [refreshStores, onChanged]);

  const deleteOrphanedStaff = useCallback(async (id: number) => {
    await adminDeleteStoreStaff(id);
    refreshStores();
  }, [refreshStores]);

  return { storeReport, staffBusy, setStaffBusy, refreshStores, storeChanged, deleteOrphanedStaff };
}

'use client';
import { useState, useEffect } from 'react';
import { adminGetUsers, adminUpdateUser, type AdminUser } from '@/lib/api';

/** Customers list. `enabled` gates the fetch so it still loads lazily, on first open of the tab. */
export function useAdminUsers(enabled: boolean, onError: (s: string) => void) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');
  const [savingUser, setSavingUser] = useState<number | null>(null);

  useEffect(() => {
    if (enabled && users === null) adminGetUsers().then(setUsers).catch(() => setUsers([]));
  }, [enabled, users]);

  /** Returns true only if the row was actually saved, so the caller knows whether to close the editor. */
  const saveUser = async (id: number, data: { name?: string; phone?: string }) => {
    setSavingUser(id);
    const updated = await adminUpdateUser(id, data).catch(err => { onError(String(err.message || err)); return null; });
    setSavingUser(null);
    if (!updated) return false;
    // Splice the server's own row back in — the phone it stored is normalised, so echoing what
    // was typed would show a different number from the one that was saved.
    setUsers(p => (p || []).map(u => (u.id === id ? { ...u, ...updated } : u)));
    return true;
  };

  return { users, search, setSearch, saveUser, savingUser };
}

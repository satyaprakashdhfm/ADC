'use client';
import { useState, useEffect } from 'react';
import { adminGetUsers, type AdminUser } from '@/lib/api';

/** Customers list. `enabled` gates the fetch so it still loads lazily, on first open of the tab. */
export function useAdminUsers(enabled: boolean) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (enabled && users === null) adminGetUsers().then(setUsers).catch(() => setUsers([]));
  }, [enabled, users]);

  return { users, search, setSearch };
}

'use client';
import { useState, useEffect } from 'react';
import {
  adminGetPetpoojaMapping, adminGetPetpoojaRelays,
  type PetpoojaMapping, type PetpoojaRelay,
} from '@/lib/api';

/** Petpooja POS item mapping and the relay log. */
export function useAdminPetpooja(enabled: boolean) {
  const [ppMap, setPpMap] = useState<PetpoojaMapping | null>(null);
  const [ppRelays, setPpRelays] = useState<PetpoojaRelay[] | null>(null);
  const [ppBusy, setPpBusy] = useState<string | null>(null);   // "itemId|variationId" being saved
  const [ppSearch, setPpSearch] = useState('');
  const [ppOnlyUnlinked, setPpOnlyUnlinked] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (ppMap === null) adminGetPetpoojaMapping().then(setPpMap).catch(() => setPpMap(null));
    if (ppRelays === null) adminGetPetpoojaRelays().then(setPpRelays).catch(() => setPpRelays([]));
  }, [enabled, ppMap, ppRelays]);

  return { ppMap, setPpMap, ppRelays, setPpRelays, ppBusy, setPpBusy, ppSearch, setPpSearch, ppOnlyUnlinked, setPpOnlyUnlinked };
}

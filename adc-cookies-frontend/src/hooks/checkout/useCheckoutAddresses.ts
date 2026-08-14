'use client';
import { useState, useEffect } from 'react';
import { getAddresses, addAddress, updateAddress, type Address } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import type { AddressDraft } from '@/components/ordering/ui/AddressWizard';

/**
 * The saved-address list, and which one this order goes to.
 *
 * This used to be twice the size, and most of what left was machinery for reconciling a typed
 * address against a set of coordinates: a forward geocode on save, a GPS fallback, a ranking of
 * street over PIN-centroid over device location, a rule that snapped the pin back if it drifted
 * more than twelve kilometres from its pincode, and a PIN-directory lookup to fill city and state.
 *
 * None of it is needed now. AddressWizard settles the point on a map before any field exists, and
 * reads the pincode, city and state off that point — so there is one source of truth instead of
 * three sources and a referee. The bug that motivated all of it, an address typed as Jayanagar
 * saved at coordinates in Varthur, cannot occur when the pincode is derived from the pin rather
 * than argued with.
 *
 * What is left is the part that was always this hook's job: fetch the list, pick one, save changes.
 */
export function useCheckoutAddresses() {
  const { addrId: addr, setAddrId: setAddr } = useCart();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);   // address being edited (null = adding new)
  const [savingAddr, setSavingAddr] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  // Addresses are private to the signed-in user — fetch on login, clear on logout.
  useEffect(() => {
    if (user) getAddresses().then(setAddresses).catch(() => setAddresses([]));
    else setAddresses([]);
  }, [user]);

  /* Auto-select once they load and nothing valid is selected: prefer the default, else the first,
     so someone without a default still has a valid address — otherwise the order 400s with
     "Address not found". */
  useEffect(() => {
    if (addr && addresses.some(a => a.id === addr)) return;
    const pick = addresses.find(a => a.isDefault) || addresses[0];
    if (pick) setAddr(pick.id);
  }, [addresses, addr, setAddr]);

  const openAddForm = () => { setEditId(null); setSaveErr(''); setAdding(true); };
  const editAddr = (a: Address) => { setEditId(a.id); setSaveErr(''); setAdding(true); };
  const closeAddrForm = () => { setAdding(false); setEditId(null); setSaveErr(''); };

  /**
   * Save what the wizard produced. The coordinates come with it and are already confirmed on a map,
   * so nothing here re-derives or second-guesses them.
   */
  const saveAddr = async (data: AddressDraft) => {
    setSavingAddr(true); setSaveErr('');
    try {
      if (editId != null) {
        const saved = await updateAddress(editId, data);
        setAddresses(p => p.map(a => (a.id === editId ? saved : (data.isDefault ? { ...a, isDefault: false } : a))));
        setAddr(editId);
      } else {
        const created = await addAddress(data);
        setAddresses(p => [...(data.isDefault ? p.map(a => ({ ...a, isDefault: false })) : p), created]);
        setAddr(created.id);
      }
    } catch (e) {
      // Keep the form open with what they typed. Both paths used to swallow the error and fake it
      // locally, so a failed save looked identical to a good one until the page was reloaded.
      setSavingAddr(false);
      setSaveErr(e instanceof Error ? e.message : 'Could not save this address. Please try again.');
      return;
    }
    setSavingAddr(false);
    closeAddrForm();
  };

  const chosen = addresses.find(a => a.id === addr);

  return {
    addresses, chosen, adding, editId, savingAddr, saveErr,
    openAddForm, editAddr, closeAddrForm, saveAddr,
  };
}

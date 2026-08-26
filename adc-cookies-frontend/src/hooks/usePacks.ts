'use client';
import { useCallback, useEffect, useState } from 'react';
import { getPacks, type PackConfig, type PackPick } from '@/lib/api';
import { useCart } from '@/context/CartContext';

/*
 * Build-your-own packs, shared by every place a product can be added to the cart.
 *
 * Two things live here rather than in each of those places: knowing WHICH products are packs (so
 * "Add" can open the picker instead of adding straight away), and turning a finished set of picks
 * into a cart line. Both are needed by the home menu and by the checkout upsell rail, and a second
 * copy of "how a pack becomes a cart line" is how the two end up disagreeing about what is in the
 * box.
 *
 * Fetched once, and a failure is silent on purpose: if the config cannot be loaded the pack behaves
 * like an ordinary product rather than the menu losing a card. The server re-checks the picks at
 * order time either way, so the worst case is a box that has to be built on the next page load —
 * not one that gets through unbuilt.
 */
export function usePacks() {
  const [packs, setPacks] = useState<PackConfig[]>([]);
  const { cart, setQty } = useCart();

  useEffect(() => { getPacks().then(setPacks).catch(() => {}); }, []);

  const packFor = useCallback(
    (productId: number) => packs.find(p => p.productId === productId) || null,
    [packs],
  );

  /*
   * Add a built pack to the cart.
   *
   * The cart key carries the picks, sorted, so two boxes filled differently stay two lines while
   * two filled identically merge and go up in quantity — which is what "two of the same box" means.
   * The cart is keyed by string id and that is the only place this distinction can live: keying on
   * the product id alone would collapse the second box into the first and throw its contents away.
   */
  const addPack = useCallback((pack: PackConfig, picks: PackPick[], summary: string[], img?: string) => {
    const signature = [...picks].map(p => `${p.productId}x${p.quantity}`).sort().join('_');
    const key = `pack-${pack.productId}-${signature}`;
    const current = cart[key]?.qty || 0;
    setQty(key, current + 1, pack.name, pack.price, img, summary, undefined,
      { productId: pack.productId, packPicks: picks });
    return key;
  }, [cart, setQty]);

  return { packs, packFor, addPack };
}

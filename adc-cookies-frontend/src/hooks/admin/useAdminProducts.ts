'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  adminGetProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  type Product, type ProductInput,
} from '@/lib/api';

/*
 * What the editor is working on.
 *
 * `data` is what gets saved. `images` is the row's signed display URLs, carried along only so the
 * form can show the photos that already exist — it is deliberately NOT part of `data`, because those
 * URLs expire and must never be written back. See Product.imageRefs in lib/api.ts.
 */
export interface ProductEditing { id?: number; data: ProductInput; images?: string | null }

export const EMPTY_PRODUCT: ProductInput = { name: '', category: 'COOKIES', description: '', price: 0, menuGroup: '', tag: '', featured: false, isAvailable: true, imageRefs: [], intracityAvailable: true, intracityUnavailableReason: '', intercityAvailable: true, intercityUnavailableReason: '', restrictCities: '' };

/**
 * Products list and its editor. `refreshProducts` is exported rather than kept private because the
 * Petpooja tab creates products too and must refresh through the same path, not its own fetch.
 */
export function useAdminProducts(enabled: boolean, onError: (s: string) => void, onChanged?: () => void) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [editing, setEditing] = useState<ProductEditing | null>(null);

  useEffect(() => {
    if (enabled && products === null) adminGetProducts().then(setProducts).catch(() => setProducts([]));
  }, [enabled, products]);

  const refreshProducts = useCallback(() => {
    adminGetProducts().then(setProducts).catch(() => {});
    onChanged?.();
  }, [onChanged]);

  const saveProduct = async () => {
    if (!editing) return;
    try {
      if (editing.id) await adminUpdateProduct(editing.id, editing.data);
      else await adminCreateProduct(editing.data);
      setEditing(null); refreshProducts();
    } catch (e: unknown) { onError(e instanceof Error ? e.message : 'Save failed'); }
  };

  const removeProduct = async (id: number) => {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await adminDeleteProduct(id).catch(() => {});
    refreshProducts();
  };

  return {
    products, search, setSearch, category, setCategory, availability, setAvailability,
    editing, setEditing, saveProduct, removeProduct, refreshProducts,
  };
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  adminGetProducts, adminCreateProduct, adminUpdateProduct, adminDeleteProduct,
  type Product, type ProductInput,
} from '@/lib/api';

export const EMPTY_PRODUCT: ProductInput = { name: '', category: 'COOKIES', description: '', price: 0, stockQuantity: 0, menuGroup: '', tag: '', featured: false, isAvailable: true, images: '', sameDayOnly: false, restrictCities: '' };

/**
 * Products list and its editor. `refreshProducts` is exported rather than kept private because the
 * Petpooja tab creates products too and must refresh through the same path, not its own fetch.
 */
export function useAdminProducts(enabled: boolean, onError: (s: string) => void, onChanged?: () => void) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState('');
  const [editing, setEditing] = useState<{ id?: number; data: ProductInput } | null>(null);

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

'use client';
import { useState, useEffect } from 'react';
import { getProducts, type Product } from '@/lib/api';

/**
 * Products for the checkout "Goes great with" row. Shows the cached list instantly (the same cache
 * the storefront fills) so the row doesn't pop in late, then refreshes in the background.
 */
export function useUpsellCatalog() {
  const [catalog, setCatalog] = useState<Product[]>([]);

  useEffect(() => {
    try { const c = localStorage.getItem('adc_products_cache'); if (c) { const arr = JSON.parse(c); if (Array.isArray(arr) && arr.length) setCatalog(arr); } } catch { /* ignore */ }
    getProducts().then(ps => { if (ps?.length) setCatalog(ps); }).catch(() => {});
  }, []);

  return catalog;
}

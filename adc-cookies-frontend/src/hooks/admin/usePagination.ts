'use client';
import { useState } from 'react';

export const PAGE_SIZE = 12; // rows per page in admin list tables

/** Pagination for the admin list tables: one page number per list key. */
export function usePagination() {
  const [pages, setPages] = useState<Record<string, number>>({});
  const pageOf = (k: string) => pages[k] || 1;
  const setPageOf = (k: string, n: number) => setPages(p => ({ ...p, [k]: n }));
  function paginate<T>(arr: T[], key: string): T[] {
    const page = pageOf(key);
    return arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }
  return { pageOf, setPageOf, paginate };
}

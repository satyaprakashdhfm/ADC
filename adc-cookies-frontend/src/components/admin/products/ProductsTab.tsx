'use client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { type Product, type ProductInput } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { EMPTY_PRODUCT } from '@/hooks/admin/useAdminProducts';
import { money } from '../shared/format';
import { td, inp, addBtn, iconBtn, Panel, Table, Empty, Field, FilterBar, Pager } from '../shared/ui';

type Editing = { id?: number; data: ProductInput };

interface Props {
  products: Product[] | null;
  search: string;
  onSearch: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  availability: string;
  onAvailability: (v: string) => void;
  setEditing: (e: Editing | null) => void;
  onRemove: (id: number) => void;
  page: number;
  onPage: (n: number) => void;
}

export default function ProductsTab({ products, search, onSearch, category, onCategory, availability, onAvailability, setEditing, onRemove, page, onPage }: Props) {
  const cats = Array.from(new Set((products || []).map(p => p.category))).sort();
  const pq = search.trim().toLowerCase();
  const list = (products || []).filter(p => {
    if (category && p.category !== category) return false;
    if (availability === 'in' && !p.isAvailable) return false;
    if (availability === 'out' && p.isAvailable) return false;
    if (!pq) return true;
    return p.name.toLowerCase().includes(pq) || (p.tag || '').toLowerCase().includes(pq);
  });
  const active = !!(category || availability);
  const clear = () => { onCategory(''); onAvailability(''); onSearch(''); onPage(1); };
  const selStyle = { ...inp, cursor: 'pointer' } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel title={`Products${products ? ` (${list.length})` : ''}`} loading={products === null} action={<button onClick={() => setEditing({ data: { ...EMPTY_PRODUCT } })} style={addBtn}><Plus size={16} /> Add product</button>}>
        <FilterBar search={search} onSearch={v => { onSearch(v); onPage(1); }} placeholder="Search product or tag…" active={active} onClear={clear}>
          <Field label="Category"><select value={category} onChange={e => { onCategory(e.target.value); onPage(1); }} style={selStyle}><option value="">All categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Availability"><select value={availability} onChange={e => { onAvailability(e.target.value); onPage(1); }} style={selStyle}><option value="">Any</option><option value="in">In stock / available</option><option value="out">Unavailable</option></select></Field>
        </FilterBar>
        <Table head={['Name', 'Category', 'Price', 'Stock', 'Tag', '']}>
          {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(p => (
            <tr key={p.id}>
              <td style={td}>
                <strong>{p.name}</strong>
                  {!p.intracityAvailable && (
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>
                      Intracity off{p.intracityUnavailableReason ? ` — ${p.intracityUnavailableReason}` : ''}
                    </div>
                  )}
                  {!p.intercityAvailable && (
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--status-error)', fontWeight: 800, marginTop: 2 }}>
                      Intercity off{p.intercityUnavailableReason ? ` — ${p.intercityUnavailableReason}` : ''}
                    </div>
                  )}
                  {p.intracityAvailable && p.restrictCities && (
                    <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
                      Intracity restricted to {p.restrictCities}
                    </div>
                  )}
              </td>
              <td style={td}>{p.category}</td>
              <td style={td}>{money(p.price)}</td>
              <td style={td}><span style={{ color: p.stockQuantity <= 10 ? 'var(--status-error)' : 'var(--text-body)', fontWeight: p.stockQuantity <= 10 ? 800 : 400 }}>{p.stockQuantity}</span></td>
              <td style={td}>{p.tag || '—'}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditing({ id: p.id, data: { name: p.name, category: p.category, description: p.description, price: p.price, stockQuantity: p.stockQuantity, images: p.images, options: p.options, isAvailable: p.isAvailable, menuGroup: p.menuGroup, tag: p.tag, featured: p.featured, intracityAvailable: p.intracityAvailable, intracityUnavailableReason: p.intracityUnavailableReason || '', intercityAvailable: p.intercityAvailable, intercityUnavailableReason: p.intercityUnavailableReason || '', restrictCities: p.restrictCities || '' } })} aria-label="Edit" style={iconBtn}><Pencil size={15} /></button>
                <button onClick={() => onRemove(p.id)} aria-label="Delete" style={{ ...iconBtn, color: 'var(--status-error)' }}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </Table>
        {products && !list.length && <Empty text={products.length ? 'No products match the filter.' : 'No products.'} />}
        <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onPage={onPage} />
      </Panel>
    </div>
  );
}

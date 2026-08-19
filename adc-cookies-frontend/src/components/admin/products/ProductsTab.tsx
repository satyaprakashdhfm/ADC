'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Plus, Pencil, Trash2, ImageOff } from 'lucide-react';
import { firstImage, type Product, type ProductInput } from '@/lib/api';
import { PAGE_SIZE } from '@/hooks/admin/usePagination';
import { EMPTY_PRODUCT, type ProductEditing } from '@/hooks/admin/useAdminProducts';
import { money } from '../shared/format';
import { td, inp, addBtn, iconBtn, Panel, Table, Badge, Empty, Field, FilterBar, Pager } from '../shared/ui';

/* The editor's starting values for an existing row. This was a single 700-character object literal
   inline in the Edit button, where a forgotten field was invisible — and forgetting one silently
   blanks that field on save.

   imageRefs, NOT images: `images` holds the signed display URLs, and sending those back would store
   links that expire in a week. See Product.imageRefs in lib/api.ts. */
const editPayload = (p: Product): ProductInput => ({
  name: p.name, category: p.category, description: p.description, price: p.price,
  imageRefs: p.imageRefs || [], options: p.options,
  isAvailable: p.isAvailable, menuGroup: p.menuGroup, tag: p.tag, featured: p.featured,
  intracityAvailable: p.intracityAvailable, intracityUnavailableReason: p.intracityUnavailableReason || '',
  intercityAvailable: p.intercityAvailable, intercityUnavailableReason: p.intercityUnavailableReason || '',
  restrictCities: p.restrictCities || '',
});

/* On/off at a glance, one chip per delivery mode. These used to be up to three stacked red
   sentences under the product name, which made every restricted row twice as tall as the others and
   buried the two flags an admin comes to this table to check. The reason still travels with the
   chip, as its tooltip.

   Labelled "Intracity" and "Intercity", the same words the editor and the store availability panel
   use. They said "Same-day" and "Parcel" here, so one pair of switches had two vocabularies and
   neither matched the form you set them in. */
function ModeChip({ label, on, reason }: { label: string; on: boolean; reason?: string | null }) {
  return (
    <span title={on ? `${label} on` : `${label} off${reason ? ` — ${reason}` : ''}`}
      style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--text-2xs)', fontWeight: 800, whiteSpace: 'nowrap',
        background: on ? 'var(--status-success-bg)' : 'var(--status-error-bg)',
        color: on ? 'var(--status-success)' : 'var(--status-error)',
      }}>
      {label} {on ? 'on' : 'off'}
    </span>
  );
}

/*
 * The product's photo, as a photo.
 *
 * This column used to print the raw contents of the images column — '/assets/products/matcha.jpg',
 * or a JSON array of them — which is the one thing an admin cannot check at a glance. `unoptimized`
 * because an uploaded file arrives as a signed URL on a Supabase host next/image has no loader for,
 * and one that changes weekly has nothing worth caching.
 */
function Thumb({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false);
  const src = firstImage(product.images, '');
  if (!src || broken) {
    return (
      <div title={src ? 'This image could not be loaded' : 'No photo yet'}
        style={{ width: 44, height: 44, borderRadius: 9, background: 'var(--surface-sunken)', display: 'grid', placeItems: 'center', color: 'var(--text-subtle)' }}>
        <ImageOff size={16} />
      </div>
    );
  }
  return (
    <Image src={src} alt="" width={44} height={44} unoptimized onError={() => setBroken(true)}
      style={{ width: 44, height: 44, borderRadius: 9, objectFit: 'cover', background: 'var(--surface-sunken)' }} />
  );
}

interface Props {
  products: Product[] | null;
  search: string;
  onSearch: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  availability: string;
  onAvailability: (v: string) => void;
  setEditing: (e: ProductEditing | null) => void;
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
          {/* "In stock" is gone from these options along with stock tracking itself — a product is
              available or it is not. */}
          <Field label="Availability"><select value={availability} onChange={e => { onAvailability(e.target.value); onPage(1); }} style={selStyle}><option value="">Any</option><option value="in">Available</option><option value="out">Unavailable</option></select></Field>
        </FilterBar>
        <Table head={['', 'Name', 'Category', 'Available', 'Delivery', 'Price', 'Tag', '']}>
          {list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(p => (
            <tr key={p.id}>
              <td style={{ ...td, width: 44, paddingRight: 0 }}><Thumb product={p} /></td>
              <td style={td}><strong>{p.name}</strong>{p.featured && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--brand-secondary)', fontWeight: 800, marginTop: 2 }}>Featured</div>}</td>
              <td style={td}>{p.category}</td>
              <td style={td}><Badge text={p.isAvailable ? 'Available' : 'Unavailable'} ok={p.isAvailable} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <ModeChip label="Intracity" on={p.intracityAvailable} reason={p.intracityUnavailableReason} />
                  <ModeChip label="Intercity" on={p.intercityAvailable} reason={p.intercityUnavailableReason} />
                </div>
                {p.intracityAvailable && p.restrictCities && (
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', fontWeight: 700, marginTop: 3 }}>
                    Intracity: {p.restrictCities} only
                  </div>
                )}
              </td>
              <td style={td}>{money(p.price)}</td>
              <td style={td}>{p.tag || '—'}</td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                {/* `images` travels alongside so the editor can show the photos it already has;
                    `data` carries only the refs it is allowed to save. */}
                <button onClick={() => setEditing({ id: p.id, data: editPayload(p), images: p.images })} aria-label="Edit" style={iconBtn}><Pencil size={15} /></button>
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

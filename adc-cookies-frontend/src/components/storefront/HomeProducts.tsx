'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Minus, ArrowRight, Cookie, Briefcase, IceCreamBowl, IceCreamCone, Flame, Milk, Coffee, CupSoda, CakeSlice, Boxes, Cylinder } from 'lucide-react';
import { getProducts, firstImage, type Product } from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { PRODUCT_CATEGORIES, menuRank, type ProductCategory } from '@/lib/categories';

/* The registry says what the sections ARE and what order they come in; this says what each one
   looks like. Icons live here rather than in lib/categories.ts so that file stays free of React
   and can be imported by plain logic — the admin dropdown and the checkout ladder both need the
   category list and neither of them wants an icon. */
const CATEGORY_ICONS: Record<ProductCategory, React.ComponentType<{ size?: number }>> = {
  COOKIES: Cookie,
  HUG_IN_A_DIP: IceCreamBowl,
  SKILLET: Flame,
  TINS: Cylinder,
  SUNDAE: IceCreamCone,
  SHAKES: Milk,
  HOT_DRINKS: Coffee,
  COLD_COFFEE: CupSoda,
  CAKES: CakeSlice,
  COMBOS: Boxes,
};

const eyebrow: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(14px,1.8vw,22px)' };

// Second "hover" shot per cookie — a styled placeholder that crossfades in when you hover the card
// (Dohful-style two-image swap). The filenames match the product names exactly, so the lookup is a
// direct name → file map; cookies without a placeholder simply keep their single image.
const HOVER_IMAGE_NAMES = new Set([
  'ADC Special Cookie', 'Biscoff Filled Cookie', 'Chocolate Chip Cookie', 'Double Choco Chip Cookie',
  'Matcha Cookie', 'Nutella Filled Cookie', 'Red Velvet Filled Cookie', 'Ragi Cookie (Gluten-Free)',
]);
const hoverImageFor = (name: string): string | null =>
  HOVER_IMAGE_NAMES.has(name) ? encodeURI(`/assets/product_placeholders/${name}.PNG`) : null;

function ProductCard({ p }: { p: Product }) {
  const { cart, setQty } = useCart();
  const id = String(p.id);
  const qty = cart[id]?.qty || 0;
  const img = firstImage(p.images);
  const hoverImg = hoverImageFor(p.name);
  const price = Number(p.price);
  const change = (n: number) => setQty(id, Math.max(0, n), p.name, price, img);

  return (
    <div style={{ background: 'var(--vanilla)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
      <div className="prod-media" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-sunken)' }}>
        {img && <Image src={img} alt={p.name} fill sizes="(max-width:760px) 50vw, 280px" style={{ objectFit: 'cover' }} />}
        {hoverImg && <Image src={hoverImg} alt="" fill sizes="(max-width:760px) 50vw, 280px" className="prod-media__hover" style={{ objectFit: 'cover' }} />}
      </div>
      <div style={{ padding: 'clamp(12px,1.4vw,16px)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <h3 style={{ font: 'var(--weight-extra) var(--text-base)/1.2 var(--font-display)', color: 'var(--text-strong)', margin: 0 }}>{p.name}</h3>
        {p.description && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0, overflowWrap: 'anywhere' }}>{p.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          {/* "Rs" rather than the ₹ glyph, and sized to stand level with the Add button beside it.
              At --text-base the price was the quietest thing in a row whose other half is a filled
              orange pill, which is the wrong way round: the price is the decision, the button is
              only how you act on it. */}
          <span style={{ fontWeight: 900, color: 'var(--text-strong)', font: '900 var(--text-lg)/1 var(--font-display)', letterSpacing: '-.01em' }}>Rs {price}</span>
          {qty === 0 ? (
            <button onClick={() => change(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', boxShadow: 'var(--shadow-brand)' }}>
              <Plus size={15} /> Add
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gradient-warm)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
              <button onClick={() => change(qty - 1)} aria-label="Remove one" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--white-16)', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Minus size={15} /></button>
              <span style={{ minWidth: 18, textAlign: 'center', color: 'var(--white)', fontWeight: 800, fontSize: 'var(--text-sm)' }}>{qty}</span>
              <button onClick={() => change(qty + 1)} aria-label="Add one" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--white-16)', color: 'var(--white)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Plus size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SubHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 'clamp(26px,3.5vw,44px) 0 16px' }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--amber-50)', color: 'var(--brand-secondary)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
      <h3 style={{ font: '900 clamp(1.4rem,1.1rem + 1.2vw,2rem)/1 var(--font-display)', color: 'var(--text-strong)', margin: 0, letterSpacing: '-.02em' }}>{title}</h3>
    </div>
  );
}

export default function HomeProducts() {
  const router = useRouter();
  // No LocationContext here any more — the menu no longer varies by where the shopper is.
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const deepLinkScrolled = useRef(false); // scroll a ?q= deep-link to its section only once, after products load

  useEffect(() => {
    // Show cached products instantly on reload (no waiting for the API), then refresh in the background.
    try { const c = localStorage.getItem('adc_products_cache'); if (c) { const arr = JSON.parse(c); if (Array.isArray(arr) && arr.length) setProducts(arr); } } catch { /* ignore */ }
    getProducts().then(p => {
      if (p?.length) { setProducts(p); try { localStorage.setItem('adc_products_cache', JSON.stringify(p)); } catch { /* ignore */ } }
    }).catch(() => {});
  }, []);

  // Deep-link from nav search / product menus (/order?q= → redirects here): remember the query (it
  // floats a matching cookie to the top) and strip ?q= from the address bar so the home URL stays clean.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('q');
    if (!query) return;
    setQ(query);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  }, []);

  // Once products load, scroll a deep-linked query to the right place: a TIN query (or a tin name)
  // jumps to the Cookie Tins section; anything else scrolls to the (floated) cookies.
  useEffect(() => {
    if (!q || deepLinkScrolled.current || products.length === 0) return;
    deepLinkScrolled.current = true;
    // Scroll to whichever section actually holds the match, rather than the old two-way "is it a
    // tin, else cookies" guess that could only ever land on one of two places.
    const term = q.trim().toLowerCase();
    const hit = products.find(p => p.name.toLowerCase().includes(term));
    const id = PRODUCT_CATEGORIES.find(c => c.code === hit?.category)?.anchor || 'products';
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    return () => clearTimeout(t);
  }, [q, products]);

  // Nav category deep-link (/order?cat=cookies|tins|corporate → redirects here): scroll to that section.
  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('cat');
    if (!cat) return;
    const slug = cat.trim().toLowerCase();
    const hit = PRODUCT_CATEGORIES.find(c => c.code.toLowerCase() === slug || c.anchor === `${slug}-section`);
    const id = slug === 'corporate' ? 'corporate-section' : hit?.anchor || 'products';
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
    return () => clearTimeout(t);
  }, []);

  // Selecting/searching a product floats it to the top but KEEPS every other cookie visible.
  const ql = q.trim().toLowerCase();
  /* One section per registry category, in menu order, carrying whatever products exist in it —
     an empty category draws nothing at all.

     Note what is deliberately NOT filtered here any more. Products used to be dropped from the
     menu when the shopper's coarse location made them ineligible, so a visitor outside Bengaluru
     was never shown Red Velvet at all. The whole menu is now shown to everyone, and the "not to
     THIS address" conversation happens once, at checkout, against a real address — where the line
     is blacked out with the reason written on it. Hiding an item early meant a shopper couldn't
     even learn it exists, which is a worse answer than being told where it can go.

     The old `!/sundae/i` exclusion is gone with it: sundaes were being kept out of the cookies
     grid by name because there was no category to put them in. Now there is one. */
  const sections = PRODUCT_CATEGORIES
    .map(c => ({
      ...c,
      items: products
        .filter(p => p.category === c.code && p.isAvailable)
        // Menu order first; a search then floats whatever matched to the top of it, so typing a
        // name still finds it without permanently reshuffling the shelf underneath.
        .sort((a, b) => menuRank(a.name) - menuRank(b.name))
        .sort((a, b) => (ql ? (a.name.toLowerCase().includes(ql) ? 0 : 1) - (b.name.toLowerCase().includes(ql) ? 0 : 1) : 0)),
    }))
    .filter(s => s.items.length > 0);

  return (
    <section id="products" style={{ background: 'var(--gold)', padding: 'clamp(40px,6vw,80px) 0', borderTop: '1px solid var(--border-default)' }}>
      <div style={{ maxWidth: 1680, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(6px,1.5vw,14px)' }}>
          <p style={eyebrow}>Order online</p>
          <h2 style={{ font: '900 clamp(1.7rem,1.2rem + 2vw,2.6rem)/1 var(--font-display)', letterSpacing: '-.02em', color: 'var(--text-strong)', margin: '0 0 10px' }}>Fresh from the oven</h2>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-body)', maxWidth: 520, margin: '0 auto' }}>Pick your favourites and add them to the cart — checkout in a tap.</p>
        </div>

        {sections.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Loading fresh cookies…</p>
        ) : sections.map(s => {
          const Icon = CATEGORY_ICONS[s.code];
          return (
            // Cookies anchors to the <section> wrapper's own id, so it must not re-declare it —
            // two elements with id="products" and the deep-link scroll lands on whichever the
            // browser finds first.
            <div key={s.code} id={s.anchor === 'products' ? undefined : s.anchor} style={{ scrollMarginTop: 90 }}>
              <SubHead icon={<Icon size={19} />} title={s.label} />
              <div className="home-products-grid" style={gridStyle}>
                {s.items.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            </div>
          );
        })}

        {/* Corporate & bulk gifting — last, as a wide card */}
        {/* The gift boxes themselves, behind the words. This was a flat dark-brown panel — the one
            block on the page selling a product with nothing to look at, on a page that is otherwise
            all photographs. The scrim is in the class (globals.css) rather than here, because it has
            to change direction once the card wraps on a phone, and an inline style cannot. */}
        <button
          id="corporate-section"
          className="corp-cta"
          onClick={() => router.push('/corporate')}
          style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', marginTop: 'clamp(28px,4vw,52px)', borderRadius: 'var(--radius-card)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', color: 'var(--cream-100)', padding: 'clamp(22px,3vw,36px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260, flex: '1 1 320px' }}>
            <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--white-16)', color: 'var(--white)', display: 'grid', placeItems: 'center', flex: 'none' }}><Briefcase size={22} /></span>
            <div>
              <h3 style={{ font: '900 clamp(1.3rem,1rem + 1.2vw,1.9rem)/1.1 var(--font-display)', color: 'var(--white)', margin: '0 0 4px', letterSpacing: '-.02em' }}>Corporate &amp; Bulk Gifting</h3>
              <p style={{ color: 'var(--cream-100-72)', margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5, maxWidth: 460 }}>Cookies for teams, clients &amp; celebrations — branded boxes, bulk pricing and coordinated delivery.</p>
            </div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 'var(--radius-pill)', background: 'var(--gradient-warm)', color: 'var(--white)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'var(--text-sm)', flex: 'none', boxShadow: 'var(--shadow-brand)' }}>Enquire / Order in bulk <ArrowRight size={16} /></span>
        </button>
      </div>


    </section>
  );
}

const REVIEWS = [
  { q: 'The Biscoff filled is unreal — gooey, warm, perfect. My weekly ritual now.', a: 'Ananya R.', city: 'Bengaluru' },
  { q: 'Arrived warm and smelled incredible. ADC Special is the best cookie in the city.', a: 'Karthik M.', city: 'Hyderabad' },
  { q: 'Beautiful packaging — gifted a Nutella tin and it was a total hit.', a: 'Sneha P.', city: 'Mumbai' },
];

/** Home page customer reviews — dark band matching the footer. */
export default function Reviews() {
  return (
    <section style={{ padding: 'clamp(36px,5vw,60px) 0', background: 'var(--surface-inverse)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 6px' }}>Customer Love</p>
        <h2 style={{ font: 'var(--weight-extra) clamp(1.4rem,1.1rem + 1.4vw,2rem)/1.05 var(--font-display)', color: '#fff', margin: '0 0 28px', letterSpacing: '-.02em' }}>People can&apos;t stop</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24 }}>
          {REVIEWS.map((rv, i) => (
            <div key={i}>
              <div aria-hidden style={{ color: 'var(--amber-500)', fontSize: 15, letterSpacing: 3, marginBottom: 10 }}>★★★★★</div>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--cream-100)', lineHeight: 1.55, margin: '0 0 14px', fontWeight: 500 }}>&ldquo;{rv.q}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 'var(--text-sm)' }}>{rv.a[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: 'var(--text-sm)' }}>{rv.a}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,248,241,.55)' }}>{rv.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

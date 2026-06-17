const REVIEWS = [
  { q: 'The Biscoff filled is unreal — gooey, warm, perfect. My weekly ritual now.', a: 'Ananya R.', city: 'Bengaluru' },
  { q: 'Arrived warm and smelled incredible. ADC Special is the best cookie in the city.', a: 'Karthik M.', city: 'Hyderabad' },
  { q: 'Beautiful packaging — gifted a Nutella tin and it was a total hit.', a: 'Sneha P.', city: 'Mumbai' },
];

/** Home page customer reviews — dark band matching the footer. */
export default function Reviews() {
  return (
    <section style={{ padding: 'clamp(56px,8vw,88px) 0', background: 'var(--surface-inverse)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 var(--gutter)' }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--brand-secondary)', margin: '0 0 8px' }}>Customer Love</p>
        <h2 style={{ font: 'var(--weight-extra) var(--text-h1)/1 var(--font-display)', color: '#fff', margin: '0 0 48px', letterSpacing: '-.025em' }}>People can&apos;t stop</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40 }}>
          {REVIEWS.map((rv, i) => (
            <div key={i}>
              <div aria-hidden style={{ color: 'var(--amber-500)', fontSize: 18, letterSpacing: 4, marginBottom: 16 }}>★★★★★</div>
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--cream-100)', lineHeight: 1.65, margin: '0 0 20px', fontWeight: 500 }}>&ldquo;{rv.q}&rdquo;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient-warm)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>{rv.a[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{rv.a}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,248,241,.55)' }}>{rv.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';
import { Radio } from 'lucide-react';
import type { AdminTrafficLive } from '@/lib/api';
import { Empty } from '../shared/ui';
import { BarRows } from '../overview/OverviewCharts';
import { Section } from './TrafficParts';

/** Who is on the site in the last 30 minutes. Not tied to the period — it is always "now". */
export default function LiveNow({ live }: { live: AdminTrafficLive | null }) {
  const people = live?.visitors ?? 0;
  return (
    <Section title="On the site right now" hint="People with the site open in the last 30 minutes, from Google Analytics. Updates every minute.">
      {!live ? <Empty text="Loading…" />
        : !live.connected ? <Empty text="Shows once Google Analytics is connected." />
        : live.error ? <Empty text={`Could not load: ${live.error}`} />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20, alignItems: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: people ? 'var(--status-success-bg)' : 'var(--surface-sunken)', color: people ? 'var(--status-success)' : 'var(--text-subtle)', display: 'grid', placeItems: 'center' }}><Radio size={20} /></span>
              <div>
                <div style={{ font: 'var(--weight-extra) var(--text-h2)/1 var(--font-display)', color: 'var(--text-strong)' }}>{people}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>{people === 1 ? 'person' : 'people'} on the site</div>
              </div>
            </div>
            {live.pages.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Looking at</div>
                <BarRows color="var(--google-green)" items={live.pages.map(p => ({ label: p.label, value: p.visitors, sub: String(p.visitors) }))} />
              </div>
            )}
            {live.devices.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>On a</div>
                <BarRows color="var(--google-blue)" items={live.devices.map(d => ({ label: d.label, value: d.visitors, sub: String(d.visitors) }))} />
              </div>
            )}
          </div>
        )}
    </Section>
  );
}

'use client';
import { Plus, X } from 'lucide-react';
import { type HeroBannerRefs, type HeroBannerUrls, type HeroSizes } from '@/lib/api';
import { inp, addBtn, iconBtn, Panel } from '../shared/ui';
import HeroBannerPanel from './HeroBannerPanel';

/**
 * What the storefront says, as opposed to what it sells.
 *
 * These settings used to sit under Products, wedged between the catalogue and the delivery fee,
 * which meant the only way to reword the site's top strip was through a screen about cookies.
 * Copy is its own job and now has its own tab — this is where anything else the admin writes for
 * the storefront belongs as it arrives.
 */

interface Props {
  bannerMessages: string[];
  bannerMessagesSaved: boolean;
  changeBannerMessage: (i: number, v: string) => void;
  addBannerMessage: () => void;
  removeBannerMessage: (i: number) => void;
  saveBannerMessages: () => void;
  hero: HeroBannerRefs;
  heroUrls: HeroBannerUrls;
  heroSizes: HeroSizes;
  heroSaved: boolean;
  heroBusy: boolean;
  changeHeroImage: (which: 'desktop' | 'mobile', ref: string, url: string) => void;
  changeHeroField: (patch: Partial<Pick<HeroBannerRefs, 'href' | 'alt'>>) => void;
  saveHeroBanner: () => void;
}

export default function CustomizeTab({
  bannerMessages, bannerMessagesSaved, changeBannerMessage, addBannerMessage, removeBannerMessage, saveBannerMessages,
  hero, heroUrls, heroSizes, heroSaved, heroBusy, changeHeroImage, changeHeroField, saveHeroBanner,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* The banner first: it is the biggest thing on the page it controls. */}
      <HeroBannerPanel
        hero={hero} urls={heroUrls} sizes={heroSizes} saved={heroSaved} busy={heroBusy}
        onImage={changeHeroImage} onField={changeHeroField} onSave={saveHeroBanner}
      />

      <Panel title="Top banner messages">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 4px' }}>
          The lines that rotate in the thin strip across the top of the home page, one every four
          seconds, in this order. Every line is listed here, however many there are — edit any of
          them, reorder them by editing the text, or add your own: an offer, a holiday notice, a new
          flavour.
        </p>
        <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', margin: '0 0 14px' }}>
          If you mention a coupon code, make sure it is a real one that works at checkout. Keep at
          least one message — the strip&apos;s height is part of the page layout, so it can never be
          empty. Up to twelve, 160 characters each.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {bannerMessages.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 'none', width: 20, textAlign: 'right', color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', fontWeight: 800 }}>{idx + 1}</span>
              <input
                value={m}
                onChange={e => changeBannerMessage(idx, e.target.value)}
                placeholder="e.g. Get 5% off with code SAVE5"
                style={{ ...inp, flex: '1 1 320px' }}
              />
              <button
                onClick={() => removeBannerMessage(idx)}
                disabled={bannerMessages.length <= 1}
                title={bannerMessages.length <= 1 ? 'Keep at least one message' : 'Remove this message'}
                style={{ ...iconBtn, opacity: bannerMessages.length <= 1 ? 0.4 : 1, cursor: bannerMessages.length <= 1 ? 'not-allowed' : 'pointer' }}
                aria-label="Remove message"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={addBannerMessage} style={{ ...iconBtn, width: 'auto', padding: '0 14px', height: 40, fontSize: 'var(--text-xs)', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Add a message
          </button>
          <button onClick={saveBannerMessages} style={addBtn}>{bannerMessagesSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </Panel>
    </div>
  );
}

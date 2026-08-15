'use client';
import { Plus, X } from 'lucide-react';
import { inp, addBtn, iconBtn, Panel } from '../shared/ui';

interface Props {
  bannerMessages: string[];
  bannerMessagesSaved: boolean;
  changeBannerMessage: (i: number, v: string) => void;
  addBannerMessage: () => void;
  removeBannerMessage: (i: number) => void;
  saveBannerMessages: () => void;
  orderingPaused: string;
  orderingPausedSaved: boolean;
  changeOrderingPaused: (v: string) => void;
  saveOrderingPaused: () => void;
  deliveryFeeOutstation: string;
  deliveryFeeSaved: boolean;
  changeDeliveryFeeOutstation: (v: string) => void;
  saveDeliveryFeeOutstation: () => void;
}

export default function SiteSettingsPanels({
  bannerMessages, bannerMessagesSaved, changeBannerMessage, addBannerMessage, removeBannerMessage, saveBannerMessages,
  orderingPaused, orderingPausedSaved, changeOrderingPaused, saveOrderingPaused,
  deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
}: Props) {
  return (
    <>
      <Panel title="Top banner messages">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 4px' }}>
          The lines that rotate in the thin strip at the very top of every page, one every four
          seconds, in this order. Edit any of them, and add your own — an offer, a holiday notice,
          a new flavour.
        </p>
        <p style={{ color: 'var(--text-subtle)', fontSize: 'var(--text-xs)', margin: '0 0 14px' }}>
          If you mention a coupon code, make sure it is a real one that works at checkout. Keep at
          least one message — the strip is always part of the page.
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

      {/* The one switch that decides whether the site can take money.
          The message IS the switch: type one and ordering stops with that sentence shown at
          checkout; clear it and the site is live. One value, so it cannot be paused with nothing
          to say, or go live still carrying last week's notice. Enforced on the server too — a
          pause that only lives in the browser is a suggestion. */}
      <Panel title={orderingPaused.trim() ? '⛔ Online ordering is PAUSED' : '✅ Online ordering is LIVE'}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
          Type a message to pause ordering — customers browse and build a basket as normal, then see
          this instead of the payment step, with WhatsApp and call buttons. Clear the box and save to
          go live.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={orderingPaused}
            onChange={(e) => changeOrderingPaused(e.target.value)}
            placeholder="e.g. Online ordering opens tomorrow — come see us at the stall today!"
            style={{ ...inp, flex: '1 1 340px' }}
          />
          <button onClick={saveOrderingPaused} style={addBtn}>{orderingPausedSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </Panel>

      <Panel title="Delivery fee — outstation">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>
          What a customer pays for outstation (Delhivery) delivery. Same-day intracity is never set here —
          that&apos;s charged exactly what Shiprocket quotes for each address, live at checkout.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: 'var(--text-strong)' }}>₹</span>
          <input
            type="number" min="0" step="1"
            value={deliveryFeeOutstation}
            onChange={e => changeDeliveryFeeOutstation(e.target.value)}
            style={{ ...inp, width: 120 }}
          />
          <button onClick={saveDeliveryFeeOutstation} style={addBtn}>{deliveryFeeSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </Panel>
    </>
  );
}

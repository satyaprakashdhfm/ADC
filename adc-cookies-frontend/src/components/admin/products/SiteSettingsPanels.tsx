'use client';
import { type Product } from '@/lib/api';
import { inp, addBtn, Panel } from '../shared/ui';

interface Props {
  products: Product[] | null;
  promoProductId: number | null;
  savePromoProduct: (id: number | null) => void;
  headerOffer: string;
  headerOfferSaved: boolean;
  changeHeaderOffer: (v: string) => void;
  saveHeaderOffer: () => void;
  stallInfo: string;
  stallInfoSaved: boolean;
  changeStallInfo: (v: string) => void;
  saveStallInfo: () => void;
  deliveryFeeOutstation: string;
  deliveryFeeSaved: boolean;
  changeDeliveryFeeOutstation: (v: string) => void;
  saveDeliveryFeeOutstation: () => void;
}

export default function SiteSettingsPanels({
  products, promoProductId, savePromoProduct,
  headerOffer, headerOfferSaved, changeHeaderOffer, saveHeaderOffer,
  stallInfo, stallInfoSaved, changeStallInfo, saveStallInfo,
  deliveryFeeOutstation, deliveryFeeSaved, changeDeliveryFeeOutstation, saveDeliveryFeeOutstation,
}: Props) {
  return (
    <>
      <Panel title="Homepage promo popup">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Pick the product featured in the popup shown to new visitors — its photo, name and description are used, and the button opens that product. Leave as Default for the generic offer.</p>
        <select
          value={promoProductId ?? ''}
          onChange={e => savePromoProduct(e.target.value ? Number(e.target.value) : null)}
          style={{ ...inp, width: 'auto', minWidth: 260, cursor: 'pointer' }}
        >
          <option value="">Default (no specific product)</option>
          {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Panel>

      <Panel title="Header banner offer">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Free text shown in the rotating banner at the very top of every page. Only put a real, currently-active coupon code here — leave blank to hide this line entirely (the veg/login lines keep rotating either way).</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={headerOffer}
            onChange={e => changeHeaderOffer(e.target.value)}
            placeholder="e.g. Get 5% off with code SAVE5"
            style={{ ...inp, flex: '1 1 320px' }}
          />
          <button onClick={saveHeaderOffer} style={addBtn}>{headerOfferSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </Panel>

      <Panel title="Today's stall — visit us">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '0 0 12px' }}>Shown as a card on the homepage (right under the hero). Use it for a pop-up stall&apos;s location and timing — leave blank to hide the card entirely.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={stallInfo}
            onChange={e => changeStallInfo(e.target.value)}
            placeholder="e.g. Phoenix Mall, Whitefield — 11am to 8pm today"
            style={{ ...inp, flex: '1 1 320px' }}
          />
          <button onClick={saveStallInfo} style={addBtn}>{stallInfoSaved ? 'Saved ✓' : 'Save'}</button>
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

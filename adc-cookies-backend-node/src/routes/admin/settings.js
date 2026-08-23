import { Router } from 'express';
import { getOne, query } from '../../db.js';
import { ApiError } from '../../middleware.js';
import { readBannerMessages, writeBannerMessages } from '../../bannerMessages.js';
import { readHeroBanner, writeHeroBanner, resolveHeroBanner, bannerIsLive, HERO_SIZES } from '../../heroBanner.js';

const router = Router();

/* ---------- Site settings (banner messages, hero banner, ordering pause, delivery fee) ---------- */

/*
 * The hero banner goes out twice, and both are needed.
 *
 * `heroBanner` is the stored references, which is what the form sends back on save. `heroBannerUrls`
 * is the same thing resolved for display, where an uploaded image is a signed URL that expires —
 * saving those back would store a link that dies in a week. Same split, for the same reason, as a
 * product's imageRefs and images.
 */
async function settingsPayload() {
  const outstationFee = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
  const paused = await getOne("SELECT value FROM site_settings WHERE key = 'ordering_paused'");
  return {
    bannerMessages: await readBannerMessages(),
    heroBanner: await readHeroBanner(),
    // Whether it is on screen RIGHT NOW, decided by the same routine the storefront is served from.
    // Working it out again in the browser is how a panel ends up disagreeing with the site it
    // describes — the admin's clock and the server's are not the same clock.
    heroBannerLive: bannerIsLive(await readHeroBanner()),
    heroBannerUrls: await resolveHeroBanner(),
    heroSizes: HERO_SIZES,
    orderingPaused: paused?.value || null,
    // Intracity is never a flat setting — it's Shiprocket's own live per-order quote (see
    // orders.js/delivery.js). Only outstation is a single admin-set number.
    deliveryFeeOutstation: outstationFee?.value != null ? Number(outstationFee.value) : 100,
  };
}

router.get('/settings', async (_req, res) => {
  res.json(await settingsPayload());
});
router.put('/settings', async (req, res) => {
  // The ribbon's rotating lines, in order. Free text the admin controls directly, so an offer
  // line never advertises a discount that isn't a real, currently-active coupon.
  if (req.body?.bannerMessages !== undefined) {
    await writeBannerMessages(req.body.bannerMessages);
  }

  /* The hero photograph and its destination. The destination is validated in heroBanner.js down to
     the scheme — this value ends up in an href on every visitor's first screen, so 'javascript:' and
     'data:' are refused there rather than trusted because an admin typed them. */
  if (req.body?.heroBanner !== undefined) {
    await writeHeroBanner(req.body.heroBanner);
  }
  /* Ordering paused.
     Stored as the message rather than a boolean: the row existing IS the pause, and its text is
     what the customer reads. One value, so there is no way to be paused with nothing to say, or to
     leave a stale message behind after going live. Deleting the row is going live. */
  if (req.body?.orderingPaused !== undefined) {
    const text = String(req.body.orderingPaused || '').trim();
    if (!text) {
      await query("DELETE FROM site_settings WHERE key = 'ordering_paused'");
    } else {
      await query(
        `INSERT INTO site_settings (key, value) VALUES ('ordering_paused', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [text.slice(0, 300)]);
    }
  }

  // A flat, admin-set number the customer actually gets charged for outstation (Delhivery) delivery
  // — see the matching read in orders.js's order-creation charge and delivery.js's checkout quote,
  // so a change here takes effect on the very next quote/order with no redeploy.
  if (req.body?.deliveryFeeOutstation !== undefined) {
    const n = Number(req.body.deliveryFeeOutstation);
    if (!Number.isFinite(n) || n < 0) throw new ApiError('Delivery fee must be a non-negative number');
    await query(
      `INSERT INTO site_settings (key, value) VALUES ('delivery_fee_outstation', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(n)]
    );
  }
  res.json(await settingsPayload());
});

/*
 * POST /settings/hero-banner/reset — back to the ordinary hero, now.
 *
 * Turns the banner off and clears its window; it deliberately KEEPS the uploaded images. Reset gets
 * pressed when a promotion has finished, and the same artwork is usually wanted again next month —
 * throwing it away would make ending an offer cost an upload.
 *
 * Its own endpoint rather than a shape of the settings PUT, because "off" has to be unambiguous:
 * a partial save that happened to omit a field must never be able to end an offer by accident.
 */
router.post('/settings/hero-banner/reset', async (_req, res) => {
  const current = await readHeroBanner();
  await writeHeroBanner({ ...current, enabled: false, startsAt: null, endsAt: null });
  // The same full payload the save returns, so the panel refreshes from one shape either way.
  res.json(await settingsPayload());
});

export default router;

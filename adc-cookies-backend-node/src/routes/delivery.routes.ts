import { Router } from 'express';
import { getOne, getAll } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';
import { checkServiceability, expectedTat, delhiveryConfigured } from '../services/delhivery.client.js';
// Aliased: delhivery.js already exports a checkServiceability with a different signature.
// Quoting uses pickServiceableStore — the SAME routine the booking uses — so the store and rate the
// shopper is shown are the ones the order will actually be dispatched from. Quoting against a single
// fixed origin is what let checkout advertise a store we then could not collect from.
import { pickServiceableStore, shiprocketConfigured } from '../services/shiprocket.client.js';
import { nearestStore, zoneStores, activeZoneStores, orderStoresByProximity, deliveryEligible, storeByPincode, straightLineKm, isStoreActive, intercityOpen, WAREHOUSE_CODE } from '../services/store.service.js';

const router = Router();

// Shadowfax same-day delivery is paused (unresolved rider-assignment gap — see project notes).
// Intracity now runs on Shiprocket Hyperlocal — Shadowfax is retired, having never assigned a
// rider in any live test. SHIPROCKET_DISABLED is the equivalent kill switch: while true, intracity
// zones report unserviceable rather than promising a delivery we cannot make.
const SHIPROCKET_DISABLED = process.env.SHIPROCKET_DISABLED === 'true';

// Origin pincode: prefer default active warehouse, fall back to any active warehouse, then env var.
async function getOriginPin() {
  try {
    const wh = await getOne(
      'SELECT pincode FROM warehouses WHERE is_active = TRUE ORDER BY is_default DESC, id ASC LIMIT 1'
    );
    if (wh?.pincode) return wh.pincode;
  } catch {}
  return process.env.ORIGIN_PINCODE || '';
}

/*
 * GET /api/delivery/area?pincode=560001 — can we serve this pincode AT ALL, and by which mode?
 *
 * Deliberately cheap: store switches and a warehouse row, no carrier calls. /check quotes a real
 * rate and asks Shiprocket and Delhivery to do it, which is right at checkout and far too heavy for
 * a menu that renders on every visit.
 *
 * It answers the question the storefront could not previously ask. The menu knew only whether a
 * PRODUCT may travel a given way, so when nothing survived that filter it had no way to tell "this
 * address is outside our delivery area" from "still loading" — and showed a spinner that never
 * resolved. This separates the two: the area is a fact about our stores, the product list is a fact
 * about the products.
 */
router.get('/area', async (req, res) => {
  const pin = String(req.query.pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pin)) return res.json({ pincode: pin, mode: null, open: false, reason: 'invalid_pincode' });

  const zone = zoneStores(pin);
  if (zone.length) {
    const open = await activeZoneStores(pin);
    return res.json({
      pincode: pin, mode: 'intracity', open: open.length > 0,
      city: zone![0]!.city,
      reason: open.length ? null : 'stores_closed',
      message: open.length ? null
        : `Same-day delivery around ${zone![0]!.city} is paused right now. Please try again shortly.`,
    });
  }

  const open = await intercityOpen();
  return res.json({
    pincode: pin, mode: 'intercity', open, city: null,
    reason: open ? null : 'intercity_closed',
    message: open ? null
      : 'We are not shipping outside our delivery cities at the moment. You can still browse the menu — check back soon.',
  });
});

// GET /api/delivery/serviceability?pincode=560001
router.get('/serviceability', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delivery checks are not configured yet.', 503);
  res.json(await checkServiceability(req.query.pincode));
});

// GET /api/delivery/tat?destination=560001[&origin=500034&mot=S]
router.get('/tat', async (req, res) => {
  if (!delhiveryConfigured()) throw new ApiError('Delivery checks are not configured yet.', 503);
  const origin = req.query.origin || (await getOriginPin());
  if (!origin) return res.json({ ok: false, reason: 'origin_not_set' });
  res.json(await expectedTat({ originPin: origin, destinationPin: String(req.query.destination ?? ''), mot: String(req.query.mot || 'S') }));
});

// GET /api/delivery/check?pincode=560001
// Combined serviceability + TAT — used by checkout to show delivery info in one call.
router.get('/check', async (req, res) => {
  const pin = String(req.query.pincode || '').replace(/\D/g, '');
  // Optional — when the shopper has picked a saved address we can quote the real hyperlocal rate.
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ?? req.query.long ? Number(req.query.lng ?? req.query.long) : null;
  console.log(`[DELIVERY] HIT /api/delivery/check | pincode=${pin || req.query.pincode || 'MISSING'}${lat && lng ? ` | coords=${lat},${lng}` : ''}`);
  if (!/^\d{6}$/.test(pin)) return res.json({ serviceable: false, reason: 'invalid_pincode' });

  /*
   * Per-product delivery-mode eligibility for THIS pincode — independent of whether the
   * destination itself is serviceable at all (a Bengaluru pincode is serviceable in general even
   * though Red Velvet is fine there and a Chennai one is not). Computed once and merged into
   * whichever branch below actually responds, via the res.json wrap just below, so checkout can
   * cross-reference cart contents against `sameDayRestrictions` and show the admin-written reason
   * on the exact line item — this is the "second round" check, precise (real pincode-zone match),
   * distinct from the coarse nearest-store hint the catalog page uses before an address exists.
   * Same rule as order-creation (deliveryEligible), so the two can never disagree.
   */
  const restrictedProducts = await getAll(
    `SELECT id, name, intracity_available, intracity_unavailable_reason, intercity_available, intercity_unavailable_reason, restrict_cities
       FROM products
      WHERE is_available = TRUE AND (intracity_available = FALSE OR intercity_available = FALSE OR restrict_cities IS NOT NULL)`
  ).catch(() => []);
  const isIntracityPin = zoneStores(pin).length > 0;
  const sameDayRestrictions = restrictedProducts.map((p) => {
    const eligible = deliveryEligible(pin, p);
    return {
      productId: p.id, name: p.name, eligible,
      reason: eligible ? null : ((isIntracityPin ? p.intracity_unavailable_reason : p.intercity_unavailable_reason)
        || 'Not available for delivery to this address.'),
    };
  });
  const _json = res.json.bind(res);
  res.json = (body) => _json({ ...body, sameDayRestrictions });

  // Delhivery pan-India quote — used both for out-of-town pincodes and as the fallback for an
  // intracity zone whenever same-day can't be quoted, so a store-city pincode is never hard-blocked.
  const outstationFee = async () => {
    const row = await getOne("SELECT value FROM site_settings WHERE key = 'delivery_fee_outstation'");
    return row?.value != null ? Number(row.value) : 100;
  };

  const delhiveryQuote = async () => {
    const deliveryFee = await outstationFee();
    const origin = await getOriginPin();
    /*
     * How far the parcel has to come, and where from.
     *
     * Same-day already tells the shopper this, because Shiprocket hands back the routing distance
     * its own fee was calculated from. Delhivery never does — an outstation parcel is priced by
     * weight and zone, not by kilometres — so the trip was simply not mentioned for anyone outside
     * a store city, which is exactly the customer with the least idea where their cookies are
     * coming from.
     *
     * Straight-line from the dispatching warehouse, therefore, and flagged as approximate so the
     * wording can say "about". It reads shorter than the road ever will, and quoting it as though
     * it were exact would be inventing a precision Delhivery never gave us.
     */
    const originStore = storeByPincode(origin);
    const approxKm = straightLineKm(originStore, lat, lng);
    const journey = { distanceKm: approxKm, distanceApprox: approxKm != null, originStore: originStore?.name ?? null };
    if (!delhiveryConfigured()) {
      console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | delhivery=unconfigured → serviceable=true`);
      return { serviceable: true, reason: 'unconfigured', carrier: 'DELHIVERY', pincode: pin, tat: null, expectedDeliveryDate: null, deliveryFee, ...journey };
    }
    const [svc, tat] = await Promise.all([
      checkServiceability(pin),
      (async () => {
        if (!origin) return { ok: false, reason: 'origin_not_set' };
        return expectedTat({ originPin: origin, destinationPin: pin });
      })(),
    ]);
    console.log(`[DELIVERY] check result | pin=${pin} | carrier=DELHIVERY | serviceable=${svc.serviceable} | reason=${svc.reason} | tat=${tat.ok ? tat.tat : tat.reason} | approx=${approxKm ?? 'n/a'}km from ${originStore?.code || origin || 'unknown'}`);
    return {
      serviceable: svc.serviceable, embargo: svc.embargo || false, reason: svc.reason, cod: svc.cod,
      carrier: 'DELHIVERY', pincode: pin, tat: tat.ok ? tat.tat : null, expectedDeliveryDate: tat.ok ? tat.expectedDeliveryDate : null,
      deliveryFee, ...journey,
    };
  };

  // Intracity: if the pincode is in a city where we have a store (Bengaluru / Chennai zones), it
  // ALWAYS ships SAME-DAY, fulfilled from the nearest store — that's the intracity promise,
  // so a store-zone pincode is never dropped to multi-day Delhivery. When the hyperlocal carrier
  // (Shiprocket) is live and we have coordinates, we quote its real rate/ETA; otherwise we promise a
  // store-fulfilled ~1h delivery at the configured intracity fee (the shipment is created at order
  // time, trying the carrier first and falling back to the store's own rider).
  /*
   * Intracity. A store-zone pincode is served SAME-DAY by the hyperlocal carrier or it is not served
   * at all — it is never quoted as a multi-day Delhivery parcel, because the shopper chose us for
   * same-day and quietly substituting a three-day courier is not the thing they bought.
   *
   * This check therefore refuses to promise anything it has not actually confirmed. It used to
   * answer "same-day, ~1h" purely from the pincode PREFIX, before any carrier was asked, which meant
   * checkout happily took money for a lane the carrier would later refuse. Now the promise is only
   * made on the back of a live serviceable quote from a store we can genuinely collect from; every
   * other case reports unserviceable, with a reason the UI can act on.
   */
  const pickup = nearestStore(pin);
  if (pickup) {
    const unavailable = (reason, message) => {
      console.log(`[DELIVERY] check | pin=${pin} | intracity UNAVAILABLE (${reason})`);
      return res.json({ serviceable: false, intracity: true, sameDay: false, reason, message, pincode: pin, city: pickup.city });
    };

    // Any open store in the zone will do — see activeZoneStores. Asking only about the
    // pincode-nearest one refused addresses that an open store was minutes away from.
    const open = await activeZoneStores(pin);
    if (!open.length) {
      return unavailable('same_day_unavailable', 'Same-day delivery is paused for this area right now. Please try again shortly.');
    }
    if (!shiprocketConfigured() || SHIPROCKET_DISABLED) {
      return unavailable('same_day_unavailable', 'Same-day delivery is paused for this area right now. Please try again shortly.');
    }
    if (!lat || !lng) {
      // We cannot quote hyperlocal without coordinates, and we will not guess. Ask for the location
      // rather than promise a delivery we have not priced.
      return unavailable('location_required', 'Share your location so we can confirm same-day delivery to this address.');
    }
    try {
      // Only the open ones are candidates, or a quote could promise a store that is shut.
      const chosen = await pickServiceableStore(orderStoresByProximity(open, lat, lng), { pin, lat, lng });
      if (!chosen) {
        return unavailable('out_of_range', 'This address is outside same-day range from our stores. We are unable to deliver here yet.');
      }
      const etaHours = chosen.etdHours ?? 1;
      console.log(`[DELIVERY] check | pin=${pin} | carrier=SHIPROCKET | SAME-DAY ~${etaHours}h from ${chosen.store.name} | fee=${chosen.rate}`);
      // distanceKm is the carrier's own routing distance from the dispatching store to this
      // address — the number the fee is actually calculated from. Passed through so checkout can
      // explain the fee rather than just state it. Null when the quote omits it; intracity only,
      // since an outstation parcel is priced by weight and zone, not by kilometres.
      return res.json({ serviceable: true, intracity: true, sameDay: true, carrier: 'SHIPROCKET',
        store: chosen.store.name, city: chosen.store.city, deliveryFee: chosen.rate, etaHours,
        distanceKm: chosen.distance ?? null,
        /* "Same-day", not "within ~1 hour".
           An hour is a promise that depends on a rider being free, a kitchen not being mid-bake and
           traffic behaving, none of which we control or measure — so it was a number we could not
           stand behind, printed on the screen where somebody decides to pay. Same-day is the thing
           that is actually true, and it is what the footer and the store copy already say. */
        etaLabel: 'Same-day', tat: null, expectedDeliveryDate: null, pincode: pin });
    } catch (e: any) {
      // A carrier outage must not silently become a Delhivery quote — say we cannot confirm.
      console.log(`[DELIVERY] check | pin=${pin} | hyperlocal quote errored (${e?.message || e})`);
      return unavailable('same_day_unavailable', 'We could not confirm same-day delivery just now. Please try again in a moment.');
    }
  }

  /*
   * Outstation, and the warehouse has to be open for it.
   *
   * Every out-of-town parcel is dispatched from the warehouse — storeForAddress() hands a
   * non-store-zone address straight to WAREHOUSE_CODE. Order creation already knows this: with the
   * warehouse shut it finds no open store in the zone (there are none outside a store city) and
   * refuses with a 503.
   *
   * This check did not, so the two disagreed. With only the Bengaluru store trading, someone in
   * Hyderabad was quoted a real fee and a real delivery date, carried that promise the whole way
   * through checkout, and was turned away at the final step. Refusing here costs them one screen
   * instead of the entire basket.
   *
   * intercityOpen() rather than isStoreActive(), so the warehouse's delivery-mode switch counts as
   * well: set it to Intracity and outstation closes while the shop keeps trading same-day, which is
   * the gentler of the two ways to close it.
   */
  if (!(await intercityOpen())) {
    console.log(`[DELIVERY] check | pin=${pin} | outstation UNAVAILABLE (warehouse closed or set to intracity only)`);
    return res.json({
      serviceable: false, intracity: false, sameDay: false, reason: 'outstation_unavailable',
      message: 'We are not shipping outside our delivery cities at the moment. Please check back soon.',
      pincode: pin,
    });
  }

  console.log(`[DELIVERY] check | pin=${pin} | carrier=DELHIVERY | out-of-town`);
  res.json(await delhiveryQuote());
});

export default router;

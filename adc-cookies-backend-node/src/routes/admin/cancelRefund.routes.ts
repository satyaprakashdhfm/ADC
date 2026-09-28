/*
 * req.admin is asserted non-null throughout this file: the whole admin router is mounted
 * behind router.use(requireAdminSession) in admin.routes.ts, which 401s first.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiError } from '../../utils/ApiError.js';
import { normalizePhone } from '../../services/messageCentral.client.js';
import { loadCancellable, issueCancelCode, cancelWithCode } from '../../services/cancelRefund.service.js';

/*
 * Cancel an order and refund it, behind a one-time code sent to the admin's own phone.
 *
 * The work itself lives in cancelRefund.service.ts, shared with the store portal. What is admin
 * specific is WHERE the code goes: the number on the admin's own session, never one supplied in the
 * request. A borrowed laptop with an open tab still cannot choose where the challenge lands.
 */

const router = Router();

// Sending costs an SMS and a refund is a rare action — a generous limit still stops a loop.
const otpLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts', message: 'Too many verification codes requested. Try again in 15 minutes.' },
});

/*
 * The admin's own phone, taken from their admin session. Never off the request body.
 *
 * This used to read the phone off a users row matched on the token's email. It now comes from the
 * session, which is a stronger guarantee for exactly this purpose: it is the number that received
 * the OTP to open the dashboard in the first place, so the refund code goes back to the same phone
 * that authenticated.
 *
 * adminLabel is what goes in logs. The full number there is a privacy leak, not an audit trail.
 */
async function adminPhone(req) {
  const phone = normalizePhone(req.admin?.phone);
  if (!phone) throw new ApiError('Your admin session has no valid mobile number, so a refund cannot be authorised.', 409);
  return {
    adminId: phone.national,                 // stable per admin; the challenge key needs no more
    adminName: req.admin!.name,
    adminLabel: '****' + phone.national.slice(-4),
    phone,
  };
}

/*
 * POST /orders/:id/cancel/request-code
 * Sends the code. Tells the caller which number it went to, masked — enough to know the right
 * phone is ringing, not enough to disclose the number to a session that did not already know it.
 */
router.post('/orders/:id/cancel/request-code', otpLimiter, async (req, res) => {
  const order = await loadCancellable(req.params.id);
  const { adminId, adminLabel, phone } = await adminPhone(req);
  const out = await issueCancelCode({ callerKey: `admin:${adminId}`, order, phone });
  console.log(`[ADMIN-CANCEL] code sent | order=${order.order_number} | admin=${adminLabel}`);
  res.json(out);
});

/* POST /orders/:id/cancel  { reason, code } */
router.post('/orders/:id/cancel', async (req, res) => {
  const order = await loadCancellable(req.params.id);
  const { adminId } = await adminPhone(req);
  const result = await cancelWithCode({
    callerKey: `admin:${adminId}`, order,
    code: String(req.body?.code || '').trim(),
    reason: String(req.body?.reason || '').trim(),
    by: 'admin', logTag: 'ADMIN-CANCEL',
  });
  res.json(result);
});

export default router;

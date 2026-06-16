import * as couponsService from '../services/couponsService.js';

export async function validateCoupon(req, res) {
  const { code, orderAmount } = req.query;
  res.json(await couponsService.validateCouponForResponse(String(code || ''), orderAmount ?? 0));
}

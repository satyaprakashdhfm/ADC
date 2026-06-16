import * as passwordResetService from '../services/passwordResetService.js';

export async function forgotPassword(req, res) {
  const { email } = req.body || {};
  const result = await passwordResetService.requestPasswordReset(String(email || '').trim());
  res.json(result);
}

export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body || {};
  const result = await passwordResetService.resetPassword(
    String(email || '').trim(),
    String(otp || '').trim(),
    newPassword,
  );
  res.json(result);
}

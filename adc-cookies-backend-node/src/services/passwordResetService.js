import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { sendOtpEmail } from '../config/mailer.js';
import { ApiError } from '../middleware.js';
import { OTP_EXPIRY_MINUTES, OTP_LENGTH, BCRYPT_ROUNDS } from '../config/constants.js';

function generateOtp() {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success — don't reveal whether email exists.
  if (!user) return { message: 'If that email is registered, an OTP has been sent.' };

  // Invalidate any previous unused OTPs for this email.
  await prisma.passwordResetOtp.updateMany({
    where: { email, used: false },
    data: { used: true },
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const ts = nowIso();

  await prisma.passwordResetOtp.create({
    data: { email, otp, expiresAt, used: false, createdAt: ts },
  });

  await sendOtpEmail(email, otp);

  return { message: 'If that email is registered, an OTP has been sent.' };
}

export async function resetPassword(email, otp, newPassword) {
  if (!email || !otp || !newPassword) {
    throw new ApiError('email, otp and newPassword are required');
  }
  if (newPassword.length < 6) {
    throw new ApiError('Password must be at least 6 characters');
  }

  const record = await prisma.passwordResetOtp.findFirst({
    where: { email, otp, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) throw new ApiError('Invalid OTP');
  if (record.expiresAt < nowIso()) throw new ApiError('OTP has expired');

  // Mark OTP used and update password in one transaction.
  await prisma.$transaction([
    prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.user.update({
      where: { email },
      data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS), updatedAt: nowIso() },
    }),
  ]);

  return { message: 'Password reset successfully' };
}

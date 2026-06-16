import nodemailer from 'nodemailer';
import { SMTP_USER, SMTP_PASS } from './env.js';

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendOtpEmail(to, otp) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"ADC Cookies" <${SMTP_USER}>`,
    to,
    subject: 'Your ADC Cookies password reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#b45309">ADC Cookies</h2>
        <p>You requested a password reset. Use the OTP below — it expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;text-align:center;
                    padding:24px;background:#fef3c7;border-radius:8px;margin:24px 0">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

import 'dotenv/config';

export const PORT = Number(process.env.PORT || 8080);
export const DATABASE_URL = process.env.DATABASE_URL;
export const JWT_SECRET = process.env.JWT_SECRET || 'adccookies_super_secret_key_2024_minimum_256_bits_long_for_hs256';
export const JWT_EXPIRATION_MS = Number(process.env.JWT_EXPIRATION || 86400000);
export const IS_VERCEL = !!process.env.VERCEL;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;

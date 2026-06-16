import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { ApiError } from '../middleware.js';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));

export async function submitMessage(name, email, phone, message) {
  if (!name) throw new ApiError('Name is required');
  if (!isEmail(email)) throw new ApiError('A valid email is required');
  if (!message) throw new ApiError('Message is required');
  const msg = await prisma.contactMessage.create({
    data: { name, email, phone: phone ?? null, message, createdAt: nowIso() },
  });
  return { ok: true, id: msg.id };
}

import { prisma } from './prisma.js';

export const nowIso = () => new Date().toISOString();

export function withTransaction(fn) {
  return prisma.$transaction(fn);
}

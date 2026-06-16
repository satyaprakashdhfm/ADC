import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from './env.js';

function makeClient() {
  // Supabase session pooler caps at 15 total connections — keep pool small.
  const adapter = new PrismaPg({ connectionString: DATABASE_URL, max: 5 });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

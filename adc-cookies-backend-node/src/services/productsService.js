import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware.js';

export async function getProducts(category, search) {
  if (search && String(search).trim()) {
    return prisma.product.findMany({
      where: { name: { contains: String(search).trim(), mode: 'insensitive' } },
      orderBy: { id: 'asc' },
    });
  }
  if (category) {
    return prisma.product.findMany({
      where: { category: String(category), isAvailable: true },
      orderBy: { id: 'asc' },
    });
  }
  return prisma.product.findMany({ where: { isAvailable: true }, orderBy: { id: 'asc' } });
}

export async function getProductById(id) {
  const product = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!product) throw new ApiError('Product not found');
  return product;
}

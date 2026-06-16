import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { ApiError } from '../middleware.js';

async function getUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError('User not found');
  return user;
}

export async function getOrCreateCart(email) {
  const user = await getUserByEmail(email);
  let cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (!cart) {
    const ts = nowIso();
    cart = await prisma.cart.create({ data: { userId: user.id, createdAt: ts, updatedAt: ts } });
  }
  return cart;
}

async function buildFullCart(cart) {
  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { id: 'asc' },
    include: { product: true },
  });
  return {
    id: cart.id,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: items.map((ci) => ({
      id: ci.id,
      productId: ci.productId,
      productName: ci.product?.name ?? null,
      product: ci.product,
      quantity: ci.quantity,
      selectedOptions: ci.selectedOptions,
      unitPrice: ci.unitPrice,
    })),
  };
}

async function touchCart(cartId) {
  await prisma.cart.update({ where: { id: cartId }, data: { updatedAt: nowIso() } });
}

export async function getCart(email) {
  const cart = await getOrCreateCart(email);
  return buildFullCart(cart);
}

export async function addItem(email, productId, quantity, selectedOptions) {
  const cart = await getOrCreateCart(email);
  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) throw new ApiError('Product not found');

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId: Number(productId) },
  });
  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + Number(quantity || 1) },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: Number(productId),
        quantity: Number(quantity || 1),
        selectedOptions: selectedOptions ? JSON.stringify(selectedOptions) : null,
        unitPrice: product.price,
      },
    });
  }
  await touchCart(cart.id);
  const updated = await prisma.cart.findUnique({ where: { id: cart.id } });
  return buildFullCart(updated);
}

export async function updateItem(email, itemId, quantity) {
  const cart = await getOrCreateCart(email);
  const item = await prisma.cartItem.findFirst({
    where: { id: Number(itemId), cartId: cart.id },
  });
  if (item) {
    if (Number(quantity) <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: Number(quantity) } });
    }
    await touchCart(cart.id);
  }
  const updated = await prisma.cart.findUnique({ where: { id: cart.id } });
  return buildFullCart(updated);
}

export async function removeItem(email, itemId) {
  const cart = await getOrCreateCart(email);
  await prisma.cartItem.deleteMany({ where: { id: Number(itemId), cartId: cart.id } });
  await touchCart(cart.id);
  const updated = await prisma.cart.findUnique({ where: { id: cart.id } });
  return buildFullCart(updated);
}

export async function clearCart(email) {
  const cart = await getOrCreateCart(email);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await touchCart(cart.id);
}

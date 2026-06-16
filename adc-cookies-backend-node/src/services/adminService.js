import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { ApiError } from '../middleware.js';
import { ROLES, LOW_STOCK_THRESHOLD, TOP_PRODUCTS_LIMIT } from '../config/constants.js';

/* ---------- Products ---------- */
export async function getProducts() {
  return prisma.product.findMany({ orderBy: { id: 'asc' } });
}

export async function createProduct(data) {
  const ts = nowIso();
  return prisma.product.create({
    data: {
      name: data.name, category: data.category, description: data.description ?? null,
      price: data.price, stockQuantity: data.stockQuantity ?? 0,
      images: data.images ?? null, options: data.options ?? null,
      isAvailable: data.isAvailable !== false,
      menuGroup: data.menuGroup ?? null, tag: data.tag ?? null,
      featured: !!data.featured, createdAt: ts, updatedAt: ts,
    },
  });
}

export async function updateProduct(id, data) {
  const existing = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError('Product not found');
  return prisma.product.update({
    where: { id: Number(id) },
    data: {
      name: data.name, category: data.category, description: data.description ?? null,
      price: data.price, stockQuantity: data.stockQuantity ?? 0,
      images: data.images ?? null, options: data.options ?? null,
      isAvailable: data.isAvailable !== false,
      menuGroup: data.menuGroup ?? null, tag: data.tag ?? null,
      featured: !!data.featured, updatedAt: nowIso(),
    },
  });
}

export async function updateStock(id, quantity) {
  const existing = await prisma.product.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError('Product not found');
  await prisma.product.update({
    where: { id: Number(id) },
    data: { stockQuantity: Number(quantity), updatedAt: nowIso() },
  });
}

export async function deleteProduct(id) {
  await prisma.product.delete({ where: { id: Number(id) } });
}

/* ---------- Orders ---------- */
export async function getOrders() {
  return prisma.order.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { items: true, address: true },
  });
}

export async function getOrder(id) {
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    include: { items: true, address: true },
  });
  if (!order) throw new ApiError('Order not found');
  return order;
}

export async function updateOrderStatus(id, status, remarks) {
  const order = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!order) throw new ApiError('Order not found');
  const ts = nowIso();
  await prisma.order.update({ where: { id: order.id }, data: { orderStatus: status, updatedAt: ts } });
  await prisma.orderTracking.create({
    data: { orderId: order.id, status, remarks: remarks ?? null, createdAt: ts },
  });
  return prisma.order.findUnique({
    where: { id: order.id },
    include: { items: true, address: true },
  });
}

/* ---------- Coupons ---------- */
export async function getCoupons() {
  return prisma.coupon.findMany({ orderBy: { id: 'asc' } });
}

export async function createCoupon(data) {
  return prisma.coupon.create({
    data: {
      code: String(data.code || '').toUpperCase(),
      discountType: data.discountType, discountValue: data.discountValue,
      minimumOrderAmount: data.minimumOrderAmount ?? null,
      maximumDiscount: data.maximumDiscount ?? null,
      expiryDate: data.expiryDate ?? null,
      usageLimit: data.usageLimit ?? null,
      isActive: data.isActive !== false,
    },
  });
}

export async function toggleCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id: Number(id) } });
  if (!coupon) throw new ApiError('Coupon not found');
  return prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: !coupon.isActive } });
}

/* ---------- Users ---------- */
export async function getUsers() {
  const users = await prisma.user.findMany({
    orderBy: { id: 'desc' },
    include: { _count: { select: { orders: true } } },
  });
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt,
    orderCount: u._count.orders,
  }));
}

/* ---------- Contact messages ---------- */
export async function getMessages() {
  return prisma.contactMessage.findMany({ orderBy: { id: 'desc' } });
}

export async function markMessageHandled(id) {
  const msg = await prisma.contactMessage.update({
    where: { id: Number(id) },
    data: { handled: true },
  });
  return { id: msg.id, handled: msg.handled };
}

/* ---------- Dashboard ---------- */
export async function getDashboard() {
  const [
    orders, totalProducts, totalUsers, totalAdmins,
    lowStock, newMessages, topProductsRaw, ordersByStatusRaw,
  ] = await Promise.all([
    prisma.order.findMany({ select: { totalAmount: true, orderStatus: true, paymentStatus: true } }),
    prisma.product.count(),
    prisma.user.count({ where: { role: ROLES.CUSTOMER } }),
    prisma.user.count({ where: { role: ROLES.ADMIN } }),
    prisma.product.count({ where: { stockQuantity: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.contactMessage.count({ where: { handled: false } }),
    prisma.orderItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: TOP_PRODUCTS_LIMIT,
    }),
    prisma.order.groupBy({ by: ['orderStatus'], _count: { id: true } }),
  ]);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const paidRevenue = orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.totalAmount, 0);
  const ordersByStatus = Object.fromEntries(ordersByStatusRaw.map((r) => [r.orderStatus, r._count.id]));
  const topProducts = topProductsRaw.map((r) => ({ name: r.productName, qty: r._sum.quantity, revenue: r._sum.totalPrice }));

  return { totalOrders, totalRevenue, paidRevenue, totalProducts, totalUsers, totalAdmins, lowStock, newMessages, ordersByStatus, topProducts };
}

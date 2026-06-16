import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { ApiError } from '../middleware.js';
import { getOrCreateCart } from './cartService.js';
import { validateCoupon, calculateDiscount } from './couponsService.js';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '../config/constants.js';

async function getUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError('User not found');
  return user;
}

function pad(n) { return String(n).padStart(2, '0'); }
async function genOrderNumber() {
  const d = new Date();
  const base = 'ADC' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
    + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  let candidate = base, n = 0;
  while (await prisma.order.findUnique({ where: { orderNumber: candidate } })) {
    candidate = base + (++n);
  }
  return candidate;
}

async function fullOrder(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, address: true },
  });
}

export async function createOrder(email, addressId, couponCode, bodyItems) {
  const user = await getUserByEmail(email);

  let lineItems;
  if (Array.isArray(bodyItems) && bodyItems.length > 0) {
    lineItems = await Promise.all(bodyItems.map(async (it) => {
      const product = await prisma.product.findUnique({ where: { id: Number(it.productId) } });
      if (!product) throw new ApiError(`Product not found: ${it.productId}`);
      return {
        product, productName: product.name, quantity: it.quantity || 1,
        unitPrice: product.price,
        selectedOptions: it.selectedOptions ? JSON.stringify(it.selectedOptions) : null,
        specialNotes: it.specialNotes ?? null,
      };
    }));
  } else {
    const cart = await getOrCreateCart(email);
    const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    if (cartItems.length === 0) throw new ApiError('Cart is empty');
    lineItems = await Promise.all(cartItems.map(async (ci) => {
      const product = await prisma.product.findUnique({ where: { id: ci.productId } });
      return {
        product, productName: product ? product.name : 'Item',
        quantity: ci.quantity, unitPrice: ci.unitPrice,
        selectedOptions: ci.selectedOptions, specialNotes: null,
      };
    }));
  }

  const address = await prisma.address.findUnique({ where: { id: Number(addressId) } });
  if (!address) throw new ApiError('Address not found');

  const subtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  let discount = 0, coupon = null;
  if (couponCode && String(couponCode).trim()) {
    coupon = await validateCoupon(couponCode, subtotal);
    discount = calculateDiscount(coupon, subtotal);
  }

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal - discount + deliveryFee;
  const ts = nowIso();
  const orderNumber = await genOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber, userId: user.id, addressId: address.id,
        subtotal, discountAmount: discount, deliveryFee, taxAmount: 0,
        totalAmount: total, couponCode: couponCode ?? null,
        paymentStatus: 'PENDING', orderStatus: 'PLACED',
        shipmentStatus: 'NOT_CREATED', labelGenerated: false,
        createdAt: ts, updatedAt: ts,
      },
    });
    await tx.orderItem.createMany({
      data: lineItems.map((li) => ({
        orderId: created.id,
        productId: li.product?.id ?? null,
        productName: li.productName,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.unitPrice * li.quantity,
        selectedOptions: li.selectedOptions,
        specialNotes: li.specialNotes,
      })),
    });
    await tx.orderTracking.create({
      data: { orderId: created.id, status: 'PLACED', remarks: 'Order placed successfully', createdAt: ts },
    });
    if (coupon) {
      await tx.couponUsage.create({
        data: { couponId: coupon.id, userId: user.id, orderId: created.id, usedAt: ts },
      });
    }
    return created;
  });

  const cart = await prisma.cart.findUnique({ where: { userId: user.id } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return fullOrder(order.id);
}

export async function getOrders(email) {
  const user = await getUserByEmail(email);
  return prisma.order.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { items: true, address: true },
  });
}

export async function getOrder(id) {
  const order = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!order) throw new ApiError('Order not found');
  return fullOrder(order.id);
}

export async function getTracking(orderId) {
  return prisma.orderTracking.findMany({
    where: { orderId: Number(orderId) },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function verifyPayment(orderId, razorpayPaymentId) {
  const order = await prisma.order.findUnique({ where: { id: Number(orderId) } });
  if (!order) throw new ApiError('Order not found');
  const ts = nowIso();
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: 'PAID', orderStatus: 'CONFIRMED', updatedAt: ts },
  });
  await prisma.payment.create({
    data: {
      orderId: order.id, provider: 'RAZORPAY',
      transactionId: razorpayPaymentId ?? null,
      amount: order.totalAmount, status: 'PAID', paidAt: ts, createdAt: ts,
    },
  });
  await prisma.orderTracking.create({
    data: { orderId: order.id, status: 'CONFIRMED', remarks: 'Payment received via Razorpay', createdAt: ts },
  });
  return fullOrder(order.id);
}

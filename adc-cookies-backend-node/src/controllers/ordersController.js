import * as ordersService from '../services/ordersService.js';

export async function createOrder(req, res) {
  const { addressId, couponCode, items } = req.body || {};
  res.json(await ordersService.createOrder(req.user.email, addressId, couponCode, items));
}

export async function getOrders(req, res) {
  res.json(await ordersService.getOrders(req.user.email));
}

export async function getOrder(req, res) {
  res.json(await ordersService.getOrder(req.params.id));
}

export async function getTracking(req, res) {
  res.json(await ordersService.getTracking(req.params.id));
}

export async function verifyPayment(req, res) {
  const { razorpayPaymentId } = req.body || {};
  res.json(await ordersService.verifyPayment(req.params.id, razorpayPaymentId));
}

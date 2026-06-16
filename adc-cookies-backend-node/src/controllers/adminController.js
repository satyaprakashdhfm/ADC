import * as adminService from '../services/adminService.js';

/* ---------- Products ---------- */
export async function getProducts(_req, res) {
  res.json(await adminService.getProducts());
}

export async function createProduct(req, res) {
  res.json(await adminService.createProduct(req.body || {}));
}

export async function updateProduct(req, res) {
  res.json(await adminService.updateProduct(req.params.id, req.body || {}));
}

export async function updateStock(req, res) {
  const qty = Number(req.body?.quantity ?? req.query.quantity);
  await adminService.updateStock(req.params.id, qty);
  res.status(200).end();
}

export async function deleteProduct(req, res) {
  await adminService.deleteProduct(req.params.id);
  res.status(200).end();
}

/* ---------- Orders ---------- */
export async function getOrders(_req, res) {
  res.json(await adminService.getOrders());
}

export async function getOrder(req, res) {
  res.json(await adminService.getOrder(req.params.id));
}

export async function updateOrderStatus(req, res) {
  const { status, remarks } = req.body || {};
  res.json(await adminService.updateOrderStatus(req.params.id, status, remarks));
}

/* ---------- Coupons ---------- */
export async function getCoupons(_req, res) {
  res.json(await adminService.getCoupons());
}

export async function createCoupon(req, res) {
  res.json(await adminService.createCoupon(req.body || {}));
}

export async function toggleCoupon(req, res) {
  res.json(await adminService.toggleCoupon(req.params.id));
}

/* ---------- Users ---------- */
export async function getUsers(_req, res) {
  res.json(await adminService.getUsers());
}

/* ---------- Contact messages ---------- */
export async function getMessages(_req, res) {
  res.json(await adminService.getMessages());
}

export async function markMessageHandled(req, res) {
  res.json(await adminService.markMessageHandled(req.params.id));
}

/* ---------- Dashboard ---------- */
export async function getDashboard(_req, res) {
  res.json(await adminService.getDashboard());
}

import * as authService from '../services/authService.js';

export async function register(req, res) {
  const { name, email, phone, password } = req.body || {};
  const result = await authService.register(name, email, phone, password);
  res.json(result);
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const result = await authService.login(email, password);
  res.json(result);
}

export async function adminLogin(req, res) {
  const { email, password } = req.body || {};
  const result = await authService.adminLogin(email, password);
  res.json(result);
}

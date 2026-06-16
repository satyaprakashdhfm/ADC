import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { nowIso } from '../config/database.js';
import { generateToken } from '../jwt.js';
import { ApiError } from '../middleware.js';
import { ROLES, BCRYPT_ROUNDS } from '../config/constants.js';

function authResponse(user) {
  return { token: generateToken(user.email, user.role), email: user.email, name: user.name, role: user.role };
}

export async function register(name, email, phone, password) {
  if (!name || !email || !phone || !password) throw new ApiError('name, email, phone and password are required');
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError('Email already registered');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const ts = nowIso();
  const user = await prisma.user.create({
    data: { name, email, phone, password: hash, role: ROLES.CUSTOMER, createdAt: ts, updatedAt: ts },
  });
  return authResponse(user);
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email || '' } });
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    throw new ApiError('Invalid email or password');
  }
  return authResponse(user);
}

export async function adminLogin(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email || '' } });
  if (!user || !(await bcrypt.compare(password || '', user.password)) || user.role !== ROLES.ADMIN) {
    throw new ApiError('Invalid credentials or insufficient permissions');
  }
  return authResponse(user);
}

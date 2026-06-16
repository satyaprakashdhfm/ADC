import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware.js';

async function getUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError('User not found');
  return user;
}

export async function getAddresses(email) {
  const user = await getUserByEmail(email);
  return prisma.address.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
}

export async function addAddress(email, data) {
  const user = await getUserByEmail(email);
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  return prisma.address.create({
    data: {
      userId: user.id,
      fullName: data.fullName,
      phone: data.phone,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      isDefault: !!data.isDefault,
    },
  });
}

export async function deleteAddress(id) {
  await prisma.address.delete({ where: { id: Number(id) } });
}

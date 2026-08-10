import { type WarehouseInput } from '@/lib/api';

export const EMPTY_WH: WarehouseInput = { name: '', registeredName: '', pickupLocation: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', returnPincode: '', phone: '', email: '', isDefault: false, skipDelhivery: false };

import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

export const registerOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const createOutletSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('IN'),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  brandId: z.string().uuid().optional(),
});

export const createBrandSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).optional(),
  description: z.string().optional(),
});

export const createMenuItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  basePrice: z.number().int().min(0),
  kitchenStationId: z.string().uuid().optional(),
  hsnCode: z.string().optional(),
  preparationTime: z.number().int().min(0).optional(),
  isAvailable: z.boolean().default(true),
  taxGroupId: z.string().uuid().optional(),
});

export const createOrderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  modifierIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  source: z.enum(['POS', 'QR', 'ONLINE', 'WAITER', 'DELIVERY', 'TAKEAWAY', 'DINE_IN', 'ROOM_SERVICE']),
  outletId: z.string().uuid(),
  tableId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(createOrderItemSchema).min(1),
  notes: z.string().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'ROOM_SERVICE']).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

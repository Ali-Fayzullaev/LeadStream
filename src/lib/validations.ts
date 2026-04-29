import { z } from 'zod';

// Phone: simple international-friendly validator (digits, spaces, +, -, parentheses).
const phoneRegex = /^[+0-9()\-\s]{7,20}$/;

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().regex(phoneRegex, 'Invalid phone number'),
  productName: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  amount: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  ref: z.string().trim().max(64).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const createStreamerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  refCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/i, 'Only letters, digits and dashes')
    .optional(),
  isActive: z.boolean().optional().default(true),
});
export type CreateStreamerInput = z.infer<typeof createStreamerSchema>;

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  streamerId: z.string().optional(),
});

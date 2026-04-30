import { z } from 'zod';

const phoneRegex = /^[+0-9()\-\s]{7,20}$/;
const refCodeRegex = /^[a-z0-9_-]{3,32}$/i;
// TikTok handles: 2–24 chars, letters/digits/dots/underscores. We also strip a leading '@'.
const tiktokRegex = /^[A-Za-z0-9._]{2,24}$/;

export const tiktokUsernameSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/^@/, ''))
  .pipe(z.string().regex(tiktokRegex, 'TikTok @username: 2–24 символа (буквы, цифры, точка, подчёркивание)'));

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().regex(phoneRegex, 'Invalid phone'),
  productName: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(999),
  amount: z.coerce.number().min(0).max(10_000_000),
  notes: z.string().trim().max(1000).optional().nullable(),
  ref: z.string().trim().regex(refCodeRegex).max(64).optional().nullable(),
  utm_source: z.string().trim().max(120).optional().nullable(),
  utm_medium: z.string().trim().max(120).optional().nullable(),
  utm_campaign: z.string().trim().max(120).optional().nullable(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const registerStreamerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  tiktokUsernames: z
    .array(tiktokUsernameSchema)
    .min(1, 'Добавьте хотя бы один TikTok-аккаунт')
    .max(10, 'Максимум 10 аккаунтов'),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(72),
});
export type RegisterStreamerInput = z.infer<typeof registerStreamerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateStreamerProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().regex(phoneRegex).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  telegram_chat_id: z.string().trim().max(64).nullable().optional(),
});
export type UpdateStreamerProfileInput = z.infer<typeof updateStreamerProfileSchema>;

export const adminUpdateStreamerSchema = z.object({
  display_name: z.string().trim().min(2).max(120).optional(),
  ref_code: z.string().trim().regex(refCodeRegex).optional(),
  status: z.enum(['pending', 'active', 'blocked']).optional(),
  commission_percent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type AdminUpdateStreamerInput = z.infer<typeof adminUpdateStreamerSchema>;

export const adminCreateStreamerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(72),
  refCode: z.string().trim().regex(refCodeRegex),
  commissionPercent: z.coerce.number().min(0).max(100).default(10),
});
export type AdminCreateStreamerInput = z.infer<typeof adminCreateStreamerSchema>;

// ---- Admin profile / settings ----

const hexColorRegex = /^#([0-9a-fA-F]{6})$/;
const statusKeyRegex = /^[a-z0-9_]{2,32}$/;

export const adminUpdateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
});
export type AdminUpdateProfileInput = z.infer<typeof adminUpdateProfileSchema>;

export const adminChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(72),
});
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;

export const orderStatusSchema = z.object({
  key: z.string().trim().toLowerCase().regex(statusKeyRegex, 'Только латиница, цифры, _ (2–32)'),
  label: z.string().trim().min(1).max(60),
  color: z.string().trim().regex(hexColorRegex, 'Цвет должен быть в формате #rrggbb'),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export const orderStatusUpdateSchema = orderStatusSchema.partial().omit({ key: true });
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

// ---- Learn lessons ----

const youtubeUrlRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}([&?].*)?$/;

export const learnLessonSchema = z.object({
  title: z.string().trim().min(2, 'Минимум 2 символа').max(160),
  description: z.string().trim().max(500).nullable().optional(),
  youtube_url: z
    .string()
    .trim()
    .max(300)
    .regex(youtubeUrlRegex, 'Введите корректную ссылку на YouTube')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  body: z.string().trim().max(8000).nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_published: z.coerce.boolean().default(true),
});
export type LearnLessonInput = z.infer<typeof learnLessonSchema>;

export const learnLessonUpdateSchema = learnLessonSchema.partial();
export type LearnLessonUpdateInput = z.infer<typeof learnLessonUpdateSchema>;

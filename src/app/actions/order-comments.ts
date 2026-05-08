'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type OrderCommentRole = 'admin' | 'manager' | 'broker';

export interface OrderCommentDTO {
  id: string;
  order_id: string;
  author_id: string;
  author_role: OrderCommentRole;
  author_name: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
  /** Set on the server to make UI logic simple. */
  is_mine: boolean;
}

interface CallerCtx {
  userId: string;
  role: OrderCommentRole;
  displayName: string | null;
  /** Manager.id (when role==='manager') */
  managerId?: string | null;
  /** Broker.id (when role==='broker') */
  brokerId?: string | null;
}

const MAX_BODY = 2000;

/**
 * Resolves the calling user and their role.
 * Throws when the user is not authenticated.
 */
async function getCaller(): Promise<CallerCtx> {
  const supabase = createClient();
  // getUser() may throw on stale/invalid refresh tokens. Catch defensively
  // so the action returns a clean { success:false } instead of a server crash
  // (which would surface as a 502 in dev / Cannot read 'success' on the client).
  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }
  if (!user) throw new Error('Не авторизован');

  const admin = createAdminClient();

  // 1. Admin via profiles.role
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role === 'admin') {
    return {
      userId: user.id,
      role: 'admin',
      displayName: profile.full_name ?? user.email ?? null,
    };
  }

  // 2. Manager
  const { data: manager } = await admin
    .from('managers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (manager) {
    if (manager.status === 'blocked') throw new Error('Ваш аккаунт заблокирован');
    return {
      userId: user.id,
      role: 'manager',
      displayName: manager.display_name,
      managerId: manager.id,
    };
  }

  // 3. Broker
  const { data: broker } = await admin
    .from('brokers')
    .select('id, display_name, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (broker) {
    if (broker.status === 'blocked') throw new Error('Ваш аккаунт заблокирован');
    return {
      userId: user.id,
      role: 'broker',
      displayName: broker.display_name,
      brokerId: broker.id,
    };
  }

  throw new Error('Роль не определена');
}

/**
 * Returns true if the caller is allowed to see this order
 * (and therefore — to read/comment on it).
 *
 * Rules:
 *   - admin       → all orders
 *   - manager     → assigned_manager_id == self.managerId
 *   - broker      → assigned_broker_id  == self.brokerId
 */
async function canAccessOrder(ctx: CallerCtx, orderId: string): Promise<boolean> {
  if (ctx.role === 'admin') return true;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, assigned_manager_id, assigned_broker_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return false;
  if (ctx.role === 'manager') return order.assigned_manager_id === ctx.managerId;
  if (ctx.role === 'broker') return order.assigned_broker_id === ctx.brokerId;
  return false;
}

function revalidateForRole(role: OrderCommentRole): void {
  if (role === 'admin') {
    revalidatePath('/admin/orders');
    revalidatePath('/admin');
  } else if (role === 'manager') {
    revalidatePath('/manager/orders');
    revalidatePath('/manager');
  } else if (role === 'broker') {
    revalidatePath('/broker');
  }
}

// ===========================================================================
// PUBLIC ACTIONS
// ===========================================================================

export async function listOrderCommentsAction(
  orderId: string,
): Promise<{ success: true; comments: OrderCommentDTO[] } | { success: false; error: string }> {
  try {
    const ctx = await getCaller();
    if (!(await canAccessOrder(ctx, orderId))) {
      return { success: false, error: 'Нет доступа к этому заказу' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('order_comments')
      .select('id, order_id, author_id, author_role, author_name, body, created_at, updated_at, edited')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments: OrderCommentDTO[] = (data ?? []).map((c) => ({
      id: c.id as string,
      order_id: c.order_id as string,
      author_id: c.author_id as string,
      author_role: c.author_role as OrderCommentRole,
      author_name: (c.author_name as string | null) ?? null,
      body: c.body as string,
      created_at: c.created_at as string,
      updated_at: c.updated_at as string,
      edited: !!c.edited,
      is_mine: (c.author_id as string) === ctx.userId,
    }));
    return { success: true, comments };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось загрузить комментарии' };
  }
}

export async function createOrderCommentAction(
  orderId: string,
  body: string,
): Promise<{ success: true; comment: OrderCommentDTO } | { success: false; error: string }> {
  try {
    const text = (body ?? '').trim();
    if (!text) return { success: false, error: 'Комментарий пуст' };
    if (text.length > MAX_BODY) {
      return { success: false, error: `Слишком длинный комментарий (макс ${MAX_BODY} симв.)` };
    }

    const ctx = await getCaller();
    if (!(await canAccessOrder(ctx, orderId))) {
      return { success: false, error: 'Нет доступа к этому заказу' };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('order_comments')
      .insert({
        order_id: orderId,
        author_id: ctx.userId,
        author_role: ctx.role,
        author_name: ctx.displayName,
        body: text,
      })
      .select('id, order_id, author_id, author_role, author_name, body, created_at, updated_at, edited')
      .single();
    if (error) throw error;

    revalidateForRole(ctx.role);
    return {
      success: true,
      comment: {
        id: data.id as string,
        order_id: data.order_id as string,
        author_id: data.author_id as string,
        author_role: data.author_role as OrderCommentRole,
        author_name: (data.author_name as string | null) ?? null,
        body: data.body as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        edited: !!data.edited,
        is_mine: true,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось добавить комментарий' };
  }
}

export async function updateOrderCommentAction(
  commentId: string,
  body: string,
): Promise<{ success: true; comment: OrderCommentDTO } | { success: false; error: string }> {
  try {
    const text = (body ?? '').trim();
    if (!text) return { success: false, error: 'Комментарий пуст' };
    if (text.length > MAX_BODY) {
      return { success: false, error: `Слишком длинный комментарий (макс ${MAX_BODY} симв.)` };
    }

    const ctx = await getCaller();
    const admin = createAdminClient();

    // Only author can edit (admin too if author)
    const { data: existing } = await admin
      .from('order_comments')
      .select('id, author_id, order_id')
      .eq('id', commentId)
      .maybeSingle();
    if (!existing) return { success: false, error: 'Комментарий не найден' };
    if (existing.author_id !== ctx.userId) {
      return { success: false, error: 'Можно редактировать только свои комментарии' };
    }

    const { data, error } = await admin
      .from('order_comments')
      .update({ body: text })
      .eq('id', commentId)
      .select('id, order_id, author_id, author_role, author_name, body, created_at, updated_at, edited')
      .single();
    if (error) throw error;

    revalidateForRole(ctx.role);
    return {
      success: true,
      comment: {
        id: data.id as string,
        order_id: data.order_id as string,
        author_id: data.author_id as string,
        author_role: data.author_role as OrderCommentRole,
        author_name: (data.author_name as string | null) ?? null,
        body: data.body as string,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
        edited: !!data.edited,
        is_mine: true,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось обновить комментарий' };
  }
}

export async function deleteOrderCommentAction(
  commentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const ctx = await getCaller();
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('order_comments')
      .select('id, author_id')
      .eq('id', commentId)
      .maybeSingle();
    if (!existing) return { success: false, error: 'Комментарий не найден' };

    // Author or admin can delete
    if (existing.author_id !== ctx.userId && ctx.role !== 'admin') {
      return { success: false, error: 'Можно удалять только свои комментарии' };
    }

    const { error } = await admin.from('order_comments').delete().eq('id', commentId);
    if (error) throw error;

    revalidateForRole(ctx.role);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось удалить комментарий' };
  }
}

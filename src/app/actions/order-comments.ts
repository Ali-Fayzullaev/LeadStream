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
 *
 * Why so defensive?
 *   - `supabase.auth.getUser()` can throw on stale/invalid refresh tokens.
 *     We swallow that and return `null`, otherwise the server action would
 *     bubble up an uncaught exception → in Next 14 server actions that
 *     manifests on the client as `undefined` (no `success` field), and on
 *     production behind Nginx as a 502.
 *   - Profile / manager / broker lookups are issued in PARALLEL — three
 *     small head-style queries against indexed columns. This is the hot
 *     path that runs on every dialog open AND on every keystroke; halving
 *     latency makes the comments thread feel snappy.
 *   - We DO NOT throw on "no role found" — we throw a clearly-typed error
 *     that callers turn into a user-facing toast. Throwing strings was
 *     causing "Не удалось загрузить комментарии" with no detail.
 */
async function getCaller(): Promise<CallerCtx> {
  const supabase = createClient();
  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    // Stale refresh-token, missing cookies, JWKS hiccup, etc.
    console.warn('[order-comments] auth.getUser() failed:', err);
    user = null;
  }
  if (!user) throw new Error('Не авторизован — войдите заново');

  const admin = createAdminClient();

  const [profileRes, managerRes, brokerRes] = await Promise.all([
    admin.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle(),
    admin.from('managers').select('id, display_name, status').eq('user_id', user.id).maybeSingle(),
    admin.from('brokers').select('id, display_name, status').eq('user_id', user.id).maybeSingle(),
  ]);

  if (profileRes.data?.role === 'admin') {
    return {
      userId: user.id,
      role: 'admin',
      displayName: profileRes.data.full_name ?? user.email ?? null,
    };
  }

  if (managerRes.data) {
    if (managerRes.data.status === 'blocked') throw new Error('Ваш аккаунт заблокирован');
    return {
      userId: user.id,
      role: 'manager',
      displayName: managerRes.data.display_name,
      managerId: managerRes.data.id,
    };
  }

  if (brokerRes.data) {
    if (brokerRes.data.status === 'blocked') throw new Error('Ваш аккаунт заблокирован');
    return {
      userId: user.id,
      role: 'broker',
      displayName: brokerRes.data.display_name,
      brokerId: brokerRes.data.id,
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
    console.error('[order-comments] listOrderCommentsAction failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Не удалось загрузить комментарии' };
  }
}

// ===========================================================================
// SERVER-SIDE HELPERS (used by page server components, not by the client)
// ===========================================================================

/**
 * Lightweight DTO for the inline "last comment" preview rendered next to
 * each order row. Intentionally a subset of OrderCommentDTO — there is no
 * `is_mine` because previews are shown to everybody who can see the order,
 * and we don't want to pay the cost of resolving the viewer's identity for
 * every list page render.
 */
export interface OrderCommentPreview {
  id: string;
  order_id: string;
  author_role: OrderCommentRole;
  author_name: string | null;
  body: string;
  created_at: string;
  edited: boolean;
}

/**
 * Returns a `Map<orderId, {count, last}>` for the supplied order ids.
 *
 * Why one helper for both count + last?
 *   - Every order-list page needs BOTH numbers (badge with count + inline
 *     preview of the most recent message). Doing two round-trips would
 *     double the DB latency for what is essentially the same data.
 *   - We fetch ALL comments for the given orders ordered by `created_at desc`,
 *     then fold them in JS. With our existing
 *     `idx_order_comments_order_id (order_id, created_at)` index this is an
 *     index-only scan and remains O(rows-on-page).
 *   - For pages with hundreds of orders this is still cheap because the
 *     index is sorted; if comment volume grows we can switch to a Postgres
 *     `distinct on (order_id) ...` query without changing this API.
 *
 * Authorisation is intentionally NOT enforced here: this runs only inside
 * server components on pages that are already guarded by role-aware data
 * fetching (admin sees all orders, manager only sees their own etc.). The
 * helper just returns metadata for order ids the caller has already proved
 * it can see.
 */
export async function getOrderCommentsSummary(
  orderIds: string[],
): Promise<Map<string, { count: number; last: OrderCommentPreview | null }>> {
  const map = new Map<string, { count: number; last: OrderCommentPreview | null }>();
  if (orderIds.length === 0) return map;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('order_comments')
    .select('id, order_id, author_role, author_name, body, created_at, edited')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[order-comments] getOrderCommentsSummary failed:', error);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.order_id as string;
    const existing = map.get(id);
    if (existing) {
      existing.count += 1;
      // First row per order_id IS the latest (we sorted desc above), so we
      // never need to overwrite `last` once it's set.
    } else {
      map.set(id, {
        count: 1,
        last: {
          id: row.id as string,
          order_id: id,
          author_role: row.author_role as OrderCommentRole,
          author_name: (row.author_name as string | null) ?? null,
          body: row.body as string,
          created_at: row.created_at as string,
          edited: !!row.edited,
        },
      });
    }
  }
  return map;
}

/**
 * Bulk-fetch ALL comments for the supplied order ids in chronological order.
 *
 * Used by list pages (admin / manager / broker dashboards) so that the
 * comments thread is fully visible inline — no extra round-trip when the
 * user expands a row. The viewer's `userId` is provided so we can mark
 * `is_mine` correctly without a second auth check inside the loop.
 *
 * Returns `Map<orderId, OrderCommentDTO[]>` with the inner arrays sorted
 * ascending by `created_at` (so the freshest message is at the bottom,
 * same convention as the dialog uses).
 *
 * Authorisation is the caller's job — this helper assumes the caller has
 * already proved (via role-aware data fetching on the page) that the
 * viewer can see these orders.
 */
export async function getOrderCommentsBulk(
  orderIds: string[],
  viewerUserId: string | null,
): Promise<Map<string, OrderCommentDTO[]>> {
  const map = new Map<string, OrderCommentDTO[]>();
  if (orderIds.length === 0) return map;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('order_comments')
    .select('id, order_id, author_id, author_role, author_name, body, created_at, updated_at, edited')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[order-comments] getOrderCommentsBulk failed:', error);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.order_id as string;
    const dto: OrderCommentDTO = {
      id: row.id as string,
      order_id: id,
      author_id: row.author_id as string,
      author_role: row.author_role as OrderCommentRole,
      author_name: (row.author_name as string | null) ?? null,
      body: row.body as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      edited: !!row.edited,
      is_mine: viewerUserId !== null && (row.author_id as string) === viewerUserId,
    };
    const arr = map.get(id);
    if (arr) arr.push(dto);
    else map.set(id, [dto]);
  }
  return map;
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

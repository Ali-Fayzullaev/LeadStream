import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OrderStatus {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_system: boolean;
}

/**
 * Fetch all order statuses ordered by sort_order.
 * Cached per-request via Next.js fetch cache (we use service-role here).
 */
export async function getOrderStatuses(): Promise<OrderStatus[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('order_statuses')
    .select('key, label, color, sort_order, is_system')
    .order('sort_order', { ascending: true });
  return (data ?? []) as OrderStatus[];
}

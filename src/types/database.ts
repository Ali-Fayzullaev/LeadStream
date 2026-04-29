// Hand-written types for the public schema (kept in sync with supabase/migrations).
// You can later replace this with auto-generated types: `npm run types:gen`.

export type UserRole = 'admin' | 'streamer';
export type StreamerStatus = 'pending' | 'active' | 'blocked';
export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

export interface Streamer {
  id: string;
  user_id: string;
  display_name: string;
  tiktok_username: string | null;
  ref_code: string;
  status: StreamerStatus;
  commission_percent: number;
  avatar_url: string | null;
  phone: string | null;
  notes: string | null;
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  notes: string | null;
  streamer_id: string | null;
  ref_code_snapshot: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamerOrderMasked {
  id: string;
  customer_name: string;
  customer_phone_masked: string;
  product_name: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  streamer_id: string | null;
  ref_code_snapshot: string | null;
  created_at: string;
}

export interface StreamerStats {
  id: string;
  display_name: string;
  ref_code: string;
  status: StreamerStatus;
  commission_percent: number;
  created_at: string;
  orders_count: number;
  revenue: number;
  commission: number;
}

export interface DailyStats {
  day: string;
  streamer_id: string | null;
  orders_count: number;
  revenue: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, 'id' | 'email'>; Update: Partial<Profile>; Relationships: [] };
      streamers: { Row: Streamer; Insert: Partial<Streamer> & Pick<Streamer, 'user_id' | 'display_name' | 'ref_code'>; Update: Partial<Streamer>; Relationships: [] };
      orders: { Row: Order; Insert: Partial<Order> & Pick<Order, 'customer_name' | 'customer_phone' | 'product_name'>; Update: Partial<Order>; Relationships: [] };
    };
    Views: {
      streamer_orders: { Row: StreamerOrderMasked; Relationships: [] };
      streamer_stats: { Row: StreamerStats; Relationships: [] };
      daily_stats: { Row: DailyStats; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      streamer_status: StreamerStatus;
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

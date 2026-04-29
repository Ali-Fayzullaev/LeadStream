import { NextResponse, type NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // Auth: must be admin.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();
  const sp = request.nextUrl.searchParams;

  let q = admin
    .from('orders')
    .select('id, created_at, customer_name, customer_phone, product_name, quantity, amount, status, ref_code_snapshot, streamer_id, streamers(display_name)')
    .order('created_at', { ascending: false })
    .limit(10_000);

  if (sp.get('status')) q = q.eq('status', sp.get('status') as string);
  if (sp.get('streamer')) q = q.eq('streamer_id', sp.get('streamer') as string);
  if (sp.get('q')) {
    const v = `%${sp.get('q')}%`;
    q = q.or(`customer_name.ilike.${v},customer_phone.ilike.${v},product_name.ilike.${v}`);
  }
  if (sp.get('from')) q = q.gte('created_at', sp.get('from') as string);
  if (sp.get('to')) q = q.lte('created_at', `${sp.get('to')}T23:59:59`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Raw = {
    id: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    product_name: string;
    quantity: number;
    amount: number;
    status: string;
    ref_code_snapshot: string | null;
    streamers: { display_name: string } | { display_name: string }[] | null;
  };

  const rows = ((data ?? []) as unknown as Raw[]).map((r) => {
    const s = Array.isArray(r.streamers) ? r.streamers[0] : r.streamers;
    return {
      Date: new Date(r.created_at).toISOString(),
      Customer: r.customer_name,
      Phone: r.customer_phone,
      Product: r.product_name,
      Quantity: r.quantity,
      Amount: Number(r.amount),
      Status: r.status,
      Streamer: s?.display_name ?? '',
      RefCode: r.ref_code_snapshot ?? '',
      OrderId: r.id,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  // NextResponse expects BodyInit; Buffer → Uint8Array view satisfies it.
  const body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  const filename = `orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

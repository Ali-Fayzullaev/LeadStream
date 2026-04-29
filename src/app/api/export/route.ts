import { NextResponse, type NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/export?format=csv|xlsx[&from=&to=&streamerId=]
 * Streams a download containing orders within the selected range.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'xlsx').toLowerCase();
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const streamerId = searchParams.get('streamerId');

  let q = supabase
    .from('orders')
    .select('id, customer_name, customer_phone, product_name, quantity, amount, status, created_at, streamer:streamers(name, ref_code)')
    .order('created_at', { ascending: false });
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  if (streamerId) q = q.eq('streamer_id', streamerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((o) => ({
    ID: o.id,
    Date: o.created_at,
    Customer: o.customer_name,
    Phone: o.customer_phone,
    Product: o.product_name,
    Qty: o.quantity,
    Amount: o.amount,
    Status: o.status,
    Streamer: (o.streamer as { name?: string } | null)?.name ?? '',
    Ref: (o.streamer as { ref_code?: string } | null)?.ref_code ?? '',
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Orders');

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-${Date.now()}.csv"`,
      },
    });
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new NextResponse(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-${Date.now()}.xlsx"`,
    },
  });
}

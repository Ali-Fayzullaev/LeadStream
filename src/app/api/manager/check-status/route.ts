import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: manager } = await supabase
      .from('managers')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!manager) {
      return NextResponse.json({ status: 'not_found' });
    }

    return NextResponse.json({ status: manager.status || 'active' });
  } catch (error) {
    console.error('Manager check-status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

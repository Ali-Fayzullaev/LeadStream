'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }
  return (
    <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
      <LogOut className="size-4" />
    </Button>
  );
}

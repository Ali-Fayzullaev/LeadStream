'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Power, Loader2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface Streamer {
  id: string;
  name: string;
  ref_code: string;
  is_active: boolean;
  orders_count: number;
  revenue: number;
}

export default function StreamersPage() {
  const [items, setItems] = useState<Streamer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/streamers').then((r) => r.json());
    setItems(r.streamers ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/streamers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, refCode: refCode || undefined }),
    });
    setCreating(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error ?? 'Failed to create');
      return;
    }
    toast.success('Streamer added');
    setName('');
    setRefCode('');
    void load();
  }

  async function toggle(s: Streamer) {
    const res = await fetch(`/api/streamers/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.is_active }),
    });
    if (!res.ok) {
      toast.error('Failed to update');
      return;
    }
    void load();
  }

  async function remove(s: Streamer) {
    if (!confirm(`Delete ${s.name}? Orders will keep their data but lose attribution.`)) return;
    const res = await fetch(`/api/streamers/${s.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Deleted');
    void load();
  }

  function copyLink(refCode: string) {
    const url = `${window.location.origin}/?ref=${refCode}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied'));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Streamers</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add streamer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ref">Ref code (optional)</Label>
              <Input
                id="ref"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                placeholder="auto-generated from name"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating} className="w-full md:w-auto">
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All streamers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Ref link</th>
                  <th className="py-2 pr-4">Orders</th>
                  <th className="py-2 pr-4">Revenue</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => copyLink(s.ref_code)}
                        className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs hover:bg-accent"
                      >
                        ?ref={s.ref_code} <Copy className="size-3" />
                      </button>
                    </td>
                    <td className="py-3 pr-4">{s.orders_count}</td>
                    <td className="py-3 pr-4">{formatCurrency(Number(s.revenue))}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          s.is_active
                            ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
                            : 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                        }
                      >
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggle(s)}>
                          <Power className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No streamers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

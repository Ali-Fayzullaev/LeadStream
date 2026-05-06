'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface City { id: string; name: string; slug: string; is_active: boolean; }

async function fetchCities(): Promise<City[]> {
  const res = await fetch('/api/admin/cities');
  if (!res.ok) return [];
  return res.json();
}

export function CitiesSection() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    fetchCities().then(data => { setCities(data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const res = await fetch('/api/admin/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), slug }),
    });
    setAdding(false);
    if (res.ok) {
      toast.success('Город добавлен');
      setNewName('');
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? 'Ошибка добавления города');
    }
  };

  const handleToggle = async (city: City) => {
    const res = await fetch(`/api/admin/cities/${city.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !city.is_active }),
    });
    if (res.ok) { toast.success('Обновлено'); load(); }
    else toast.error('Ошибка');
  };

  const handleDelete = async (city: City) => {
    if (!confirm(`Удалить город "${city.name}"?`)) return;
    const res = await fetch(`/api/admin/cities/${city.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Город удалён'); load(); }
    else toast.error('Ошибка удаления');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          Города
        </CardTitle>
        <CardDescription>
          Управление городами. Лиды распределяются по менеджерам в зависимости от выбранного клиентом города.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="city-name">Название города</Label>
            <Input
              id="city-name"
              placeholder="Алматы"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={adding}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={adding || !newName.trim()}>
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Добавить
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="size-4 animate-spin" />Загрузка...
          </div>
        ) : cities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Городов нет. Добавьте первый город.</p>
        ) : (
          <div className="space-y-2">
            {cities.map(city => (
              <div key={city.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{city.name}</span>
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{city.slug}</code>
                  <Badge
                    className={city.is_active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}
                    variant="secondary"
                  >
                    {city.is_active ? 'Активен' : 'Скрыт'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(city)}
                    className="text-xs"
                  >
                    {city.is_active ? 'Скрыть' : 'Показать'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(city)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

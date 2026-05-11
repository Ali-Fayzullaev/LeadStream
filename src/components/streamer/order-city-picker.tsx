'use client';

import { useState, useTransition } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { assignCityToOrderAction } from '@/app/streamer/actions';
import { Button } from '@/components/ui/button';

/**
 * Inline city picker for ONE unassigned order in the streamer cabinet.
 *
 * Used on `/streamer/orders` for rows where `city_id IS NULL`. The streamer
 * selects a city and the action will:
 *   1. Set the city on the order.
 *   2. Find the right manager + broker and notify them via Telegram.
 *
 * Once a city is set the row will simply render the city name on the next
 * server render — no editing afterwards (admin can change it if needed).
 */
export function OrderCityPicker({
  orderId,
  cities,
}: {
  orderId: string;
  cities: { id: string; name: string }[];
}) {
  const [cityId, setCityId] = useState<string>('');
  const [pending, startTransition] = useTransition();

  const handleAssign = () => {
    if (!cityId) {
      toast.error('Выберите город');
      return;
    }
    startTransition(async () => {
      const res = await assignCityToOrderAction(orderId, cityId);
      if (res.ok) {
        toast.success('Город назначен — заявка передана менеджеру и брокеру.');
        // The server action revalidates `/streamer/orders` — Next.js will
        // re-render the row with the new city, replacing this picker.
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={cityId}
        onChange={(e) => setCityId(e.target.value)}
        disabled={pending}
        className="h-8 rounded-md border bg-background px-2 text-xs"
      >
        <option value="">— Выберите город —</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="default"
        onClick={handleAssign}
        disabled={pending || !cityId}
        className="h-8"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <MapPin className="mr-1 h-3 w-3" />
            Назначить
          </>
        )}
      </Button>
    </div>
  );
}

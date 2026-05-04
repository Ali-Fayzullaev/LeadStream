'use client';

import { useTransition } from 'react';
import { Shuffle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { autoDistributeUnassignedOrdersAction } from '@/app/manager/actions';

/**
 * Admin button that round-robins all currently unassigned orders to active managers.
 * Equal distribution: 9 orders / 3 managers = 3 each.
 */
export function AutoDistributeButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const onClick = () => {
    if (pending) return;
    if (!confirm('Распределить все нераспределённые заявки между активными менеджерами?')) return;

    start(async () => {
      const res = await autoDistributeUnassignedOrdersAction();
      if (!res.success) {
        toast.error(res.error ?? 'Не удалось распределить заявки');
        return;
      }
      const assigned = res.assigned ?? 0;
      if (assigned === 0) {
        toast.info(res.message ?? 'Нет нераспределённых заявок');
        return;
      }
      toast.success(res.message ?? `Распределено ${assigned} заявок`);
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="gap-2"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Shuffle className="size-4" />}
      Распределить заявки
    </Button>
  );
}

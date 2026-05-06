'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, UserCheck, UserX, ChevronDown } from 'lucide-react';
import { assignBrokerToOrderAction } from '@/app/manager/actions';

interface BrokerOption {
  id: string;
  display_name: string;
}

interface BrokerAssignerProps {
  orderId: string;
  currentBrokerId: string | null;
  currentBrokerName: string | null;
  brokers: BrokerOption[];
}

export function BrokerAssigner({
  orderId,
  currentBrokerId,
  currentBrokerName,
  brokers,
}: BrokerAssignerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const handleSelect = (brokerId: string | null) => {
    if (brokerId === (currentBrokerId ?? null)) {
      setOpen(false);
      return;
    }
    start(async () => {
      const res = await assignBrokerToOrderAction(orderId, brokerId);
      if (res.success) {
        toast.success(brokerId ? 'Брокер назначен' : 'Брокер снят');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Не удалось назначить брокера');
      }
    });
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50 ${
          currentBrokerName
            ? 'border-input bg-background'
            : 'border-orange-500/40 bg-orange-500/5 text-orange-600 hover:bg-orange-500/10'
        }`}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : currentBrokerName ? (
          <>
            <UserCheck className="size-3" />
            <span className="max-w-[100px] truncate">{currentBrokerName}</span>
          </>
        ) : (
          <>
            <UserX className="size-3" />
            <span>Назначить</span>
          </>
        )}
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover p-1 shadow-md">
            {brokers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                У вас нет брокеров.
                <br />
                Добавьте их в разделе «Брокеры».
              </div>
            ) : (
              <>
                {currentBrokerId && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-orange-600 hover:bg-orange-500/10"
                  >
                    <UserX className="size-3.5" />
                    Снять брокера
                  </button>
                )}
                <div className="my-1 h-px bg-border" />
                {brokers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                      b.id === currentBrokerId ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <UserCheck className="size-3.5" />
                    {b.display_name}
                    {b.id === currentBrokerId && (
                      <span className="ml-auto text-[10px] text-muted-foreground">текущий</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

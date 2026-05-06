'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import { updateBrokerOrderStatusAction } from '@/app/broker/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/status-badge';

interface Props {
  orderId: string;
  currentStatus: string;
  currentStatusLabel: string;
  currentStatusColor: string;
  availableStatuses: Array<{ key: string; label: string; color: string }>;
}

export function BrokerOrderStatusUpdater({
  orderId,
  currentStatus,
  currentStatusLabel,
  currentStatusColor,
  availableStatuses,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setError('');
    startTransition(async () => {
      const res = await updateBrokerOrderStatusAction(orderId, newStatus);
      if (res.success) {
        toast.success('Статус обновлён');
        router.refresh();
      } else {
        const msg = res.error || 'Ошибка при обновлении статуса';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="gap-2 h-auto px-2 py-1"
          >
            <StatusBadge label={currentStatusLabel} color={currentStatusColor} size="sm" />
            <ChevronDown className="size-3" />
            {pending && <Loader2 className="size-3 animate-spin" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[150px]">
          {availableStatuses.map((status) => (
            <DropdownMenuItem
              key={status.key}
              onClick={() => handleStatusChange(status.key)}
              disabled={status.key === currentStatus || pending}
            >
              <StatusBadge label={status.label} color={status.color} size="sm" className="mr-2" />
              {status.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

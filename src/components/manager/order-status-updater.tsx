'use client';

import { useState } from 'react';
import { updateOrderStatusAction } from '@/app/manager/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
  currentStatusLabel: string;
  currentStatusColor: string;
  availableStatuses: Array<{ key: string; label: string; color: string }>;
}

export function OrderStatusUpdater({
  orderId,
  currentStatus,
  currentStatusLabel,
  currentStatusColor,
  availableStatuses,
}: OrderStatusUpdaterProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    setError('');

    const result = await updateOrderStatusAction(orderId, newStatus);

    if (!result.success) {
      setError(result.error || 'Ошибка при обновлении статуса');
    }

    setLoading(false);
  };

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="gap-2 h-auto px-2 py-1"
          >
            <StatusBadge label={currentStatusLabel} color={currentStatusColor} size="sm" />
            <ChevronDown className="size-3" />
            {loading && <Loader2 className="size-3 animate-spin" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[150px]">
          {availableStatuses.map((status) => (
            <DropdownMenuItem
              key={status.key}
              onClick={() => handleStatusChange(status.key)}
              disabled={status.key === currentStatus || loading}
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

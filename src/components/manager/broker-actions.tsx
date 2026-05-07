'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal, Power, Ban, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  updateBrokerStatusAction,
  deleteBrokerAction,
} from '@/app/broker/actions';

type Status = 'active' | 'inactive' | 'blocked';

interface Props {
  brokerId: string;
  brokerName: string;
  currentStatus: Status;
  activeOrdersCount: number;
}

export function BrokerActions({
  brokerId,
  brokerName,
  currentStatus,
  activeOrdersCount,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setStatus = (status: Status) => {
    start(async () => {
      const res = await updateBrokerStatusAction(brokerId, status);
      if (res.success) {
        toast.success(
          status === 'active'
            ? 'Брокер активирован'
            : status === 'blocked'
              ? 'Брокер заблокирован'
              : 'Брокер деактивирован',
        );
        router.refresh();
      } else {
        toast.error(res.error ?? 'Не удалось изменить статус');
      }
    });
  };

  const remove = () => {
    start(async () => {
      const res = await deleteBrokerAction(brokerId);
      if (res.success) {
        toast.success(`Брокер «${brokerName}» удалён`);
        setConfirmDelete(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Не удалось удалить брокера');
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            className="size-8"
            aria-label="Действия"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Действия</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {currentStatus !== 'active' && (
            <DropdownMenuItem
              onClick={() => setStatus('active')}
              className="text-emerald-700 focus:text-emerald-700"
            >
              <CheckCircle2 className="mr-2 size-4" />
              Активировать
            </DropdownMenuItem>
          )}

          {currentStatus !== 'inactive' && (
            <DropdownMenuItem onClick={() => setStatus('inactive')}>
              <Power className="mr-2 size-4" />
              Деактивировать
            </DropdownMenuItem>
          )}

          {currentStatus !== 'blocked' && (
            <DropdownMenuItem
              onClick={() => setStatus('blocked')}
              className="text-amber-700 focus:text-amber-700"
            >
              <Ban className="mr-2 size-4" />
              Заблокировать
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить брокера?</AlertDialogTitle>
            <AlertDialogDescription>
              Брокер <strong>{brokerName}</strong> будет удалён безвозвратно.
              Его аккаунт не сможет войти в систему.
              {activeOrdersCount > 0 && (
                <>
                  <br />
                  <br />
                  <strong className="text-amber-700">
                    ⚠ У брокера {activeOrdersCount}{' '}
                    {activeOrdersCount === 1 ? 'активный лид' : 'активных лидов'}.
                  </strong>{' '}
                  Они будут возвращены в общий пул (без брокера) и доступны вам для
                  переназначения.
                  <br />
                  <br />
                  💡 Если вы хотите временно отключить — выберите{' '}
                  <strong>«Заблокировать»</strong> вместо удаления.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

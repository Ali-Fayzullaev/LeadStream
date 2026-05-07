'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

const DROPDOWN_MAX_HEIGHT = 260; // px — максимальная высота списка
const DROPDOWN_OFFSET = 4;       // px — отступ от кнопки

interface DropdownPos {
  // Все координаты — в viewport-пространстве (для position:fixed)
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  maxHeight: number;
  openUp: boolean;
}

function calcPosition(btn: HTMLButtonElement): DropdownPos {
  // getBoundingClientRect() возвращает координаты ОТНОСИТЕЛЬНО VIEWPORT
  // Для position:fixed это именно то, что нужно — НЕ прибавляем scrollY/scrollX
  const rect = btn.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;
  const minWidth = Math.max(rect.width, 180);

  // Открываем вверх, если снизу меньше 180px
  const openUp = spaceBelow < 180;

  // Не выходим за правый край экрана
  const left = Math.min(rect.left, viewportW - minWidth - 8);

  if (openUp) {
    return {
      // bottom = расстояние от низа viewport до верха кнопки (viewport coords)
      bottom: viewportH - rect.top + DROPDOWN_OFFSET,
      left,
      minWidth,
      maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, spaceAbove - 8),
      openUp: true,
    };
  }

  return {
    top: rect.bottom + DROPDOWN_OFFSET,
    left,
    minWidth,
    maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, spaceBelow - 8),
    openUp: false,
  };
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
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const update = () => {
      if (buttonRef.current) setPos(calcPosition(buttonRef.current));
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

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
        ref={buttonRef}
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
        <ChevronDown
          className={`size-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && mounted && pos && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            className="fixed z-50 rounded-md border bg-popover p-1 shadow-lg"
            style={{
              ...(pos.openUp
                ? { bottom: pos.bottom }
                : { top: pos.top }),
              left: pos.left,
              minWidth: pos.minWidth,
              maxHeight: pos.maxHeight,
              overflowY: 'auto',
            }}
          >
            {brokers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                У вас нет брокеров.
                <br />
                Добавьте их в разделе «Брокеры».
              </div>
            ) : (
              <>
                {currentBrokerId && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelect(null)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-orange-600 hover:bg-orange-500/10"
                    >
                      <UserX className="size-3.5 shrink-0" />
                      Снять брокера
                    </button>
                    <div className="my-1 h-px bg-border" />
                  </>
                )}

                {brokers.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                      b.id === currentBrokerId ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    <UserCheck className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate">{b.display_name}</span>
                    {b.id === currentBrokerId && (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        текущий
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

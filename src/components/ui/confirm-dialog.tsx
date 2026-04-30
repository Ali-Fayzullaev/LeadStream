'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'default',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const isDestructive = variant === 'destructive';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-lg border bg-background shadow-xl animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={
                isDestructive
                  ? 'size-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0'
                  : 'size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0'
              }
            >
              <AlertTriangle
                className={isDestructive ? 'size-5 text-destructive' : 'size-5 text-primary'}
              />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h3 id="confirm-dialog-title" className="text-base font-semibold">
                {title}
              </h3>
              {description && (
                <div className="text-sm text-muted-foreground">{description}</div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button
              variant={isDestructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

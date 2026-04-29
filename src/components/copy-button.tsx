'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CopyButton({ value, className, label, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Button type="button" size={size} variant="outline" onClick={onClick} className={cn(className)}>
      {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  );
}

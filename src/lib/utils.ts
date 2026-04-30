import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'KZT') {
  // ru-KZ → "1 234 ₸" (familiar Russian-style spaces with the ₸ symbol).
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-KZ').format(value);
}

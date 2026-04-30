interface StatusBadgeProps {
  label: string;
  color: string;          // hex like #3b82f6
  size?: 'sm' | 'md';
}

/**
 * Pill-style badge that renders any status with its custom HEX color.
 * Uses inline styles so colors can be fully dynamic (Tailwind compile-time
 * cannot generate arbitrary classes).
 */
export function StatusBadge({ label, color, size = 'sm' }: StatusBadgeProps) {
  const cls = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${cls}`}
      style={{
        color,
        backgroundColor: `${color}1a`,   // ~10% alpha
        borderColor: `${color}4d`,       // ~30% alpha
      }}
    >
      {label}
    </span>
  );
}

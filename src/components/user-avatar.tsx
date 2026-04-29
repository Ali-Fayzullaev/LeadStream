import Image from 'next/image';

interface UserAvatarProps {
  name: string | null;
  avatarUrl: string | null;
  size?: number;
}

/**
 * Circular avatar: shows photo if URL exists, otherwise first letter of name.
 */
export function UserAvatar({ name, avatarUrl, size = 28 }: UserAvatarProps) {
  const initial = (name ?? '?')[0].toUpperCase();
  const cls = `rounded-full object-cover shrink-0 bg-muted flex items-center justify-center overflow-hidden`;
  const style = { width: size, height: size, minWidth: size } as React.CSSProperties;

  if (avatarUrl) {
    return (
      <span className={cls} style={style}>
        <Image
          src={avatarUrl}
          alt={name ?? ''}
          width={size}
          height={size}
          className="rounded-full object-cover"
          unoptimized
        />
      </span>
    );
  }

  return (
    <span
      className={`${cls} bg-primary/10 text-primary font-semibold select-none inline-flex items-center justify-center`}
      style={{ ...style, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}

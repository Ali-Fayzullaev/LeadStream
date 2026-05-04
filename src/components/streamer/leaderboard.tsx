import { Crown, Medal, Trophy } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { formatCurrency, cn } from '@/lib/utils';

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  revenue: number;
  orders_count: number;
}

interface StreamerLeaderboardProps {
  entries: LeaderboardEntry[];
  currentStreamerId: string;
}

const RANK_STYLES = [
  {
    bg: 'bg-gradient-to-r from-amber-500/25 via-yellow-400/10 to-transparent',
    border: 'border-amber-400/60',
    badge: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950',
    icon: <Crown className="size-3.5" />,
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.3)]',
  },
  {
    bg: 'bg-gradient-to-r from-slate-300/20 via-zinc-200/10 to-transparent',
    border: 'border-slate-300/50',
    badge: 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-950',
    icon: <Medal className="size-3.5" />,
    glow: 'shadow-[0_0_16px_rgba(148,163,184,0.25)]',
  },
  {
    bg: 'bg-gradient-to-r from-orange-600/20 via-orange-500/10 to-transparent',
    border: 'border-orange-500/50',
    badge: 'bg-gradient-to-br from-orange-500 to-orange-700 text-white',
    icon: <Trophy className="size-3.5" />,
    glow: 'shadow-[0_0_16px_rgba(234,88,12,0.25)]',
  },
];

function RankNumber({ rank }: { rank: number }) {
  if (rank <= 3) {
    const s = RANK_STYLES[rank - 1];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
          s.badge,
        )}
      >
        {s.icon}#{rank}
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {rank}
    </span>
  );
}
const getMaskedName = (name: string | null | undefined) => {
  if (!name) return '?';

  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed; // Короткие имена показываем полностью

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  const stars = '******';

  return `${first}${stars}${last}`;
};

function BarFill({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StreamerLeaderboard({ entries, currentStreamerId }: StreamerLeaderboardProps) {
  // Rank by orders_count (заявки), tiebreak by revenue.
  const sorted = [...entries]
    .sort((a, b) => {
      if (b.orders_count !== a.orders_count) return b.orders_count - a.orders_count;
      return b.revenue - a.revenue;
    })
    .slice(0, 10);

  const myRank = sorted.findIndex((e) => e.id === currentStreamerId) + 1;
  const isOnBoard = myRank > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Ваше место в рейтинге</p>
          <p className="text-2xl font-black text-amber-500 tabular-nums">{isOnBoard ? `#${myRank}` : '—'}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Место</th>
              <th className="text-left px-4 py-2 font-medium">Стример</th>
              <th className="text-right px-4 py-2 font-medium">Заявки</th>
              <th className="text-right px-4 py-2 font-medium">Выручка</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.id === currentStreamerId;
              const style = rank <= 3 ? RANK_STYLES[rank - 1] : null;

              return (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-t',
                    isMe && 'bg-amber-500/10',
                    !isMe && style?.bg,
                  )}
                >
                  <td className="px-4 py-2">
                    <RankNumber rank={rank} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={entry.display_name} avatarUrl={entry.avatar_url ?? null} size={28} />
                      <span className={cn('truncate font-medium', isMe && 'text-amber-500')}>
                        {isMe ? `${(entry.display_name)} (вы)` : getMaskedName(entry.display_name)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">
                    {entry.orders_count}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(entry.revenue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <Trophy className="size-8 opacity-30" />
          <p>Пока никто не в рейтинге</p>
        </div>
      )}
    </div>
  );
}

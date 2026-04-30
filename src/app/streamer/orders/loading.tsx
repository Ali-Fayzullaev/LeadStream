import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function StreamerOrdersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="p-0">
          <Skeleton className="h-10 w-full rounded-none" />
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

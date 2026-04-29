import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

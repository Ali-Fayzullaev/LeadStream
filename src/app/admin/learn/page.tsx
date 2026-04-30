import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import {
  LearnLessonsManager,
  type LessonRow,
} from '@/components/admin/learn-lessons-manager';
import { GraduationCap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLearnPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('learn_lessons')
    .select('id, title, description, youtube_url, body, sort_order, is_published, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  const rows: LessonRow[] = (data ?? []) as LessonRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Обучение"
        description="Управляйте видео-уроками и материалами для стримеров."
      />

      <Card className="bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-transparent ring-1 ring-violet-500/20">
        <CardContent className="p-5 flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <GraduationCap className="size-5" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">Как это работает</p>
            <p className="text-muted-foreground">
              Добавьте ссылку на YouTube — система автоматически извлечёт видео и
              покажет его стримерам в разделе «Обучение». Снимите галочку «Опубликован»,
              чтобы временно скрыть урок.
            </p>
          </div>
        </CardContent>
      </Card>

      <LearnLessonsManager initial={rows} />
    </div>
  );
}

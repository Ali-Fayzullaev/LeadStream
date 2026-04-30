import {
  GraduationCap,
  Mic,
  ListChecks,
  AlertTriangle,
  Lightbulb,
  Quote,
  PlayCircle,
  Hash,
  ArrowRight,
  ShieldCheck,
  Megaphone,
  Youtube,
} from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getYoutubeEmbedUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

interface Section {
  id: string;
  title: string;
  description: string;
}

const SECTIONS: Section[] = [
  { id: 'videos', title: 'Видео-уроки', description: 'Свежие записи от команды.' },
  { id: 'basics', title: 'Основы', description: 'Главные правила любого эфира.' },
  { id: 'script', title: 'Что говорить в эфире', description: 'Готовые фразы и сценарий.' },
  { id: 'objections', title: 'Работа с возражениями', description: 'Как закрывать «дорого» и «подумаю».' },
  { id: 'mistakes', title: 'Чего избегать', description: 'Типичные ошибки начинающих.' },
  { id: 'checklist', title: 'Чек-лист перед эфиром', description: 'Проверьте перед стартом.' },
];

interface LessonView {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string | null;
  body: string | null;
  embed: string | null;
}

export default async function StreamerLearnPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('learn_lessons')
    .select('id, title, description, youtube_url, body, sort_order, created_at, is_published')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  const lessons: LessonView[] = (data ?? []).map((l) => ({
    id: l.id as string,
    title: l.title as string,
    description: (l.description as string | null) ?? null,
    youtube_url: (l.youtube_url as string | null) ?? null,
    body: (l.body as string | null) ?? null,
    embed: getYoutubeEmbedUrl(l.youtube_url as string | null),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Обучение стримеров"
        description="Сценарии, фразы и приёмы, которые увеличивают конверсию из эфира в заказ."
      />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 p-6 sm:p-8 text-white shadow-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-fuchsia-300/20 blur-3xl"
        />
        <div className="relative flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <GraduationCap className="size-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Превратите эфир в поток заказов
            </h2>
            <p className="text-white/85 max-w-2xl">
              Хороший стрим — это не «продажа в лоб». Это история, азарт и реферальная ссылка в нужный
              момент. Ниже — рабочая методичка: говорите так — и зрители будут заказывать.
            </p>
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <Hash className="size-3 text-muted-foreground" />
              {s.title}
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Videos (admin-managed) */}
      <SectionAnchor id="videos" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-rose-500" />
            Видео-уроки
          </CardTitle>
          <CardDescription>
            {lessons.length > 0
              ? 'Подборка обучающих видео от команды.'
              : 'Видео скоро появятся — следите за обновлениями.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Пока нет опубликованных уроков. Загляните позже.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {lessons.map((l) => (
                <div key={l.id} className="space-y-2">
                  {l.embed ? (
                    <div className="aspect-video overflow-hidden rounded-lg ring-1 ring-border bg-black">
                      <iframe
                        src={l.embed}
                        title={l.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="size-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video flex items-center justify-center rounded-lg ring-1 ring-border bg-muted text-muted-foreground">
                      <Youtube className="size-8" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold leading-snug">{l.title}</h3>
                    {l.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>
                    )}
                    {l.body && (
                      <p className="mt-2 text-sm whitespace-pre-line text-foreground/80">{l.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Basics */}
      <SectionAnchor id="basics" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-500" />
            Основы хорошего эфира
          </CardTitle>
          <CardDescription>Соблюдайте эти 5 правил — конверсия вырастет в разы.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {BASICS.map((b, i) => (
            <RuleCard key={i} index={i + 1} title={b.title} body={b.body} />
          ))}
        </CardContent>
      </Card>

      {/* Script */}
      <SectionAnchor id="script" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="size-5 text-fuchsia-500" />
            Что говорить в прямом эфире
          </CardTitle>
          <CardDescription>
            Сценарий из четырёх блоков. Повторяйте упоминание ссылки каждые 5–7 минут.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SCRIPT.map((step) => (
            <ScriptStep key={step.tag} {...step} />
          ))}
        </CardContent>
      </Card>

      {/* Objections */}
      <SectionAnchor id="objections" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-sky-500" />
            Работа с возражениями
          </CardTitle>
          <CardDescription>
            Когда зритель пишет «дорого», «подумаю», «а вдруг не приедет» — отвечайте уверенно.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OBJECTIONS.map((o) => (
            <ObjectionRow key={o.q} {...o} />
          ))}
        </CardContent>
      </Card>

      {/* Mistakes */}
      <SectionAnchor id="mistakes" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Чего избегать
          </CardTitle>
          <CardDescription>Эти ошибки убивают конверсию даже при огромном онлайне.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {MISTAKES.map((m) => (
              <li
                key={m}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                </span>
                <span className="text-sm">{m}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Checklist */}
      <SectionAnchor id="checklist" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-violet-500" />
            Чек-лист перед эфиром
          </CardTitle>
          <CardDescription>За 10 минут до старта пробегите глазами этот список.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST.map((c) => (
              <li
                key={c}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm"
              >
                <span className="inline-flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pro tip */}
      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white">
            <Lightbulb className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Pro-совет</p>
            <p className="text-sm text-muted-foreground">
              Закрепите свою реф-ссылку в описании TikTok-профиля и в закреплённом комментарии под
              видео. 30–40% заказов приходят не во время эфира, а в течение следующих суток — когда
              зрители возвращаются досмотреть.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <div id={id} className="-mt-4 pt-4" aria-hidden />;
}

function RuleCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/30">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-semibold tabular-nums">
          {index}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

interface ScriptStepProps {
  tag: string;
  title: string;
  goal: string;
  phrases: string[];
}

function ScriptStep({ tag, title, goal, phrases }: ScriptStepProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
        <span className="inline-flex size-7 items-center justify-center rounded-md bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400">
          <PlayCircle className="size-4" />
        </span>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {tag}
          </div>
          <div className="font-semibold">{title}</div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm">
          <span className="font-medium text-foreground">Цель: </span>
          <span className="text-muted-foreground">{goal}</span>
        </p>
        <div className="space-y-2">
          {phrases.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-md border-l-2 border-fuchsia-500 bg-fuchsia-500/5 px-3 py-2 text-sm italic"
            >
              <Quote className="size-4 shrink-0 mt-0.5 text-fuchsia-500" />
              <span>«{p}»</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ObjectionRow({ q, a }: { q: string; a: string }) {
  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_2fr] sm:items-start">
      <div className="text-sm">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Возражение
        </div>
        <p className="mt-0.5 font-medium">{q}</p>
      </div>
      <ArrowRight className="hidden size-4 self-center text-muted-foreground sm:inline" />
      <div className="text-sm">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Ответ стримера
        </div>
        <p className="mt-0.5 text-muted-foreground">{a}</p>
      </div>
    </div>
  );
}

// =============================================================================
// Content
// =============================================================================

const BASICS = [
  {
    title: 'Энергия выше среднего',
    body: 'Зрители заходят на яркие эфиры. Улыбайтесь, говорите громче и быстрее, чем в обычной речи.',
  },
  {
    title: 'Один эфир = один товар',
    body: 'Не размывайте внимание. Сфокусируйтесь на 1–2 продуктах за стрим, повторяйте их регулярно.',
  },
  {
    title: 'Ссылка — каждые 5–7 минут',
    body: 'Новые зрители заходят постоянно. Каждые несколько минут проговаривайте, где взять ссылку.',
  },
  {
    title: 'Социальное доказательство',
    body: 'Показывайте отзывы, фото клиентов, говорите «уже 12 человек заказали за этот эфир».',
  },
  {
    title: 'CTA в каждом блоке',
    body: 'Заканчивайте каждый смысловой блок призывом: «жми ссылку», «оставь номер», «закажи сейчас».',
  },
];

const SCRIPT: ScriptStepProps[] = [
  {
    tag: 'Шаг 1',
    title: 'Открытие эфира',
    goal: 'Зацепить зрителей в первые 30 секунд и удержать.',
    phrases: [
      'Всем привет! Сегодня покажу товар, который реально решает проблему — и сделаю это с особой скидкой только для эфира.',
      'Ставьте лайки, чтобы алгоритм поднял эфир в топ. И залетайте в комментарии — расскажу, как получить лучшую цену.',
    ],
  },
  {
    tag: 'Шаг 2',
    title: 'Презентация товара',
    goal: 'Показать ценность, а не характеристики. Решение проблемы зрителя.',
    phrases: [
      'Смотрите — вот эта штука экономит вам час каждый день. Час! За неделю — это полноценный выходной.',
      'Я сам пользуюсь уже месяц, и реально не понимаю, как жил без неё.',
    ],
  },
  {
    tag: 'Шаг 3',
    title: 'Призыв к действию + ссылка',
    goal: 'Перевести зрителя на форму заказа по реферальной ссылке.',
    phrases: [
      'Чтобы заказать — переходите по моей ссылке в шапке профиля или в закреплённом комментарии. Только по ней работает скидка.',
      'Заказали — киньте «+» в чат, я зачитаю ваше имя в эфире.',
    ],
  },
  {
    tag: 'Шаг 4',
    title: 'Закрепление и FOMO',
    goal: 'Создать дефицит и срочность. Повторить ссылку.',
    phrases: [
      'Внимание: цена держится только до конца эфира. Через час — обратно в обычный прайс.',
      'Осталось ограниченное количество. Кто колеблется — заказывайте сейчас, потом не успеете.',
    ],
  },
];

const OBJECTIONS = [
  {
    q: 'Дорого',
    a: 'Понимаю. Но смотрите: если разделить на месяц использования — это меньше чашки кофе в день. И сегодня в эфире скидка 20%, такой цены больше не будет.',
  },
  {
    q: 'Я подумаю',
    a: 'Подумайте, конечно. Только цена в эфире — самая низкая. Завтра она вернётся. Если сомневаетесь — закажите, у вас есть 14 дней на возврат.',
  },
  {
    q: 'А вдруг не приедет / некачественный',
    a: 'Заказы идут через проверенный сервис, есть полный возврат, если что-то не так. Уже сотни довольных клиентов — почитайте отзывы под закреплённым видео.',
  },
  {
    q: 'У друга такое же',
    a: 'Так это отлично — значит, вы уже знаете, что вещь рабочая. По моей ссылке цена дешевле, чем в магазине. Зачем платить больше?',
  },
];

const MISTAKES = [
  'Длинные монологи без обращения к чату — зрители быстро уходят.',
  'Не упоминать ссылку в начале и середине эфира — забудут, где заказывать.',
  'Извиняться за «продажность» — продажа это нормально, не оправдывайтесь.',
  'Молчать, когда нет зрителей — продолжайте говорить, эфир должен жить.',
  'Спорить с хейтерами — банить молча и идти дальше.',
  'Не перезванивать клиентам, которые оставили заявку — теряете 30% заказов.',
];

const CHECKLIST = [
  'Свет: лицо хорошо освещено, без теней',
  'Звук: микрофон работает, нет эха',
  'Интернет: проверка скорости минимум 5 Мбит/с',
  'Реф-ссылка: вставлена в описание профиля',
  'Закреплённый комментарий: ссылка + краткий призыв',
  'Зарядка телефона выше 80%',
  'Товар под рукой, готов к показу',
  'Стакан воды рядом',
];

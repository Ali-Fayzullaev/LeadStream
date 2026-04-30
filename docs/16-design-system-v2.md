# 16 — Design System v2 — Техническое задание

> Цель документа: зафиксировать единый язык интерфейса для LeadStream — чтобы каждый экран выглядел профессионально, был удобным и предсказуемым. Документ — источник истины для дизайнера и фронтенд-разработчика.

---

## 1. Принципы

1. **Calm by default.** Интерфейс — рабочий инструмент. Минимум декора, максимум информации с первого взгляда.
2. **One primary action per screen.** Только одна кнопка `default`/primary в видимой области; остальные — `secondary`/`ghost`/`outline`.
3. **Density follows context.** Таблицы — компактные, формы — просторные.
4. **Status is colored, content is neutral.** Цвет — смысловой сигнал (статус, ошибка, успех), а не украшение.
5. **Mobile is not "tablet shrunk".** Каждый сложный экран имеет осознанный мобильный паттерн (карточки вместо таблиц, full-screen sheet вместо модалок).
6. **Accessibility — обязательно.** Контраст ≥ WCAG AA, видимый focus ring, навигация с клавиатуры, семантические роли.

---

## 2. Цветовая палитра

Используются HSL CSS-переменные из `globals.css` — менять только их, не Tailwind-классы.

### 2.1 Семантические токены (light / dark)

| Токен               | Назначение                          |
|---------------------|-------------------------------------|
| `--background`      | Фон страницы                        |
| `--foreground`      | Основной текст                      |
| `--card`            | Фон карточек и таблиц               |
| `--muted`           | Фон второстепенных блоков           |
| `--muted-foreground`| Подписи, метки, second-line текст   |
| `--primary`         | Главное действие (кнопка, ссылка)   |
| `--secondary`       | Дополнительные действия             |
| `--destructive`     | Удаление, ошибки                    |
| `--accent`          | Hover-фон, мягкие подсветки         |
| `--border`          | Границы, разделители                |
| `--ring`            | Focus-кольцо                        |

### 2.2 Status-цвета (для значков статуса заказа)

Хранятся в `order_statuses.color` как HEX. Применяются inline-стилем:

```ts
style={{
  color,
  backgroundColor: `${color}1a`,   // 10% opacity
  borderColor: `${color}4d`,        // 30% opacity
}}
```

Рекомендуемая палитра пресетов (она зашита в `statuses-section.tsx`):

| Цвет     | HEX        | Когда использовать          |
|----------|------------|-----------------------------|
| Blue     | `#3b82f6`  | Новый / черновик            |
| Amber    | `#f59e0b`  | Ожидание / в работе         |
| Indigo   | `#6366f1`  | В пути / отправлен          |
| Green    | `#10b981`  | Готово / выполнен           |
| Red      | `#ef4444`  | Отменён / отказ             |
| Violet   | `#8b5cf6`  | Спец-статус                 |
| Pink     | `#ec4899`  | Маркетинг                   |
| Teal     | `#14b8a6`  | Возврат                     |
| Orange   | `#f97316`  | Срочно                      |
| Slate    | `#64748b`  | Архив / нейтральный         |

---

## 3. Типографика

Используем системный стек (см. `tailwind.config.ts`).

| Класс                     | Применение                       |
|---------------------------|----------------------------------|
| `text-2xl font-bold tracking-tight` | H1 страницы              |
| `text-xl font-semibold`   | H2 секции, CardTitle             |
| `text-base`               | Основной текст / inputs          |
| `text-sm`                 | Таблицы, навигация, хелпы        |
| `text-xs`                 | Бейджи, лейблы метаданных, font-mono артефакты (ID, ref-codes) |
| `font-mono`               | Любые технические строки: ключи, хеши, телефоны (масками), ref-коды |

**Line-height:** Tailwind по умолчанию (`leading-tight` для заголовков, `leading-normal` для текста). Не использовать произвольных `leading-[N]`.

---

## 4. Spacing rhythm (4px база)

Используем шкалу Tailwind. Эталонные интервалы:

| Контекст                         | Spacing                       |
|----------------------------------|-------------------------------|
| Между секциями страницы          | `space-y-6` (24px)            |
| Внутри `Card` (заголовок→контент)| CardHeader/CardContent готовы |
| Поля формы между собой           | `space-y-4` (16px)            |
| Label → Input                    | `space-y-2` (8px)             |
| Inline иконка → текст            | `gap-2` (8px)                 |
| Кнопки рядом                     | `gap-2`                       |
| Контейнер страницы               | `container py-8`              |

**Не использовать `mt-*`** для произвольного отступа — только `space-y-*` на родителе.

---

## 5. Радиусы и тени

| Токен / класс       | Использование                  |
|---------------------|--------------------------------|
| `rounded-sm` (2px)  | Tiny tags                      |
| `rounded-md` (6px)  | Inputs, buttons, badges        |
| `rounded-lg` (8px)  | Cards, tables                  |
| `rounded-full`      | Avatars, status pills, color swatches |

Тени: только `shadow-sm` для карточек по умолчанию. Никаких `shadow-xl`/`drop-shadow-*` — это не landing.

---

## 6. Компоненты

### 6.1 Button (`src/components/ui/button.tsx`)

| variant      | Когда использовать                              |
|--------------|-------------------------------------------------|
| `default`    | Главное действие на экране (макс. 1)            |
| `secondary`  | Альтернативные действия                         |
| `outline`    | Заметная, но не главная (открыть модалку)       |
| `ghost`      | Иконка/inline-действие (отмена, навигация)      |
| `destructive`| Удалить, отозвать                               |

| size         | Когда                                           |
|--------------|-------------------------------------------------|
| `default`    | Формы, тулбары                                  |
| `sm`         | Inline в таблицах/списках                       |
| `icon`       | Иконочные кнопки (use `aria-label`)             |

**Loading state:** добавлять `<Loader2 className="size-4 animate-spin" />` слева от текста и `disabled={pending}`.

### 6.2 Input / Textarea / Label

- Высота `h-10`, padding `px-3`. Никаких custom высот.
- Поле ошибки: `<p className="text-xs text-destructive">{message}</p>` под input'ом.
- `<Label>` обязателен и связан с input'ом через `htmlFor`/`id`.
- Поля-пароли — с toggle-кнопкой `Eye / EyeOff` (см. `password-section.tsx`).

### 6.3 Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>…</CardTitle>
    <CardDescription>…</CardDescription>{/* optional */}
  </CardHeader>
  <CardContent>…</CardContent>
</Card>
```

Card без заголовка — только если содержит сам по себе атомарный паттерн (KPI-кафель).

### 6.4 Badge / StatusBadge

Status-pills отрисовываются через `<StatusBadge label color size? />`. Никаких inline стилей в самих страницах.

Размеры:
- `sm` (по умолчанию для таблиц)
- `md` (для карточек заказа)

### 6.5 Tables

- Скругление `rounded-lg border` на обёртке + `overflow-x-auto`.
- Шапка `bg-muted/40 text-muted-foreground`.
- Строки: `border-t`, hover не нужен (таблицы read-only / редактируемые через явные кнопки).
- Пустое состояние: центрированный `text-sm text-muted-foreground` с короткой подсказкой и (если уместно) primary-кнопкой "Создать первый…".

### 6.6 Avatar

`<UserAvatar name avatarUrl size />` — единственный способ показать пользователя. Если `avatarUrl` пуст — генерируется initials-аватар с устойчивым цветом по имени.

### 6.7 Tabs (используется в `/admin/settings`)

Реализованы как server-side `<Link>` компоненты с `?tab=` query parameter — без клиентского состояния. Активная вкладка: `bg-background shadow-sm`. Неактивная: `text-muted-foreground hover:text-foreground`.

---

## 7. Состояния (states)

| Состояние    | Визуальный сигнал                                             |
|--------------|---------------------------------------------------------------|
| Hover        | `hover:bg-accent` для интерактивных, `hover:text-foreground` для ссылок |
| Focus        | `focus-visible:ring-2 ring-ring ring-offset-2` (есть в Button/Input) |
| Active/Pressed | `active:scale-[0.98]` — только для primary-кнопок (опционально) |
| Disabled     | `opacity-50 cursor-not-allowed pointer-events-none`           |
| Loading      | `Loader2` иконка + `disabled`                                 |
| Error        | `text-destructive` + `aria-invalid="true"` на поле            |
| Success      | toast `sonner` + локальный сброс/refresh                       |

---

## 8. Layout & breakpoints

```
sm  640px   — большие телефоны / маленькие планшеты
md  768px   — планшеты, сюда переключаются 2-колоночные сетки
lg  1024px  — десктоп, сюда — 3-4 колонки
xl  1280px  — широкий десктоп
```

Контейнер: `container mx-auto px-4` с max-width tailwind дефолтом.

**Шапка/nav**: на `sm:` показывает inline-меню; на мобильном — пока только лого + меню-toggle. _(Запланированный апгрейд: hamburger drawer — см. roadmap.)_

---

## 9. Иконки

- Только `lucide-react`.
- Размер `size-4` (16px) — стандарт inline; `size-5` — в крупных кнопках/header'ах; `size-3` / `size-3.5` — для метаданных.
- Никаких разных весов / стилей в одном экране.

---

## 10. Анимации и переходы

- Tailwind defaults: `transition-colors`, `transition-transform`.
- Длительность: `duration-150` (default Tailwind) — для hover; `duration-300` — для shifts/sheets.
- Spinner: `animate-spin` на `Loader2`.
- НЕ использовать parallax, decorative scroll-effects, сложные framer-motion.

---

## 11. Уведомления (Toaster / sonner)

Конфигурация — в `providers.tsx`. Рекомендации:
- `position="top-right"` (по умолчанию). _Альтернатива: `bottom-right` если контент в правом верхнем углу часто перекрывается._
- Длительность: success 3s, error 5s.
- Текст — короткий русский: "Профиль сохранён", "Не удалось обновить статус".
- Никогда не показывать stack-trace в toast — только в консоли + дружелюбный текст пользователю.

---

## 12. Доступность

- Все интерактивные элементы достижимы клавиатурой.
- `aria-label` обязателен для icon-кнопок.
- Контраст текста: ≥ 4.5:1 (используем `--foreground` / `--muted-foreground` — они уже calibrated).
- Status-цвет НЕ должен быть единственным каналом смысла — рядом всегда есть текст-лейбл.
- Формы: серверные ошибки выводятся текстом, не только цветом.

---

## 13. Что улучшить (рекомендации к реализации)

Приоритеты по убыванию:

### P0 — обязательно

1. **Empty states.** На странице `/admin/orders` и `/streamer/orders` — добавить иконку + CTA когда заказов 0.
2. **Mobile nav.** Шапка `/admin` и `/streamer` — добавить иконку-меню для xs экранов (sheet/drawer со ссылками).
3. **Confirm-dialog вместо `confirm()`.** Заменить browser confirm в orders-table / statuses-section на стилизованный AlertDialog (shadcn).
4. **Skeleton loaders.** На страницах, где данные грузятся, добавить `<Skeleton />` (компонент уже есть) вместо blank.

### P1 — желательно

5. **Page header pattern.** Единый компонент `<PageHeader title description actions />` — сейчас header рисуется руками на каждой странице.
6. **Filter bar pattern.** На admin/orders фильтры — выделить `<DataFilters>` компонент с кнопкой "Сбросить" и хэш-чипами активных фильтров.
7. **DataTable abstraction.** Унифицировать таблицы (orders, streamers) через единый компонент с props `columns + rows`.
8. **Density toggle.** На таблицах admin — переключатель Comfortable/Compact (`py-2` vs `py-3.5`).

### P2 — nice to have

9. **Command palette** (Cmd+K) для админа: быстрый переход и поиск по заказам/стримерам.
10. **Saved filters / views** для `/admin/orders` (сохранять в localStorage).
11. **Inline-edit для display_name стримера** на странице streamers (без перехода в карточку).
12. **Bulk actions** в orders-table (checkbox + смена статуса для N заказов).

---

## 14. Чеклист перед мержем нового экрана

- [ ] Один primary action на экране
- [ ] Заголовок страницы + подзаголовок-описание
- [ ] Состояния: loading / empty / error / success
- [ ] Адаптивность: проверено на 360px / 768px / 1280px
- [ ] Все клики имеют hover + focus + active состояние
- [ ] Все icon-кнопки имеют `aria-label`
- [ ] Сообщения об ошибках на русском, человеческие
- [ ] Toast при успехе мутации + `router.refresh()` (или revalidate)
- [ ] Серверные данные — RLS-safe (не утекают чужие записи)
- [ ] Никаких console.log / TODO / dead code

---

## 15. Запрещённые паттерны

- ❌ Inline `style` для цветов, кроме status-pills с динамическим HEX из БД.
- ❌ Произвольные пиксельные значения (`text-[13.5px]`, `mt-[7px]`).
- ❌ Несколько primary-кнопок рядом.
- ❌ `alert()` / `confirm()` в production-ветках (кроме временных заглушек, см. рекомендацию P0-3).
- ❌ Английский текст в UI стримера/админа (рабочий язык — русский).
- ❌ Зависимости от browser-only API в server components.

---

_Документ — живой. Любое отклонение от него должно быть осознанным и зафиксировано здесь же в виде поправки._

# 11 · Дизайн-система

Цель: страница выглядит как продукт уровня Stripe / Linear / Vercel.

## 🎨 Палитра

### Light theme
| Токен | HSL | Использование |
|---|---|---|
| `--background` | `0 0% 100%` | фон |
| `--foreground` | `240 10% 3.9%` | текст |
| `--primary` | `262 83% 58%` (фиолетовый) | акцент |
| `--muted` | `240 4.8% 95.9%` | блёклый фон |
| `--border` | `240 5.9% 90%` | границы |
| `--destructive` | `0 84% 60%` | ошибки/удаление |

### Dark theme
| Токен | HSL |
|---|---|
| `--background` | `240 10% 3.9%` |
| `--foreground` | `0 0% 98%` |
| `--primary` | `263 90% 70%` |
| `--card` | `240 10% 6%` |
| `--border` | `240 3.7% 15.9%` |

Все цвета — через CSS-переменные. Tailwind использует их через `bg-background`, `text-foreground` и т.п.

## ✍️ Типографика

- **Шрифт:** Inter (Google Fonts через `next/font`).
- **Размеры (Tailwind):**
  - Hero h1: `text-4xl md:text-6xl font-bold leading-tight`
  - h2: `text-2xl font-bold tracking-tight`
  - body: `text-sm` или `text-base`
  - метрики: `text-3xl font-bold tracking-tight`

## 🔘 Радиус и тени

- `--radius: 0.75rem` (карточки, кнопки).
- Тени тонкие: `shadow-sm` для карточек, `shadow-xl` для героя.

## 🧩 Компоненты (shadcn/ui-стиль)

Копируем код в `src/components/ui/*`, не зависим от npm-пакета.

Базовый набор:
- `Button` (variants: default / outline / ghost / destructive / link; sizes: sm / default / lg / icon)
- `Input`, `Textarea`, `Label`
- `Card` + `CardHeader/Title/Description/Content/Footer`
- `Dialog` (modal), `Dropdown`, `Popover`, `Tabs`
- `Skeleton` (loading-плейсхолдеры)
- `Table` (или TanStack Table для сложных таблиц)
- `Toast` (sonner)

Кастомные:
- `ThemeToggle`
- `RefTracker`
- `OrderForm`
- `StatCard` (с градиентным radial blur)
- `KpiTrend` (число + дельта со стрелкой)
- `DateRangeBar` (Today / Week / Month / All / Custom)
- `StreamerLeaderboard`

## ✨ Эффекты

### Glassmorphism (только на лендинге для формы)
```css
.glass {
  @apply bg-white/60 dark:bg-white/5
         backdrop-blur-xl
         border border-white/40 dark:border-white/10;
}
```

### Gradient text (заголовок героя)
```css
.gradient-text {
  background: linear-gradient(90deg,
    hsl(var(--primary)) 0%, #ec4899 50%, hsl(var(--primary)) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  color: transparent;
  animation: shimmer 6s linear infinite;
}
```

### Grid background pattern
```css
.bg-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border)/0.5) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border)/0.5) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

### Ambient blur (фоновые «звёзды»)
Поверх grid — большие радиальные blur-круги в фирменных цветах.

## 🎬 Анимации

Используем **Framer Motion**:
- Stagger fade-in на mount.
- `whileHover` на карточках статистик: лёгкий tilt + усиление тени.
- `layoutId` для плавных переходов между состояниями (например, форма → success).
- Числа — count-up через простой rAF-таймер.

CSS keyframes:
- `shimmer` (бесконечный градиент).
- `pulse` (точка «Live»).

## 📱 Адаптивность

Mobile-first.
Брейкпоинты Tailwind: `sm:640`, `md:768`, `lg:1024`, `xl:1280`.

Тестирование:
- iPhone SE (375×667) — самый узкий.
- iPad (768).
- 1440 desktop.

Все таблицы в админке — `overflow-x-auto`, чтобы не ломать layout.

## ♿ Доступность

- Контрастность WCAG AA минимум.
- Все интерактивные элементы фокусируются (видимый focus-ring).
- aria-labels на icon-only кнопках.
- alt на всех картинках.
- Семантические теги (`<main>`, `<nav>`, `<header>`).

## 🌐 i18n (на роадмап)

- `next-intl` или `i18next`.
- Языки: RU / EN / UZ.
- Переключатель языка в хедере.
- Дата и валюта через `Intl.*`.

## 🖼 Фавикон и OG

- favicon.ico + apple-touch-icon.png.
- og:image — 1200×630 с логотипом, заголовком, скриншотом дашборда.

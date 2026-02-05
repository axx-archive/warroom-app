# Axxon Labs Design System

**War Room App - Mission Control Interface**

This document covers the CSS design system defined in `src/app/globals.css`. Use these CSS classes and variables for consistent styling.

---

## Color System

### Primary Palette

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#0a0a0a` | Page background |
| `--panel` | `#111111` | Card/panel backgrounds |
| `--text` | `#fafafa` | Primary text |
| `--muted` | `#737373` | Secondary/disabled text |
| `--accent` | `#7c3aed` | Brand purple - primary actions |
| `--accent-light` | `#9f67ff` | Hover states, highlights |

### Text Hierarchy

| Variable | Value | Usage |
|----------|-------|-------|
| `--text-primary` | `var(--text)` | Headings, important content |
| `--text-secondary` | `#a3a3a3` | Supporting text |
| `--text-tertiary` | `var(--muted)` | Labels, captions |
| `--text-ghost` | `#525252` | Placeholder, disabled |

### Status Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--status-success` | `#22c55e` | Success states, complete |
| `--status-warning` | `#f59e0b` | In-progress, warnings |
| `--status-error` | `#ef4444` | Errors, failures |
| `--status-idle` | `var(--muted)` | Idle, inactive |

### Border System

| Variable | Value | Usage |
|----------|-------|-------|
| `--border` | `rgba(255,255,255,0.08)` | Default borders |
| `--border-strong` | `rgba(255,255,255,0.15)` | Emphasized borders |
| `--border-subtle` | `rgba(255,255,255,0.04)` | Minimal separation |
| `--border-accent` | `rgba(124,58,237,0.3)` | Accent-highlighted |
| `--border-accent-strong` | `rgba(124,58,237,0.6)` | Strong accent |

### Background Overlays

| Variable | Usage |
|----------|-------|
| `--bg-hover` | Subtle hover state |
| `--bg-hover-accent` | Accent-tinted hover |
| `--bg-card` | Card background tint |
| `--bg-card-hover` | Card hover state |
| `--bg-card-active` | Card active/selected |
| `--bg-glow` | Radial glow effect |

### Legacy Mappings

The `--amber-*` and `--cyan-*` variables are mapped to accent purple for backward compatibility:

```css
--amber: var(--accent);
--cyan: var(--accent);
```

---

## Typography

### Font Families

```css
--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', Monaco, 'Consolas', monospace;
```

### Typography Classes

| Class | Size | Weight | Usage |
|-------|------|--------|-------|
| `.display` | 36-72px | 700 | Hero text |
| `.h1` | 28-48px | 700 | Page titles |
| `.h2` | 20-32px | 600 | Section headers |
| `.h3` | 16-20px | 600 | Subsection headers |
| `.body` | 15px | 400 | Default text |
| `.small` | 13px | 400 | Captions, meta |
| `.label` | 11px | 500 | Uppercase labels |
| `.mono` | 13px | 400 | Code, data |

### Utility Classes

```html
<!-- Monospace font -->
<span class="font-mono">code_value</span>

<!-- Uppercase label -->
<span class="label-caps">Section Label</span>
<span class="label-caps-accent">Active Label</span>

<!-- Tabular numbers for data -->
<span class="tabular-nums">1,234.56</span>

<!-- Text colors -->
<span class="text-accent">Accent text</span>
<span class="text-muted">Muted text</span>
```

---

## Component Patterns

### Panels

Container elements for grouped content.

```html
<!-- Basic panel -->
<div class="panel">Content</div>

<!-- Panel with header -->
<div class="panel">
  <div class="panel-header">Header with accent line</div>
  <div class="panel-body">Content</div>
</div>

<!-- Elevated panel (with glow) -->
<div class="panel-elevated">Important content</div>

<!-- Bracketed panel (corner accents) -->
<div class="panel-bracketed">Styled content</div>
```

### Cards

Interactive content containers with hover effects.

```html
<!-- Standard card (lifts on hover) -->
<div class="card">
  <div class="card-header">Title</div>
  <div class="card-body">Content</div>
  <div class="card-footer">Actions</div>
</div>

<!-- Static card (no hover) -->
<div class="card--static">Static content</div>
```

### Lane Cards

Used for agent task lanes with status indication.

```html
<!-- Default lane -->
<div class="lane-card">Task content</div>

<!-- Status variants -->
<div class="lane-card lane-complete">Completed task</div>
<div class="lane-card lane-in-progress">Active task</div>
<div class="lane-card lane-failed">Failed task</div>
```

The left border color indicates status:
- Default: `--accent` (purple)
- Complete: `--status-success` (green)
- In-progress: `--status-warning` (amber)
- Failed: `--status-error` (red)

### Task Cards

Task items with expandable accent line on hover.

```html
<div class="task-card">
  <div class="task-card__content">
    <div class="task-card__title">Task Title</div>
    <div class="task-card__meta">Additional info</div>
  </div>
  <div class="task-card__actions">
    <button class="btn btn--sm">Action</button>
  </div>
</div>

<!-- Status variants -->
<div class="task-card task-card--running">...</div>
<div class="task-card task-card--success">...</div>
<div class="task-card task-card--error">...</div>
<div class="task-card task-card--idle">...</div>
```

### Agent Cards

Display agent info with status dot.

```html
<div class="agent-card">
  <div class="agent-card__dot"></div>
  <div class="agent-card__info">
    <div class="agent-card__name">Agent Name</div>
    <div class="agent-card__status">Status text</div>
  </div>
</div>

<!-- Active agent (breathing animation) -->
<div class="agent-card agent-card--active">...</div>
```

---

## Buttons

### Button Classes

```html
<!-- Primary (filled purple) -->
<button class="btn btn--primary">Primary Action</button>

<!-- Secondary (outlined) -->
<button class="btn btn--secondary">Secondary</button>

<!-- Ghost (minimal) -->
<button class="btn btn--ghost">Cancel</button>

<!-- Success -->
<button class="btn btn--success">Confirm</button>

<!-- Danger -->
<button class="btn btn--danger">Delete</button>

<!-- Small variant -->
<button class="btn btn--primary btn--sm">Small</button>

<!-- Icon-only -->
<button class="btn btn--icon">X</button>
```

### Legacy Button Classes

These also work but prefer the BEM variants above:

```html
<button class="btn-primary">Primary</button>
<button class="btn-secondary">Secondary</button>
<button class="btn-ghost">Ghost</button>
<button class="btn-danger">Danger</button>
<button class="btn-success">Success</button>
```

---

## Badges

Status indicators for items.

```html
<!-- With status dot -->
<span class="badge badge--running">
  <span class="badge__dot"></span>
  Running
</span>

<!-- Status variants -->
<span class="badge badge--success">Complete</span>
<span class="badge badge--error">Failed</span>
<span class="badge badge--warning">Pending</span>
<span class="badge badge--idle">Idle</span>
```

### Indicator Dots

Standalone status dots with pulse animation.

```html
<!-- Standard (8px) -->
<span class="indicator-dot indicator-dot-accent"></span>
<span class="indicator-dot indicator-dot-success"></span>
<span class="indicator-dot indicator-dot-danger"></span>

<!-- Small (6px) -->
<span class="indicator-dot indicator-dot--sm indicator-dot-accent"></span>
```

### Agent Badges

Role-specific badges with agent colors.

```html
<span class="agent-badge agent-developer">Developer</span>
<span class="agent-badge agent-architect">Architect</span>
<span class="agent-badge agent-qa-tester">QA</span>
```

Available agent classes:
- `.agent-product-owner` - Purple
- `.agent-architect` - Blue
- `.agent-developer` - Green
- `.agent-staff-engineer` - Indigo
- `.agent-doc-updater` - Accent
- `.agent-techdebt` - Orange
- `.agent-visual-qa` - Pink
- `.agent-qa-tester` - Cyan
- `.agent-security` - Red

---

## Form Elements

### Inputs

```html
<!-- Standard input -->
<input class="input" placeholder="Enter value" />

<!-- Size variants -->
<input class="input input--sm" placeholder="Small" />
<input class="input input--lg" placeholder="Large" />

<!-- Textarea -->
<textarea class="textarea" placeholder="Multi-line input"></textarea>

<!-- Input with action button -->
<div class="input-with-action">
  <input class="input" placeholder="Path" />
  <button class="folder-picker-btn">...</button>
</div>
```

Focus states apply accent purple border and glow automatically.

---

## Progress Indicators

### Linear Progress Bar

```html
<div class="progress">
  <div class="progress__bar" style="width: 75%"></div>
</div>

<!-- Loading state (shimmer animation) -->
<div class="progress progress--loading">
  <div class="progress__bar" style="width: 100%"></div>
</div>
```

### Agent Progress (Circular)

```html
<div class="agent-progress" style="--progress: 75%">
  <div class="agent-progress__inner">
    <span class="agent-progress__value">75%</span>
  </div>
</div>

<!-- Small variant -->
<div class="agent-progress agent-progress--sm" style="--progress: 50%">
  <div class="agent-progress__inner">
    <span class="agent-progress__value">50</span>
  </div>
</div>
```

---

## Agent States

Visual indicators for agent activity.

```html
<!-- States -->
<span class="agent-state agent-state--idle"></span>
<span class="agent-state agent-state--thinking"></span>
<span class="agent-state agent-state--working"></span>
<span class="agent-state agent-state--success"></span>
<span class="agent-state agent-state--error"></span>
<span class="agent-state agent-state--connecting"></span>

<!-- Animated variants -->
<span class="agent-state agent-state--success-pulse"></span>
<span class="agent-state agent-state--error-shake"></span>
```

---

## Modals

```html
<div class="modal-backdrop">
  <div class="modal">
    <div class="modal-header">
      <h2>Modal Title</h2>
      <button class="btn btn--icon">X</button>
    </div>
    <div class="modal-body">
      Content here
    </div>
    <div class="modal-footer">
      <button class="btn btn--ghost">Cancel</button>
      <button class="btn btn--primary">Confirm</button>
    </div>
  </div>
</div>
```

---

## Layout

### Container

```html
<div class="wrap">Max-width 1400px, centered content</div>
<div class="panel-wrap">Full-width with padding</div>
```

### Dashboard Grid

Three-column layout for mission control views.

```html
<div class="dashboard">
  <nav class="sidebar">Left nav</nav>
  <header class="header">Top bar</header>
  <main class="main">Content area</main>
  <aside class="activity-panel">Right panel</aside>
</div>
```

Responsive: collapses to 2-column at 1024px, 1-column at 768px.

### Task List

```html
<!-- Seamless list (1px gaps) -->
<div class="task-list">
  <div class="task-card">...</div>
  <div class="task-card">...</div>
</div>

<!-- Separated list (visible spacing) -->
<div class="task-list task-list--separated">
  <div class="task-card">...</div>
  <div class="task-card">...</div>
</div>
```

---

## Animation Classes

| Class | Effect |
|-------|--------|
| `.reveal` | Fade in + slide up on load |
| `.reveal-stagger` | Children animate in sequence |
| `.pulse` | Gentle scale pulse (status) |
| `.spinner` | 360deg rotation |
| `.agent--active` | Breathing glow effect |
| `.progress--loading` | Shimmer animation |

### Reduced Motion

All animations respect `prefers-reduced-motion: reduce`.

---

## Spacing System

| Variable | Value |
|----------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |
| `--space-3xl` | 64px |

---

## Shadows

| Variable | Usage |
|----------|-------|
| `--shadow-sm` | Subtle depth |
| `--shadow-md` | Cards, dropdowns |
| `--shadow-lg` | Modals, overlays |
| `--shadow-glow` | Accent glow effect |
| `--shadow-agent` | Active agent glow |

---

## Quick Reference

### Common Patterns

```html
<!-- Status indicator with label -->
<div class="flex items-center gap-2">
  <span class="indicator-dot indicator-dot-success"></span>
  <span class="small text-muted">Connected</span>
</div>

<!-- Action bar -->
<div class="flex gap-2">
  <button class="btn btn--ghost">Cancel</button>
  <button class="btn btn--primary">Save</button>
</div>

<!-- Section header -->
<div class="label-caps mb-4">Section Title</div>

<!-- Code display -->
<div class="code-block">
  <code>npm run dev</code>
</div>
```

### Tooltips

```html
<button data-tooltip="Click to save">Save</button>
```

### Dividers

```html
<div class="divider"></div>
<div class="divider-accent"></div>
```

---

## File Location

All styles are defined in:

```
src/app/globals.css
```

The system uses Tailwind CSS v4 with CSS custom properties for theming.

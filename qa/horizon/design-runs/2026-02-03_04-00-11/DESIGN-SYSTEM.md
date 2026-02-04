# Frontend Design Skill — HORIZON

## Design Direction: Dark Command Center

HORIZON is a deal-tracking command center for venture studios. It should feel like piloting a spacecraft, not using a spreadsheet. Think **Linear meets Bloomberg** — dark, fast, information-dense, with moments of visual delight.

### Core Principles

1. **Dark mode is the default** — Light mode is secondary
2. **Speed is a feature** — Everything should feel instant, snappy
3. **Information density done right** — Show more, but organized
4. **Subtle premium touches** — Glows, gradients, micro-animations
5. **Keyboard-first** — Power users live here

### Brand Marker (Not Full Theming)

Don’t “paint” the whole UI with the accent color. Keep the majority of the interface neutral and calm; use Horizon Gold as an explicit, sparse *marker* + *signal*.

- **Most surfaces**: black/white opacity ramps (calm canvas)
- **Gold**: focus rings, selected state, active indicators, small pips/bars (sharp signal)
- **Strong colors** (`--hot`, `--warm`, `--success`, `--info`): reserved for state + urgency

This keeps the app feeling premium and intentional (Stripe/Block sensibility) while letting the UI stay readable at high density.

### View Taxonomy (Consistency Across the App)

Define surfaces so layouts don’t drift page-to-page:

- **Table View (Operate):** dense, scannable, keyboard-friendly; hover reveals actions
- **Context View (Inspect):** right-side drawer for quick inspection/editing without losing place
- **Focus View (Commit):** full-screen modal for multi-step flows (create package, assembly, outreach sequences)

When in doubt: inspect in Context, commit in Focus.

---

## Surface Layer System

HORIZON uses a consistent 4-level surface system to create depth and visual hierarchy without boxing everything:

### Surface Tokens

| Token | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `canvas` | Page background, deepest layer | `oklch(0.985 0.004 90)` | `oklch(0.11 0.01 260)` |
| `surface-1` | Cards, inline panels | `oklch(1 0 0)` (white) | `oklch(0.14 0.01 260)` |
| `surface-2` | Drawers, sidebars, elevated panels | `oklch(0.98 0.002 90)` | `oklch(0.16 0.01 260)` |
| `surface-3` | Modals, popovers, tooltips | `oklch(1 0 0)` (white) | `oklch(0.18 0.01 260)` |
| `hairline` | Subtle dividers between surfaces | `oklch(0.92 0.004 260 / 0.5)` | `oklch(0.25 0.01 260 / 0.5)` |

### Usage Guidelines

```css
/* Canvas - Page backgrounds */
.surface-canvas { background-color: var(--canvas); }

/* Surface 1 - Cards sit one layer above canvas */
.surface-1 { background-color: var(--surface-1); }

/* Surface 2 - Drawers, elevated panels */
.surface-2 { background-color: var(--surface-2); }

/* Surface 3 - Modals, popovers (highest elevation) */
.surface-3 { background-color: var(--surface-3); }

/* Hairline dividers */
.hairline-t { border-top: 1px solid var(--hairline); }
.hairline-b { border-bottom: 1px solid var(--hairline); }
```

### Component Mapping

- **Cards** → `surface-1` with `border-hairline/60`
- **Sheets/Drawers** → `surface-2` with `border-hairline/60`
- **Dialogs/Modals** → `surface-3` with `border-hairline/60`
- **Dropdowns/Popovers** → `surface-3` with `border-hairline/60`
- **Command Palette** → `surface-3` (inherits from dialog)

### Depth Perception

In dark mode, each surface level gets progressively lighter to create depth perception. In light mode, subtle shadows and borders create the same effect. The goal is premium depth without harsh boxing.

---

## Color System

### Dark Theme (Primary)
```css
--background: #0a0a0b;         /* Near black */
--background-elevated: #111113; /* Cards, modals */
--background-hover: #1a1a1d;    /* Interactive hover */
--border: #27272a;              /* Subtle borders */
--border-bright: #3f3f46;       /* Emphasized borders */

--text-primary: #fafafa;        /* Primary text */
--text-secondary: #a1a1aa;      /* Secondary/muted */
--text-tertiary: #71717a;       /* Disabled/hints */

/* Accent: Horizon Gold */
--gold: #d4a853;
--gold-dim: #a68a42;
--gold-glow: rgba(212, 168, 83, 0.15);

/* Status Colors */
--hot: #ef4444;                 /* Urgent/attention */
--warm: #f59e0b;                /* Active/in-progress */
--cold: #6b7280;                /* Stale/inactive */
--success: #10b981;             /* Complete/healthy */
--info: #3b82f6;                /* Informational */

/* Role Colors */
--role-idea: #a1a1aa;
--role-talent: #a855f7;         /* Purple */
--role-founder: #10b981;        /* Emerald */
--role-operator: #3b82f6;       /* Blue */
--role-investor: #d4a853;       /* Gold */
```

### Glows & Effects
```css
/* Use for interactive/active elements */
--glow-gold: 0 0 20px rgba(212, 168, 83, 0.3);
--glow-success: 0 0 15px rgba(16, 185, 129, 0.25);
--glow-hot: 0 0 15px rgba(239, 68, 68, 0.25);

/* Subtle gradients for depth */
--gradient-card: linear-gradient(145deg, #141416 0%, #0f0f10 100%);
--gradient-spotlight: radial-gradient(ellipse at top, rgba(212, 168, 83, 0.05) 0%, transparent 50%);
```

---

## Typography

**Primary Font:** `Geist` (Vercel's font) or `SF Pro Display`
**Monospace:** `Geist Mono` or `JetBrains Mono`

### Scale
```css
--text-xs: 0.75rem;    /* 12px - labels, badges */
--text-sm: 0.875rem;   /* 14px - secondary text */
--text-base: 1rem;     /* 16px - body */
--text-lg: 1.125rem;   /* 18px - emphasis */
--text-xl: 1.25rem;    /* 20px - subheadings */
--text-2xl: 1.5rem;    /* 24px - headings */
--text-3xl: 2rem;      /* 32px - page titles */
--text-display: 3rem;  /* 48px - hero moments */
```

**Weight usage:**
- 400 for body text
- 500 for emphasis, labels
- 600 for headings, buttons
- 700 for display/hero text only

---

## Motion & Animation

### Principles
- **Fast:** 150-200ms for micro-interactions
- **Smooth:** Use `ease-out` for enters, `ease-in` for exits
- **Purposeful:** Motion should guide attention, not distract

### Standard Transitions
```css
--transition-fast: 150ms ease-out;
--transition-base: 200ms ease-out;
--transition-slow: 300ms ease-out;
```

### Key Animations
```css
/* Subtle pulse for empty slots awaiting action */
@keyframes pulse-soft {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Glow entrance for newly filled slots */
@keyframes glow-in {
  0% { box-shadow: 0 0 0 rgba(212, 168, 83, 0); }
  50% { box-shadow: 0 0 30px rgba(212, 168, 83, 0.4); }
  100% { box-shadow: 0 0 15px rgba(212, 168, 83, 0.15); }
}

/* Staggered fade-in for lists */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Component Patterns

### Cards
- Background: `--background-elevated`
- Border: 1px `--border`, brighter on hover
- Border-radius: 12px (generous, not bubble)
- Subtle gradient overlay for depth
- Hover: slight lift (translateY -2px) + border brighten

### Buttons
- **Primary:** Gold background, dark text, glow on hover
- **Secondary:** Transparent, border only, fills on hover
- **Ghost:** No border, subtle background on hover
- All buttons: 150ms transitions, slight scale (1.02) on active

### Badges/Pills
- Small (20-24px height), rounded-full
- Role-colored with low opacity background
- Example: Investor badge = gold text on gold/10% bg

### Tables
- Minimal borders (bottom only, or none)
- Row hover: subtle background shift
- Sticky headers with blur backdrop
- Dense but readable (40-48px row height)

#### Table Rules (Density + Scannability)
- **Alignment:** left-align text; right-align numbers/currency; avoid center alignment
- **Numerals:** use **tabular numerals** for money/counts
- **Progressive disclosure:** secondary details on row expand / drawer, not always visible
- **Bulk actions:** appear in a temporary selection bar only when rows are selected
- **Column controls:** show/hide, reorder, resize, reset-to-default; persist per-user
- **Saved views:** named filter/sort/column presets for power users

---

## Assembly Board — Specific Guidance

The Assembly Board is HORIZON's signature component. It should feel like assembling a mission crew, not filling out a form.

### Layout
```
         ┌─────────────┐
         │    IDEA     │  ← Anchor, largest, elevated
         │   (name)    │
         └─────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│TALENT │ │FOUNDER│ │OPERATOR│  ← Middle tier
└───────┘ └───────┘ └───────┘
              │
         ┌───▼───┐
         │INVESTOR│  ← Foundation
         │  $XXk  │
         └───────┘
```

### Slot States

Each Assembly Board slot has three states with distinct visual treatments:

#### Empty Slot (`status: 'none'`)
- **Border**: Solid dim border (`border-border`), NOT dashed (dashed looks unfinished)
- **Background**: `bg-muted/30` - subtle but visible
- **Icon**: 40% opacity, centered, brightens to 70% on hover
- **Label**: Role name + "Add {Role}" CTA in muted text
- **Animation**: Subtle pulse animation (`animate-pulse-soft`, 3s cycle) with gold hint
- **Hover**: Border brightens to `border-muted-foreground/50`, background to `bg-muted/50`
- **Focus**: Gold ring (`ring-horizon`) for keyboard navigation
- **Tooltip**: Shows "Click to add {role}" on hover

```tsx
// Empty slot example
<RoleSlot
  role="talent"
  icon={Star}
  status="none"
  onClick={() => openAssemblyModal('talent')}
/>
```

#### Pipeline Slot (`status: 'pipeline'`)
- **Border**: Warm-colored border (`border-warm/40`)
- **Background**: `bg-warm/10`
- **Icon**: Full color warm icon
- **Corner indicator**: Clock icon (shows "in progress")
- **Content**: Pipeline count ("3 in pipeline")
- **Hover**: Border brightens, background intensifies

#### Attached Slot (`status: 'attached'`)
- **Border**: Success-colored border (`border-success/40`)
- **Background**: `bg-success/10`
- **Avatar**: Person's avatar with success-colored ring (`ring-success/30`)
- **Role Badge**: Small uppercase badge in role color (e.g., "TALENT" in purple)
- **Corner indicator**: Checkmark icon (confirmed) - hides on hover when quick actions available
- **Content**: Person name prominently displayed
- **Hover**: Lift effect (`scale-[1.02]`), subtle success glow (`shadow-[0_0_15px_rgba(16,185,129,0.15)]`)
- **Quick Actions**: Dropdown menu appears on hover (top-right):
  - View Profile (eye icon)
  - Change (refresh icon)
  - Remove (x icon, destructive style)

```tsx
// Filled slot with quick actions
<RoleSlot
  role="talent"
  icon={Star}
  status="attached"
  attachedPerson={{ id: '1', name: 'Jane Doe', avatarUrl: '...' }}
  actions={{
    onView: (person) => router.push(`/people/${person.id}`),
    onChange: () => openAssemblyModal('talent'),
    onRemove: (person) => handleRemove(person, 'talent'),
  }}
  onClick={() => openAssemblyModal('talent')}
/>
```

#### IDEA Slot (Special)
- Always larger (1.5x other slots)
- Gold accent border when filled
- Elevated shadow
- This is the "anchor" — everything connects to it

### Slot Interaction Flow

1. **Empty slot click** → Opens `PackageAssemblyModal` focused on that role
2. **Pipeline/Attached slot click** → Opens modal showing current attachments + search
3. **Keyboard navigation**: Tab to focus, Enter to activate, Escape to close modal

### Connection Lines
Subtle SVG lines connect the Assembly Board slots to create visual hierarchy:

- **Style**: Dashed lines (`strokeDasharray="4 4"`) with 1px stroke
- **Color**: Default `stroke-border/50`, lights up when connected slots are filled
  - Connected to filled slot: `stroke-success/30`
  - Connected to pipeline slot: `stroke-warm/30`
- **Layout**:
  - Vertical line from Idea down to middle row
  - Horizontal line connecting Talent/Founder/Operator
  - Vertical line from middle row to Investors
- **Toggle**: `showConnections={false}` prop to disable
- **Z-index**: Lines render behind slots (`z-0`) with slots at `z-10`

### Progress Indicator
The Assembly Board includes a comprehensive progress tracking system:

- **Counter Badge**: Shows "X of 5" filled roles with color-coded styling
  - Complete (5/5): Success green background
  - In progress: Horizon gold background
- **Status Dots**: Five dots below the counter, one per role
  - Filled: `bg-success` (green)
  - Pipeline: `bg-warm` (amber)
  - Empty: `bg-muted-foreground/30` (gray)
  - Tooltip explains the legend on hover
- **Progress Bar**: Gradient bar from horizon to success
  - Shows completion checkmark icon when 100%
  - Animates smoothly on changes (500ms transition)
- **Stage Badge**: Shows current package stage with appropriate styling
  - Funded/Operating: Success styling
  - Raising: Horizon gold styling
  - Earlier stages: Muted styling

### Micro-interactions
- Slot fill: glow-in animation (300ms)
- Slot hover: scale 1.02, glow increase
- Progress update: smooth countup animation
- Connection lines: draw-in animation when new connection forms

---

## View Pattern Components

HORIZON uses three core view patterns for consistent interaction design:

### ContextDrawer (Inspect)

Right-side drawer for quick inspection without losing context. Use when users need to preview/edit an entity while staying on a list page.

```tsx
import { ContextDrawer } from '@/components/ui/context-drawer';

<ContextDrawer
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Package Name"
  description="Optional subtitle"
  headerBadge={<Badge>Stage</Badge>}
  summary={<StatsGrid />}  // Mini stats block
  actionHrefs={{ open: '/packages/123', edit: '/packages/123/edit' }}
>
  {/* Additional sections */}
</ContextDrawer>
```

**Specs:**
- Width: Full screen on mobile, 420px on desktop
- Surface: `surface-2` background
- Header: Title + description + optional badge
- Quick actions: Open full, Edit, Copy link (auto-generated)
- Close: X button or click outside

### FocusModal (Commit)

Full-screen modal for focused multi-step flows. Use for creation flows, wizards, or any focused task requiring undivided attention.

```tsx
import { FocusModal, useFocusModalDirty } from '@/components/ui/focus-modal';

<FocusModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Create Package"
  steps={[
    { key: 'basics', content: <Step1 /> },
    { key: 'links', content: <Step2 /> },
    { key: 'idea', content: <Step3 /> },
  ]}
  submitLabel="Create Package"
  submitVariant="horizon"  // Gold CTA
  onSubmit={handleCreate}
  isDirty={hasChanges}  // Prompts confirmation on close
/>
```

**Specs:**
- Surface: `surface-3` with backdrop blur
- Animation: Slide up + fade in (`slide-in-from-bottom-4`)
- Stepper: "Step X of Y" indicator + progress
- Footer: Back (outline) + Next/Submit (horizon variant)
- Dirty state: Shows discard confirmation on close

### PageHeader (Layout)

Consistent header for all main pages with title, description, actions, and optional tabs.

```tsx
import { PageHeader } from '@/components/ui/page-header';

<PageHeader
  title="Packages"
  description="Track your active deals"
  actions={<Button>Create Package</Button>}
  tabs={<TabsList />}
/>
```

**Specs:**
- Title: `text-h1` (28px)
- Description: `text-small` (12px muted)
- Actions: Right-aligned on desktop, full-width on mobile
- Breadcrumbs: Optional, rendered above title

---

## DataTable++ Component

Enhanced data table built on `@tanstack/react-table` with power-user features.

```tsx
import { DataTable, type ColumnDef } from '@/components/ui/data-table';

<DataTable
  data={packages}
  columns={columns}
  density="dense"  // 40px rows (default) or "comfortable" (48px)
  enableRowSelection
  enableColumnVisibility
  enableColumnReorder
  enableColumnResize
  storageKey="horizon.packages.datatable"  // Persist preferences
  renderRowActions={(row) => <RowActions item={row.original} />}
  renderSelectionActions={(rows) => <BulkActions items={rows} />}
/>
```

### Column Metadata

```tsx
const columns: ColumnDef<Package>[] = [
  {
    accessorKey: 'amount',
    header: 'Committed',
    meta: {
      label: 'Committed Amount',  // Visibility dropdown
      align: 'right',              // Right-align numbers
      numeric: true,               // Use tabular-nums
      alwaysVisible: true,         // Cannot be hidden
      pinned: true,                // Cannot be reordered
    },
  },
];
```

### Features

| Feature | Description |
|---------|-------------|
| **Row Selection** | Checkbox column + selection bar with bulk actions |
| **Column Visibility** | Show/hide columns via dropdown menu |
| **Column Reorder** | Drag-and-drop column headers |
| **Column Resize** | Drag column edges to resize |
| **Sorting** | Click headers to toggle sort direction |
| **Row Hover Actions** | Actions appear on hover (150ms fade) |
| **Persistence** | Save preferences to localStorage |

### Selection Bar

When rows are selected, a selection bar appears above the table:
- Shows "X items selected" count
- Renders bulk action buttons via `renderSelectionActions`
- Clear selection button (X icon)
- Styled with horizon accent border

---

## MiniAssemblyPreview

Compact 5-slot horizontal indicator for assembly status. Use in tables and cards where full AssemblyBoard is too large.

```tsx
import { MiniAssemblyPreview, packageAssemblyToSlots } from '@/components/packages/mini-assembly-preview';

<MiniAssemblyPreview
  slots={packageAssemblyToSlots(assembly)}
  size="sm"  // sm | default | lg
  onClick={(role) => handleSlotClick(role)}
/>
```

**Slot States:**
- **Filled**: Gold border + gold icon
- **Pipeline**: Warm border + warm icon
- **Empty**: Dim border + muted icon

---

## Empty States

All empty states should be actionable, inviting users to take the next step.

### Pattern

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  {/* Icon in muted circle */}
  <div className="mb-4 rounded-full bg-muted/10 p-4">
    <Icon className="h-12 w-12 text-muted-foreground/50" />
  </div>

  {/* Title + Description */}
  <p className="text-sm font-medium">No packages yet</p>
  <p className="mt-1 text-xs text-muted-foreground">
    Create your first package to get started
  </p>

  {/* Primary Action */}
  <Button className="mt-4" asChild>
    <Link href="/packages/new">Create Package</Link>
  </Button>
</div>
```

### Examples

| Surface | Title | Action |
|---------|-------|--------|
| Attention Queue | "All clear" | "Ask Scout what to work on" |
| Active Packages | "No packages yet" | "Create package" |
| Pipeline Health | "No network data" | "Add contact" |
| AI Insights | "Nothing notable" | (Scout branding, no action) |

---

## Page-Specific Notes

### Dashboard (Command)

The Command dashboard uses consistent card containment:

```tsx
// Dashboard card pattern
<div className="surface-1 rounded-xl border border-border/50">
  <div className="flex items-center justify-between border-b border-border/50 py-3 px-5">
    <h3 className="text-sm font-semibold">Card Title</h3>
    {/* Actions */}
  </div>
  <div className="p-5">
    {/* Content */}
  </div>
</div>
```

**Specs:**
- All cards use `surface-1` with `border-border/50`
- Header padding: `py-3 px-5`
- Content padding: `p-5`
- Separator: `border-b border-border/50`

### Status Strip

Horizontal stat bar below page header:

```tsx
<div className="flex items-center gap-6 px-5 py-2 bg-muted/30">
  <StatItem label="ACTIVE" value={12} trend="up" />
  <div className="h-7 w-px bg-border/50" />  {/* Hairline separator */}
  <StatItem label="COMMITTED" value="$2.4M" />
</div>
```

- Labels: `text-[10px] uppercase tracking-wider text-muted-foreground`
- Values: `text-lg font-semibold tabular-nums`
- Trend icons: Color-coded (success for up, hot for down)

### Network

Uses DataTable++ with dense mode for information-rich scanning:

- Dense rows: 40px height via `density="dense"`
- Warmth shown as color-coded bar (default) or dots visualization
- Quick actions on hover: View profile, Message, Find warm path, Add to package
- Row hover reveals action buttons with 150ms fade transition
- Saved views: Named filter/sort presets stored in localStorage
- URL-driven filters: `?role=investor&warmth=hot&sort=warmth`

#### Warmth Visualization

The `WarmthIndicator` component displays relationship warmth with two modes:

**Bar Mode (default):**
- Horizontal progress bar showing warmth percentage
- Color-coded: Hot (red, >70), Warm (amber, 40-70), Cool (blue, 20-40), Cold (gray, <20)
- Tooltip shows exact percentage on hover

**Dots Mode:**
- Four discrete dots showing warmth level
- 4 dots filled = Hot, 3 = Warm, 2 = Cool, 1 = Cold
- Use for more compact displays

```tsx
// Bar mode (default)
<WarmthIndicator score={75} mode="bar" size="sm" />

// Dots mode
<WarmthIndicator score={75} mode="dots" size="sm" />
```

#### Saved Views

```tsx
// Default views (cannot be deleted)
const DEFAULT_VIEWS = ['All', 'Investors', 'Talent'];

// User-created views stored in localStorage
// Views are URL-driven: /network?view=hot-investors
```

### Scout

Scout is the AI copilot. The interface should feel like talking to a knowledgeable partner, not a generic chatbot.

#### Mode Tabs
- **Surface**: Use `surface-2` background with `border-horizon/40` for active state
- **Active indicator**: Gold bottom bar (`after:` pseudo-element with `bg-horizon`)
- **Icons**: Gold color (`text-horizon`) when active, muted otherwise
- **Locked state**: 50% opacity with Lock icon when mode is locked during conversation
- **Tooltips**: Each tab has a tooltip explaining the mode
- **Focus**: Gold ring (`focus-visible:ring-2 focus-visible:ring-horizon`)

```tsx
// Active tab styling
className={cn(
  'bg-surface-2 text-foreground',
  'border border-horizon/40',
  'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-horizon',
)}
```

#### Prompt Chips
- **Surface**: Use `surface-1` background with subtle border
- **Hover**: Lift effect (`-translate-y-0.5`), border changes to `border-horizon/40`
- **Active/Press**: Scale down (`scale-[0.98]`), gold background hint (`bg-horizon/10`)
- **Shimmer**: Subtle shimmer animation on hover for premium feel
- **Grouping**: Max width constraint (`max-w-lg`) for better visual grouping

```tsx
// Prompt chip hover state
className={cn(
  'hover:border-horizon/40 hover:text-foreground hover:bg-surface-2',
  'hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
  'hover:-translate-y-0.5',
)}
```

#### Composer
- **Container**: Unified rounded container (`rounded-2xl`) with `surface-1` background
- **Default state**: Subtle border (`border-border/40`), no gold accent
- **Focus state**: Gold ring and border (`focus-within:ring-2 focus-within:ring-horizon/20`)
- **Send button states**:
  - Empty: Muted (`bg-muted text-muted-foreground/60`)
  - Ready: Gold (`bg-horizon text-white`)
  - Loading: Gold with reduced opacity
- **Keyboard hints**: Styled `<kbd>` elements for Enter/Shift+Enter

```tsx
// Composer focus state
className={cn(
  'focus-within:border-horizon/60',
  'focus-within:ring-2 focus-within:ring-horizon/20',
  'focus-within:shadow-[0_0_0_3px_rgba(212,168,83,0.1)]',
)}
```

- AI responses: slightly different background to distinguish

### Package Detail
- Assembly Board is the hero
- Commitment Pipeline below as horizontal funnel
- Activity timeline: subtle, scannable

---

## Forms & Creation Flows

Forms in HORIZON should feel intentional and fast, not bureaucratic. The goal is to capture information efficiently while maintaining visual hierarchy.

### Structure

1. **Section Headers** - Group related fields with an icon + title + optional description
   - Icon in a muted rounded container (h-9 w-9)
   - Title in `text-sm font-semibold`
   - Description in `text-sm text-muted-foreground`

2. **Field Groups** - Each input field with label + input + helper text
   - Labels: `text-sm font-medium` with required indicator in `text-hot`
   - Inputs: `h-11` for comfortable touch targets
   - Helper text: `text-[13px] leading-relaxed text-muted-foreground`

3. **Tip Boxes** - Optional/skip guidance without dashed borders
   - Background: `bg-muted/40` (solid, not outlined)
   - Icon: Lightbulb in `text-horizon`
   - NO dashed borders (per anti-patterns)

### FocusModal Usage

```tsx
<FocusModal
  title="Create New Package"
  steps={steps}
  submitLabel="Create Package"
  submitVariant="horizon"  // Gold CTA for primary action
/>
```

### CTA Hierarchy

1. **Primary CTA** (Submit/Create): Use `variant="horizon"` for gold accent
2. **Secondary CTA** (Next): Default button variant
3. **Tertiary CTA** (Back/Cancel): `variant="outline"`

### Toggle/Checkbox Rows

Proper alignment for checkbox + text combinations:

```tsx
<label className="flex items-start gap-4 cursor-pointer">
  {/* Checkbox centered with first line of text */}
  <div className="flex h-6 items-center">
    <Checkbox className="data-[state=checked]:bg-horizon" />
  </div>

  {/* Text content */}
  <div className="flex-1 space-y-1">
    <div className="flex items-center gap-2 text-sm font-medium">
      <Icon className="h-4 w-4 text-horizon" />
      Label text
    </div>
    <p className="text-[13px] text-muted-foreground">
      Helper description
    </p>
  </div>
</label>
```

### Anti-Patterns in Forms

❌ Dashed borders on tip boxes or sections
❌ Tiny text (smaller than 13px) for helper text
❌ Multiple primary CTAs (only one gold button per form)
❌ Flat checkbox alignment (checkbox should align with first line of text)
❌ Generic submit labels ("Submit" → use "Create Package", "Save Changes", etc.)

---

## Anti-Patterns (Avoid These)

❌ Pure white backgrounds
❌ Dashed borders (look unfinished)
❌ Gray-on-gray low contrast
❌ Borders on everything (use spacing instead)
❌ Generic shadows (use glows for dark theme)
❌ Slow animations (>300ms feels sluggish)
❌ Inter font (too generic)
❌ Equal visual weight everywhere (create hierarchy!)
❌ Light theme as primary

---

## Inspiration References

- **Linear** — Dark theme, motion, keyboard shortcuts
- **Vercel Dashboard** — Clean, fast, great dark mode
- **Raycast** — Command palette, speed, polish
- **Figma** — Dense but organized, great selection states
- **Bloomberg Terminal** — Information density, dark, professional

---

## Icon System

HORIZON uses **Lucide React** for all icons. Never use emojis in the UI — they render inconsistently across platforms and break the professional aesthetic.

### Core Principles

1. **No emojis in UI** — Emojis are inconsistent across platforms and feel unprofessional
2. **Use Lucide icons consistently** — All icons from one library for visual cohesion
3. **Add tooltips** — Icons should have tooltips to explain their meaning
4. **Color indicates state** — Use role colors and semantic colors to show status

### Role Icons (from `@/lib/role-icons.ts`)

| Role | Icon | Color Token |
|------|------|-------------|
| Investor | `DollarSign` | `--role-investor` |
| Talent | `Star` | `--role-talent` |
| Founder | `User` | `--role-founder` |
| Operator | `Briefcase` | `--role-operator` |
| Partner | `Handshake` | `--horizon` |
| Idea | `Lightbulb` | `--text-tertiary` |

### Severity/Status Icons

| State | Icon | Color Token |
|-------|------|-------------|
| Critical | `CircleAlert` | `--hot` |
| Warning | `AlertCircle` | `--warm` |
| Success/Info | `CheckCircle2` | `--success` |

### Usage Guidelines

```tsx
// Import from centralized config
import { ROLE_CONFIG, type RoleType } from '@/lib/role-icons';

// Use with tooltips for clarity
<Tooltip>
  <TooltipTrigger>
    <Icon className={roleConfig.colorClass} />
  </TooltipTrigger>
  <TooltipContent>{roleConfig.label}</TooltipContent>
</Tooltip>
```

### Icon States

- **Active/Filled**: Full color from role/semantic tokens
- **Pipeline/Pending**: Muted color with 50% opacity
- **Empty/None**: `text-muted-foreground/30`

### Anti-Patterns

❌ Using emojis (🔴, 💰, ⭐, etc.) — inconsistent rendering
❌ Using icons without tooltips — ambiguous meaning
❌ Mixing icon libraries — visual inconsistency
❌ Using generic icons for roles — lose semantic meaning

---

## Keyboard Shortcuts

HORIZON is keyboard-first. All major actions should be accessible via keyboard.

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ K` | Open command palette |
| `G then C` | Go to Command |
| `G then P` | Go to Packages |
| `G then N` | Go to Network |
| `G then S` | Go to Scout |
| `?` | Show keyboard shortcuts dialog |

### Scout Shortcuts (when open)

| Shortcut | Action |
|----------|--------|
| `Escape` | Close Scout |
| `↑ / ↓` | Navigate suggestions |
| `Enter` | Select suggestion or send message |
| `⌘ Enter` | Force send message |

### Table Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑ / ↓` | Navigate rows |
| `Enter` | Open selected row |
| `Space` | Toggle row selection |

### Implementation

```tsx
// Use the keyboard shortcuts hook
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

// G-then-X pattern uses a pending state with 1 second timeout
// Skips shortcuts when user is typing in an input
```

---

## Quick Checklist Before Shipping

- [ ] Dark mode looks intentional, not inverted light mode
- [ ] Gold accent used sparingly but effectively
- [ ] Interactive elements have clear hover/active states
- [ ] Motion is fast (150-200ms) and purposeful
- [ ] Empty states invite action, don't feel broken
- [ ] Text contrast meets accessibility (4.5:1 minimum)
- [ ] Assembly Board slots have clear visual hierarchy
- [ ] Keyboard shortcuts work and are discoverable
- [ ] No emojis in UI — use Lucide icons with tooltips instead
- [ ] Tables use DataTable++ with proper column metadata
- [ ] Forms group fields into sections with SectionHeader
- [ ] Primary CTA uses `variant="horizon"` (gold accent)
- [ ] ContextDrawer for quick inspection, FocusModal for creation flows
- [ ] All filters sync to URL params (shareable/bookmarkable)

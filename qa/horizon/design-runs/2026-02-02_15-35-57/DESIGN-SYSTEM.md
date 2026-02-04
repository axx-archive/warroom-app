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

**Empty Slot:**
- Dashed border → NO. Use solid but dim border (--border)
- Background: transparent with subtle pattern or gradient
- Icon: 40% opacity, centered
- Label: "Click to add" in --text-tertiary
- Animation: very subtle pulse (2s cycle)
- Hover: border brightens, background shifts, cursor pointer

**Filled Slot:**
- Solid border in role color (e.g., --role-talent for Talent)
- Background: role color at 10% opacity
- Glow: subtle role-colored glow
- Content: Avatar (if person) + name + role label
- Checkmark indicator in corner
- Hover: lift effect, glow intensifies

**IDEA Slot (Special):**
- Always larger (1.5x other slots)
- Gold accent border when filled
- Elevated shadow
- This is the "anchor" — everything connects to it

### Connection Lines
- Faint lines (1px, --border color) connecting slots
- Animate in when slots are filled
- Creates visual sense of "package forming"

### Progress Indicator
- Replace linear bar with circular progress ring around the board
- Or: each connection line "lights up" as slots fill
- Show percentage + "X of 5 roles filled"

### Micro-interactions
- Slot fill: glow-in animation (300ms)
- Slot hover: scale 1.02, glow increase
- Progress update: smooth countup animation
- Connection lines: draw-in animation when new connection forms

---

## Page-Specific Notes

### Dashboard (Command)
- Hero stat cards with large numbers, subtle glow on important metrics
- Attention queue: red glow on urgent items
- Active packages: mini Assembly Board previews (simplified)

### Network
- Dense table view by default
- Warmth shown as color-coded dot or bar
- Quick actions on hover (message, view, add to package)

### Scout
- Chat interface should feel like talking to a co-pilot
- Mode tabs: subtle, icon-forward
- AI responses: slightly different background to distinguish

### Package Detail
- Assembly Board is the hero
- Commitment Pipeline below as horizontal funnel
- Activity timeline: subtle, scannable

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

## Quick Checklist Before Shipping

- [ ] Dark mode looks intentional, not inverted light mode
- [ ] Gold accent used sparingly but effectively
- [ ] Interactive elements have clear hover/active states
- [ ] Motion is fast (150-200ms) and purposeful
- [ ] Empty states invite action, don't feel broken
- [ ] Text contrast meets accessibility (4.5:1 minimum)
- [ ] Assembly Board slots have clear visual hierarchy
- [ ] Keyboard shortcuts work and are discoverable

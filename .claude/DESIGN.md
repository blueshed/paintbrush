# Paintbrush Design System

Design spec for AI agents. All values are concrete — use them as-is.

## Visual Theme & Atmosphere

Minimal, content-first utility app. Light background, high contrast text, no decoration. Dense on desktop, touch-friendly on mobile. The UI disappears — the content is the interface.

## Color Palette & Roles

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f8f9fa` | Page background |
| `--surface` | `white` | Cards, modals, inputs, sidebar |
| `--text` | `#1a1a1a` | Primary text |
| `--text-secondary` | `#555` | Labels, help text |
| `--text-muted` | `#999` | Metadata, placeholders, inactive icons |
| `--border` | `#eee` | Light dividers (lists, hr) |
| `--border-mid` | `#ddd` | Input borders |
| `--border-strong` | `#ccc` | Button borders |
| `--hover` | `#f0f0f0` | Hover backgrounds |
| `--code-bg` | `#e9ecef` | Inline code background |
| `--primary` | `#1a1a1a` | Primary buttons, active icons — black, not blue |
| `--primary-hover` | `#333` | Primary button hover |
| `--danger` | `#c33` | Delete actions, alert toasts |
| `--danger-bg` | `#fdf0f0` | Danger button hover background |
| `--notify` | `#e67e22` | Toast notification background |
| `--overlay` | `rgba(0,0,0,0.25)` | Modal backdrop |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.12)` | Modal elevation |

## Typography Rules

| Element | Size | Weight | Notes |
|---|---|---|---|
| Body | inherited | 400 | `system-ui, -apple-system, sans-serif`, `line-height: 1.5` |
| `h1` | `1.25rem` (desktop) / `1.5rem` (touch) | 600 | Bottom margin `1rem` |
| `h2` | `1rem` (desktop) / `1.25rem` (touch) | 600 | Used in modals |
| Button | `0.8rem` (desktop) / `0.85rem` (touch) | 400 | |
| Input/textarea | `0.85rem` (desktop) / `1rem` (touch) | 400 | `font-family: inherit` |
| Label | `0.8rem` | 500 | `color: var(--text-secondary)` |
| `.help` | `0.8rem` | 400 | `color: var(--text-secondary)`, `line-height: 1.6` |
| `.meta` | `0.7rem` | 400 | `color: var(--text-muted)` |
| `.badge` | `0.7rem` | 400 | Pill shape, muted background |
| `.list strong` | `0.85rem` | 500 | Item titles |
| `.list small` | `0.7rem` | 400 | Timestamps, right-aligned, no wrap |

## Component Stylings

### Buttons

Three variants, all `border-radius: 4px`:

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Default | `white` | `--text` | `--border-strong` | `--hover` bg |
| `.primary` | `--primary` | `white` | `--primary` | `--primary-hover` bg |
| `.danger` | `white` | `--danger` | `--danger` | `--danger-bg` bg |

Touch: `min-height: 44px`, larger padding.

### Inputs & Textareas

`width: 100%`, `border: 1px solid var(--border-mid)`, `border-radius: 4px`. Textarea `min-height: 120px`, `resize: vertical`. Touch: `min-height: 44px`.

### Toolbar

`display: flex`, `align-items: baseline`, `gap: 0.5rem`, `margin-bottom: 1rem`. When containing `h1`, it gets `margin-right: auto` to push buttons right.

### Nav List

Stacked links with `1px` gap, connected borders. First child gets top radius, last gets bottom, only-child gets both. Hover: `var(--bg)` background.

### Item List (`.list`)

Unstyled `ul`. Items separated by `border-top: 1px solid var(--border)`. Links flex with `strong` left, `small` right.

### Toast

Fixed bottom-center, `border-radius: 4px`, fades in/out via `opacity` transition (0.2s). Two styles: `.notify` (orange `--notify`) and `.alert` (red `--danger`). Duration: 1500ms.

### Modal

`.modal-backdrop`: fixed fullscreen, centered flex, `var(--overlay)` background. `.modal`: white, `border-radius: 6px`, `padding: 1.5rem`, `max-width: 400px`, `box-shadow: var(--shadow)`. Toolbar in modal: `justify-content: flex-end`, no bottom margin.

### Confirm Delete

Inline pattern — swap toolbar: hide action buttons, show `.confirm` toolbar with `.confirm-prompt` text (red, `margin-right: auto`) + confirm/cancel buttons. In modals, use `flex-direction: row-reverse` with delete on left.

### Labels

`display: block`, wrapping the input/textarea. Label text is `--text-secondary`, input has `margin-top: 0.25rem`.

## Layout Principles

| Property | Value |
|---|---|
| Content width | `max-width: 640px`, centered |
| Page padding | `2rem 1rem` |
| Scroll container | `html, body { height: 100%; overflow: hidden }`, `#app { height: 100dvh; overflow-y: auto }` — scroll is on `#app`, not the body (prevents rubber-banding on fixed elements) |
| Sidebar offset | `body:has(.sidebar) { padding-left: 56px }` |
| Spacing unit | `rem`-based, no fixed scale — `0.25` / `0.5` / `0.75` / `1` / `1.5` / `2` |
| Dividers | `<hr>` with `margin: 2rem 0` |
| Word wrap | `overflow-wrap: anywhere` |

## Depth & Elevation

Flat design — no shadows except modals. Two layers:

| Layer | Treatment |
|---|---|
| Page | `var(--bg)` background |
| Surface | `var(--surface)` (white) — nav-list items, sidebar, dock, modals |
| Modal | `var(--shadow)`: `0 4px 24px rgba(0,0,0,0.12)` over `var(--overlay)` backdrop |

## Do's and Don'ts

**Do:**
- Use CSS variables for all colors — never hardcode hex in components
- Use `.toolbar` for any row of buttons or heading + buttons
- Use `.nav-list` for navigation menus, `.list` for data items
- Use inline confirm pattern for destructive actions (swap toolbars, not browser confirm)
- Use toast for feedback — `notify` for success, `alert` for destructive
- Use `when()` for conditional rendering, `list()` for collections
- Keep views flat — no nested card-in-card patterns
- Use feather icons at `16x16` via `data-feather` attributes

**Don't:**
- Add box shadows to anything other than modals
- Use colored/branded primary buttons — primary is black (`#1a1a1a`)
- Add rounded pill buttons — radius is always `4px` (except badges: `8px`)
- Create custom scrollbars or animations beyond toast opacity
- Add hero sections, gradients, or decorative elements
- Nest modals or stack toasts
- Use browser `confirm()` or `alert()` — use inline confirm and toast instead

## Responsive Behavior

Detection via `pointer` media query (not width breakpoints):

| Context | Query | Navigation | Touch targets |
|---|---|---|---|
| Desktop | `@media (pointer: fine)` | `.sidebar` — fixed left, 56px wide, icon-only, vertical | Default sizes |
| Mobile | `@media (pointer: coarse)` | `.dock` — fixed bottom, icon + label, horizontal | `min-height: 44px` on buttons, inputs, nav-list links |

Sidebar: `40x40px` icon buttons, `border-radius: 8px`, `.spacer` for bottom-pinned items.
Dock: `padding-bottom: env(safe-area-inset-bottom)` for notch devices. Icons `20x20`, labels `0.65rem`.

## Agent Prompt Guide

### Adding a new view

1. Create `resources/{name}/{name}-view.tsx`
2. Use `.toolbar` with `h1` + buttons for the header
3. Use `.list` for collections, `.empty` for zero state
4. Use `.back` link for detail views
5. Use `label > input` pattern for forms
6. Toast on save/delete — `toast("Saved")` / `toast("Deleted", "alert")`

### Quick class reference

| Class | Use for |
|---|---|
| `.toolbar` | Flex row: heading + buttons, or button groups |
| `.nav-list` | Stacked navigation links with borders |
| `.list` | Data item list (title + metadata) |
| `.badge` | Count pill inside nav-list items |
| `.empty` | Centered "nothing here" message |
| `.back` | Small return link above detail views |
| `.help` | Explanatory text below content |
| `.meta` | Small secondary info (uptime, versions) |
| `.confirm` | Inline delete confirmation toolbar |
| `.toast` | Feedback notification (+ `.notify` / `.alert`) |
| `.modal-backdrop` + `.modal` | Overlay dialog |
| `.sidebar` | Desktop icon nav (pointer: fine) |
| `.dock` | Mobile bottom nav (pointer: coarse) |

### Color decision tree

- Action button? `.primary` (black)
- Destructive? `.danger` (red text/border, red bg on hover)
- Success feedback? `.toast.notify` (orange)
- Error/delete feedback? `.toast.alert` (red)
- Secondary text? `var(--text-secondary)` — labels, help
- Tertiary text? `var(--text-muted)` — meta, timestamps, icons

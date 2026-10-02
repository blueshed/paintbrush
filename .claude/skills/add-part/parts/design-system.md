# Design system: navigation, lists, modals

When: the app needs more than a heading, a form and a toast: a menu, a list of records, a detail page with a way back, a dialog, an inline delete confirmation, or the sidebar and dock.

The starter's `src/styles.css` and `.claude/DESIGN.md` hold only what the page uses. This part holds the rest of the design system, taken out so a new app does not carry CSS nothing uses. Add what you need, and only that: copy the rules for the components you build into `src/styles.css` (and the variables they use into `:root`), and the matching notes into `.claude/DESIGN.md`.

Icons are not part of the design system. The sidebar and dock expect an icon in each link (`svg`, 20x20); choose an icon set with the user, and do not add a dependency without asking.

Tests: none of their own. If a behaviour depends on a component (a modal that opens, a confirmation that swaps the toolbar), test that behaviour in the browser.

## Notes

### Nav List

Stacked links with `1px` gap, connected borders. First child gets top radius, last gets bottom, only-child gets both. Hover: `var(--bg)` background.

### Item List (`.list`)

Unstyled `ul`. Items separated by `border-top: 1px solid var(--border)`. Links flex with `strong` left, `small` right.

### Modal

`.modal-backdrop`: fixed fullscreen, centered flex, `var(--overlay)` background. `.modal`: white, `border-radius: 6px`, `padding: 1.5rem`, `max-width: 400px`, `box-shadow: var(--shadow)`. Toolbar in modal: `justify-content: flex-end`, no bottom margin.

### Confirm Delete

Inline pattern — swap toolbar: hide action buttons, show `.confirm` toolbar with `.confirm-prompt` text (red, `margin-right: auto`) + confirm/cancel buttons. In modals, use `flex-direction: row-reverse` with delete on left.

### Labels

`display: block`, wrapping the input/textarea. Label text is `--text-secondary`, input has `margin-top: 0.25rem`.

## Depth & Elevation

Flat design — no shadows except modals. Two layers:

| Layer | Treatment |
|---|---|
| Page | `var(--bg)` background |
| Surface | `var(--surface)` (white) — nav-list items, sidebar, dock, modals |
| Modal | `var(--shadow)`: `0 4px 24px rgba(0,0,0,0.12)` over `var(--overlay)` backdrop |

## Responsive Behavior

Detection via `pointer` media query (not width breakpoints):

| Context | Query | Navigation | Touch targets |
|---|---|---|---|
| Desktop | `@media (pointer: fine)` | `.sidebar` — fixed left, 56px wide, icon-only, vertical | Default sizes |
| Mobile | `@media (pointer: coarse)` | `.dock` — fixed bottom, icon + label, horizontal | `min-height: 44px` on buttons, inputs, nav-list links |

Sidebar: `40x40px` icon buttons, `border-radius: 8px`, `.spacer` for bottom-pinned items.
Dock: `padding-bottom: env(safe-area-inset-bottom)` for notch devices. Icons `20x20`, labels `0.65rem`.

## The CSS

```css
/* Add to :root: the variables the starter's stylesheet leaves out */
  --border: #eee;
  --danger-bg: #fdf0f0;
  --overlay: rgba(0, 0, 0, 0.25);
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.12);

/* Base elements */
button svg { vertical-align: -0.15em; }
button.danger { color: var(--danger); border-color: var(--danger); }
button.danger:hover { background: var(--danger-bg); }
label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}
label input,
label textarea { margin-top: 0.25rem; }

hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
[hidden] { display: none !important; }

/* Components */
.nav-list { display: flex; flex-direction: column; gap: 1px; }
.nav-list a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  font-size: 0.85rem;
  color: inherit;
  text-decoration: none;
  background: var(--surface);
  border: 1px solid var(--border);
}
.nav-list a:first-child { border-radius: 4px 4px 0 0; }
.nav-list a:last-child { border-radius: 0 0 4px 4px; }
.nav-list a:only-child { border-radius: 4px; }
.nav-list a:hover { background: var(--bg); }

.badge {
  font-size: 0.7rem;
  color: var(--text-muted);
  background: var(--hover);
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
}

.list { list-style: none; }
.list li + li { border-top: 1px solid var(--border); }
.list a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.6rem 0;
  color: inherit;
  text-decoration: none;
}
.list a:hover strong { color: var(--text-secondary); }
.list strong { font-size: 0.85rem; font-weight: 500; }
.list small { font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; margin-left: 1rem; }

.empty { font-size: 0.85rem; color: var(--text-muted); padding: 2rem 0; text-align: center; }

.back {
  display: inline-block;
  font-size: 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  margin-bottom: 0.5rem;
}
.back:hover { color: var(--text-secondary); }
.confirm .confirm-prompt {
  font-size: 0.8rem;
  color: var(--danger);
  margin-right: auto;
  align-self: center;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  background: var(--surface);
  border-radius: 6px;
  padding: 1.5rem;
  width: 90%;
  max-width: 400px;
  box-shadow: var(--shadow);
}
.modal h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
.modal .toolbar { margin-top: 1rem; margin-bottom: 0; justify-content: flex-end; flex-wrap: nowrap; }

/* Sidebar (desktop) and dock (mobile) */
/* --- Sidebar (desktop) & Dock (mobile) --- */

.sidebar, .dock { display: none; }

@media (pointer: fine) {
  body:has(.sidebar) { padding-left: 56px; }
  .sidebar {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 56px;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0;
    gap: 0.25rem;
    background: var(--surface);
    border-right: 1px solid var(--border);
    z-index: 100;
  }
  .sidebar a {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    color: var(--text-muted);
    text-decoration: none;
  }
  .sidebar a:hover { background: var(--hover); color: var(--text-secondary); }
  .sidebar a.active { color: var(--primary); background: var(--hover); }
  .sidebar .spacer { flex: 1; }
  .sidebar svg { width: 20px; height: 20px; }
}

@media (pointer: coarse) {
  .dock {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    flex-direction: row;
    justify-content: space-around;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 0.4rem 0 env(safe-area-inset-bottom, 0);
    z-index: 100;
  }
  .dock a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.35rem 1rem;
    font-size: 0.65rem;
    color: var(--text-muted);
    text-decoration: none;
  }
  .dock a.active { color: var(--primary); }
  .dock a:hover { color: var(--text-secondary); }
  .dock svg { width: 20px; height: 20px; }
  /* the rest of the touch rules for the components above */
  .nav-list a { min-height: 44px; padding: 0.75rem 1rem; }
  .list a { padding: 0.75rem 0; }
  .back { padding: 0.5rem 0; }
  h2 { font-size: 1.25rem; }
  .confirm .confirm-prompt { font-size: 0.85rem; }
}
```

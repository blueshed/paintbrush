# Paintbrush Design System

The rules behind `src/styles.css`, for AI agents. All values are concrete: use them as-is. This file describes what the starter's stylesheet has. Navigation, lists, modals and the sidebar and dock are in the `add-part` skill (`parts/design-system.md`); add them, and their notes here, when the app needs them.

## Look

Minimal, content-first utility app. Light background, high contrast text, no decoration. Dense on desktop, touch-friendly on mobile. The UI disappears: the content is the interface.

## Colours

Every colour is a variable in `:root`. Never hard-code a hex value in a component.

| Variable | Value | Role |
|---|---|---|
| `--bg` | `#f8f9fa` | Page background |
| `--surface` | `white` | Buttons, and text on `.primary` and toasts |
| `--text` | `#1a1a1a` | Primary text |
| `--text-secondary` | `#555` | Help text |
| `--text-muted` | `#999` | Metadata |
| `--border-mid` | `#ddd` | Input borders |
| `--border-strong` | `#ccc` | Button borders |
| `--hover` | `#f0f0f0` | Hover background |
| `--code-bg` | `#e9ecef` | Inline code background |
| `--primary` | `#1a1a1a` | Primary button: black, not blue |
| `--primary-hover` | `#333` | Primary button hover |
| `--danger` | `#c33` | Alert toast |
| `--notify` | `#e67e22` | Notify toast |

## Type

System font (`system-ui, -apple-system, sans-serif`), `line-height: 1.5`.

| Element | Size | Weight |
|---|---|---|
| `h1` | `1.25rem` (touch: `1.5rem`), bottom margin `1rem` | 600 |
| Button | `0.8rem` (touch: `0.85rem`) | 400 |
| Input and textarea | `0.85rem` (touch: `1rem`), `font-family: inherit` | 400 |
| `.help` | `0.8rem`, `--text-secondary`, `line-height: 1.6` | 400 |
| `.meta` | `0.7rem`, `--text-muted` | 400 |

## Components

- **Button.** `border-radius: 4px`, white with a `--border-strong` border, `--hover` background on hover. `.primary` is black with white text.
- **Input and textarea.** `width: 100%`, `1px solid var(--border-mid)`, `border-radius: 4px`. Textarea `min-height: 120px`, `resize: vertical`.
- **`.toolbar`.** A flex row, `align-items: baseline`, `gap: 0.5rem`, `margin-bottom: 1rem`. A heading inside takes `margin-right: auto`, which pushes the buttons right.
- **`.toast`.** Fixed bottom-centre, fades in and out over `0.2s`. `.notify` (orange) for success, `.alert` (red) for a failure. Shown for 1500ms. Call `toast("Saved")` or `toast("Not saved", "alert")` from `src/resources/toast.ts`.
- **`.help` and `.meta`.** Explanatory text under content, and small secondary information.

## Layout

| Property | Value |
|---|---|
| Content width | `max-width: 640px`, centred |
| Page padding | `2rem 1rem` |
| Scroll | on `#app` (`height: 100dvh; overflow-y: auto`), not on the body: it stops rubber-banding on fixed elements |
| Spacing | `rem`, no fixed scale: `0.25`, `0.5`, `0.75`, `1`, `1.5`, `2` |
| Word wrap | `overflow-wrap: anywhere` |

## Responsive

The test is the pointer, not the width: `@media (pointer: coarse)` makes buttons and inputs at least 44px high and enlarges `h1`. There are no width breakpoints.

## Do and don't

- Do use `.toolbar` for any row of buttons, or a heading with buttons.
- Do give feedback with a toast: `notify` for success, `alert` for a failure. Never the browser's `alert()` or `confirm()`.
- Do keep views flat: no card inside a card.
- Do use `when()` for a conditional and `list()` for a collection that changes length.
- Don't add shadows, gradients, hero sections or decoration.
- Don't colour the primary button: it is black.
- Don't make pill buttons: the radius is `4px`.
- Don't add animation beyond the toast's fade, or stack toasts.

## Adding a view

1. Make a resource (see "Adding a resource" in `CLAUDE.md`); the view is `src/resources/<name>/<name>-view.tsx`.
2. Head it with a `.toolbar` holding the `h1` and the buttons.
3. Put a form field in a `label` only if the app has styled labels (see the design-system part); otherwise a bare `input` or `textarea` is already styled.
4. Say "Saved" or "Not saved" with a toast, after the server has answered.
5. Choose a colour by role: an action is `.primary`; secondary text is `--text-secondary`; metadata is `--text-muted`; a failure is `--danger`.

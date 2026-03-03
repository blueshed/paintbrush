# View component patterns

Web components use shadow DOM with adopted stylesheets. For collections, create two elements: `{name}-list` and `{name}-detail`.

## Boilerplate

Every view component follows this structure:

```ts
import { effect } from "../../lib/signals";
import { toast } from "../../lib/toast";
import { navigate } from "../../lib/routes";
// import store functions from "./{name}"

const template = document.createElement("template");
template.innerHTML = `...`;

function adoptDocumentStyles(shadow: ShadowRoot) {
  const sheets: CSSStyleSheet[] = [];
  for (const s of document.styleSheets) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(Array.from(s.cssRules, (r) => r.cssText).join("\n"));
      sheets.push(sheet);
    } catch { /* cross-origin sheets */ }
  }
  shadow.adoptedStyleSheets = sheets;
}
```

`adoptDocumentStyles` copies the global `styles.css` rules into the shadow root. CSS custom properties (`:root` variables) pierce the shadow boundary automatically, but class-based rules need this explicit adoption.

## List component (`{name}-list`)

### Template

```html
<div class="toolbar">
  <h1>{Name}s</h1>
  <button class="primary" part="new">+ New</button>
</div>
<ul class="list" part="list"></ul>
<p class="empty" part="empty" hidden>No {names} yet.</p>
```

### Behaviour

```ts
export class {Name}List extends HTMLElement {
  #shadow: ShadowRoot;
  #dispose?: () => void;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    adoptDocumentStyles(this.#shadow);
    const list = this.#shadow.querySelector("ul")!;
    const empty = this.#shadow.querySelector(".empty")!;
    const newBtn = this.#shadow.querySelector("button")!;

    // Load data
    load{Name}s();

    // If real-time:
    const stopWs = connect{Name}s();

    // Reactive render
    const stopEffect = effect(() => {
      const items = {names}.get();
      empty.hidden = items.length > 0;
      list.innerHTML = items.map(item => `
        <li><a href="#/{names}/${item.id}">
          <strong>${item.title}</strong>
          <small>${new Date(item.createdAt).toLocaleDateString()}</small>
        </a></li>
      `).join("");
    });

    // Create new item
    newBtn.addEventListener("click", async () => {
      const item = await create{Name}({ title: "Untitled" });
      navigate(`/{names}/${item.id}`);
    });

    this.#dispose = () => { stopEffect(); stopWs(); };
  }

  disconnectedCallback() { this.#dispose?.(); }
}
customElements.define("{name}-list", {Name}List);
```

### Key points

- `effect()` re-renders the list whenever the signal changes (local saves or WS updates)
- Use `hidden` attribute on `.empty` to toggle empty state
- Links use `href="#/{names}/${id}"` — the hash router picks them up
- For create: POST via store function, then `navigate()` to the new item

## Detail component (`{name}-detail`)

### Template

```html
<a class="back" href="#/{names}">&larr; {Name}s</a>
<h1>Edit {Name}</h1>
<form>
  <label>Title <input type="text" part="title"></label>
  <!-- add label+input for each field -->
  <div class="toolbar" part="actions">
    <button type="button" class="primary" part="save">Save</button>
    <button type="button" class="danger" part="delete">Delete</button>
  </div>
  <div class="toolbar confirm" part="confirm" hidden>
    <span class="confirm-prompt">Delete this {name}?</span>
    <button type="button" class="danger" part="confirm-yes">Yes, delete</button>
    <button type="button" part="confirm-no">No</button>
  </div>
</form>
```

### Behaviour

```ts
export class {Name}Detail extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    adoptDocumentStyles(this.#shadow);
    const id = this.dataset.id!;
    const titleInput = this.#shadow.querySelector("[part=title]") as HTMLInputElement;
    const saveBtn = this.#shadow.querySelector("[part=save]") as HTMLButtonElement;
    const deleteBtn = this.#shadow.querySelector("[part=delete]") as HTMLButtonElement;
    const actions = this.#shadow.querySelector("[part=actions]") as HTMLElement;
    const confirm = this.#shadow.querySelector("[part=confirm]") as HTMLElement;
    const confirmYes = this.#shadow.querySelector("[part=confirm-yes]") as HTMLButtonElement;
    const confirmNo = this.#shadow.querySelector("[part=confirm-no]") as HTMLButtonElement;

    // Load item and populate form
    load{Name}(id).then(item => {
      if (!item) { navigate("/{names}"); return; }
      titleInput.value = item.title;
      // populate other fields...
    });

    // Save
    saveBtn.addEventListener("click", async () => {
      await save{Name}(id, { title: titleInput.value });
      toast("Saved");
    });

    // Delete with confirm
    deleteBtn.addEventListener("click", () => {
      actions.hidden = true;
      confirm.hidden = false;
    });
    confirmNo.addEventListener("click", () => {
      confirm.hidden = true;
      actions.hidden = false;
    });
    confirmYes.addEventListener("click", async () => {
      await remove{Name}(id);
      toast("Deleted", "alert");
      navigate("/{names}");
    });
  }
}
customElements.define("{name}-detail", {Name}Detail);
```

### Key points

- `data-id` attribute is set by the router: `<{name}-detail data-id="${id}">`
- Read it in `connectedCallback` via `this.dataset.id`
- Confirm delete uses toolbar swap: hide `[part=actions]`, show `[part=confirm]`
- After delete, `navigate()` back to the list
- Toast styles: `"notify"` (orange) for save, `"alert"` (red) for delete

## Route handler return types

The hash router (`lib/routes.ts`) accepts these return types from handlers:

| Return | Behaviour |
|--------|-----------|
| `string` | Set as `target.innerHTML` — use for custom element tags like `"<{name}-list></{name}-list>"` |
| `Node` | Appended to target |
| `() => void` | Stored as dispose callback, called on route change |
| `void` | Handler manages DOM itself |

## Cleanup

Always clean up in `disconnectedCallback`:
- `effect()` returns a dispose function — call it
- `connect{Name}s()` returns a dispose function — call it
- Combine them: `this.#dispose = () => { stopEffect(); stopWs(); }`

The router calls `disconnectedCallback` automatically when navigating away (it clears `target.innerHTML`).

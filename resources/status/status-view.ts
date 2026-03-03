import { effect } from "@lib/signals";
import { status, loadStatus } from "./status";

function adoptDocumentStyles(shadow: ShadowRoot) {
  const sheets: CSSStyleSheet[] = [];
  for (const s of document.styleSheets) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(Array.from(s.cssRules, (r) => r.cssText).join("\n"));
      sheets.push(sheet);
    } catch {
      /* cross-origin sheets */
    }
  }
  shadow.adoptedStyleSheets = sheets;
}

export class StatusView extends HTMLElement {
  #shadow: ShadowRoot;
  #dispose?: () => void;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    adoptDocumentStyles(this.#shadow);
    loadStatus();

    this.#dispose = effect(() => {
      const s = status.get();
      if (!s) return;
      this.#shadow.innerHTML = `
        <p class="help">
          Your data is stored at <code>${s.dataPath}</code>
          ${
            s.persistent
              ? "on a mounted volume — it survives redeploys."
              : "(ephemeral — will reset on redeploy)."
          }
        </p>
        <p class="meta">Uptime ${s.uptime}s · Bun ${s.bun}</p>
      `;
    });
  }

  disconnectedCallback() {
    this.#dispose?.();
  }
}

customElements.define("status-view", StatusView);

import { effect } from "../../lib/signals";
import { toast } from "../../lib/toast";
import {
  message,
  status,
  loadMessage,
  saveMessage,
  connectMessage,
} from "./message";
import type { Status } from "./message";

const template = document.createElement("template");
template.innerHTML = `
  <slot name="title">
    <h1 style="display:flex;justify-content:space-between;align-items:baseline">
      <span>Paintbrush</span>
      <img src="/logo.png" alt="" style="height:2rem">
    </h1>
  </slot>
  <textarea part="editor"></textarea>
  <div class="toolbar">
    <slot name="actions"><button class="primary" part="save">Save</button></slot>
  </div>
  <slot name="help"></slot>
  <slot name="meta"></slot>
`;

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

function renderStatus(el: HTMLElement, s: Status) {
  if (!el.querySelector("[slot=help]")) {
    const help = document.createElement("p");
    help.slot = "help";
    help.className = "help";
    help.innerHTML = `
      Edit the message above and hit <strong>Save</strong> to persist it.
      Your data is stored at <code>${s.dataPath}</code>
      ${
        s.persistent
          ? "on a mounted volume — it survives redeploys."
          : "(ephemeral — will reset on redeploy)."
      }`;
    el.appendChild(help);
  }
  if (!el.querySelector("[slot=meta]")) {
    const meta = document.createElement("p");
    meta.slot = "meta";
    meta.className = "meta";
    meta.textContent = `Uptime ${s.uptime}s \u00b7 Bun ${s.bun}`;
    el.appendChild(meta);
  }
}

export class MessageView extends HTMLElement {
  #shadow: ShadowRoot;
  #dispose?: () => void;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    adoptDocumentStyles(this.#shadow);
    const ta = this.#shadow.querySelector("textarea")!;
    const btn = this.#shadow.querySelector("button")!;

    const stopWs = connectMessage();
    const stopEffect = effect(() => {
      const msg = message.get();
      if (msg) ta.value = msg.message;
    });

    loadMessage().then(() => {
      const s = status.peek();
      if (s) renderStatus(this, s);
    });

    btn.addEventListener("click", async () => {
      await saveMessage({ message: ta.value });
      toast("Saved");
    });

    this.#dispose = () => {
      stopEffect();
      stopWs();
    };
  }

  disconnectedCallback() {
    this.#dispose?.();
  }
}

customElements.define("message-view", MessageView);

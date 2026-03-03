/**
 * Toast — lightweight notification utility
 *
 * Setup (once in app.ts):
 *   provide("toast", initToast());
 *
 * Usage (either way):
 *   import { toast } from "./lib/toast";
 *   inject<Toast>("toast")("Saved", "notify");
 */

export type Toast = (msg: string, style?: "notify" | "alert") => void;

let el: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout>;

export function toast(msg: string, style: "notify" | "alert" = "notify") {
  if (!el) return;
  clearTimeout(timer);
  el.textContent = msg;
  el.className = "toast show " + style;
  timer = setTimeout(() => el!.classList.remove("show"), 1500);
}

export function initToast(): Toast {
  el = document.createElement("div");
  el.className = "toast";
  document.body.appendChild(el);
  return toast;
}

import { signal } from "@blueshed/railroad";

/**
 * A resource as the page sees it. It has the shape of a delta document's client
 * handle, with `data` a signal, so a view hardly changes when a resource is made
 * live later: `load` and `save` become `openDoc` and `send`.
 */
export function resource<T>(url: string) {
  const data = signal<T | null>(null);
  const failed = signal(false);

  async function request(method: "GET" | "PUT", body?: T): Promise<T> {
    const res = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) throw new Error(`${method} ${url} answered ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    /** The server's last answer; null until the first load */
    data,
    /** True when the last load failed */
    failed,
    /** Ask the server. A failure sets `failed` instead of throwing, so a view can say so. */
    load: () =>
      request("GET").then(
        (value) => {
          data.set(value);
          failed.set(false);
        },
        () => failed.set(true),
      ),
    /** Write the whole value. Throws unless the server says 2xx, so a view can say "Not saved". */
    save: async (value: T) => data.set(await request("PUT", value)),
  };
}

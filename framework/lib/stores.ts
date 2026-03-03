/**
 * Store interface — pluggable backing stores for resources.
 *
 * A store provides read/write for a collection of items.
 * Each item must have a string `id` field.
 */

export interface Store<T extends { id: string } = { id: string }> {
  read(): Promise<T[]>;
  write(items: T[]): Promise<void>;
}

/**
 * In-memory store — useful for tests. Optionally seeded with initial data.
 */
export function memoryStore<T extends { id: string }>(initial: T[] = []): Store<T> {
  let items = [...initial];
  return {
    async read() { return [...items]; },
    async write(next) { items = [...next]; },
  };
}

/**
 * JSON file store — reads/writes an array of items to a local JSON file.
 */
export function jsonFile<T extends { id: string }>(path: string): Store<T> {
  return {
    async read(): Promise<T[]> {
      try {
        return await Bun.file(path).json();
      } catch {
        return [];
      }
    },
    async write(items: T[]): Promise<void> {
      await Bun.write(path, JSON.stringify(items, null, 2));
    },
  };
}

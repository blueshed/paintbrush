/**
 * A value kept in one JSON file: the first rung of the storage ladder (a JSON file,
 * then SQLite, then Postgres). `empty` is what it is before anything has been written.
 */
export function jsonFile<T>(path: string, empty: T) {
  // A new BunFile for each read: one that found no file keeps saying so, even after it is written
  const file = () => Bun.file(path);

  return {
    read: async (): Promise<T> => {
      const stored = file();
      return (await stored.exists()) ? await stored.json() : empty;
    },

    write: async (value: T): Promise<T> => {
      await Bun.write(file(), JSON.stringify(value)); // creates the folder if it is missing
      return value;
    },
  };
}

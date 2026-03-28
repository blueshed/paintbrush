/** Status — shared type, used by both server and client. */
export type Status = {
  dataPath: string;
  persistent: boolean;
  uptime: number;
  bun: string;
};

import { resource } from "../resource";
import type { Status } from "./api";

export const status = resource<Status>("/api/status");

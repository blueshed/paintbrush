import { resource } from "../resource";
import type { Message } from "./api";

export const message = resource<Message>("/api/message");

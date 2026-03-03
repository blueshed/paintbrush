import { routes } from "./lib/routes";
import { reconnectingWebSocket } from "./lib/reconnecting-ws";
import { provide } from "./lib/shared";
import { initToast } from "./lib/toast";
import "./resources/message/message-view";
import "./resources/status/status-view";

const app = document.getElementById("app")!;
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
provide("ws", reconnectingWebSocket(`${wsProto}//${location.host}/ws`));
provide("toast", initToast());

routes(app, {
  "/": () => "<message-view></message-view><status-view></status-view>",
});

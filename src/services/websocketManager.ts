import { CellOutput } from "../types";
import { createId } from "../utils/id";

type Listener = (output: CellOutput) => void;

type ListenerEntry = {
  msgId: string;
  onOutput: Listener;
};

type SocketEntry = {
  socket: WebSocket;
  listeners: Set<ListenerEntry>;
  isOpen: boolean;
  queue: string[];
  sessionId: string;
};

const socketMap = new Map<string, SocketEntry>();

const resolveWsBase = (baseUrl: string) => {
  if (baseUrl.startsWith("https")) {
    return baseUrl.replace("https", "wss");
  }
  return baseUrl.replace("http", "ws");
};

const buildSocketUrl = (kernelId: string, token: string) => {
  const wsBase = resolveWsBase(
    import.meta.env.VITE_JUPYTER_BASE_URL ??
      "http://localhost:8000/user/admin/api"
  );
  const base = `${wsBase}/kernels/${kernelId}/channels`;
  return token ? `${base}?token=${token}` : base;
};

const ensureSocket = (kernelId: string) => {

  const token = import.meta.env.VITE_JUPYTER_TOKEN ?? "";
  const existing = socketMap.get(kernelId);
  if (existing) {
    return existing;
  }
  const socket = new WebSocket(buildSocketUrl(kernelId, token));
  const entry: SocketEntry = {
    socket,
    listeners: new Set(),
    isOpen: false,
    queue: [],
    sessionId: createId(),
  };
  socket.onopen = () => {
    entry.isOpen = true;
    entry.queue.forEach((message) => socket.send(message));
    entry.queue = [];
  };
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data as string) as {
        msg_type?: string;
        header?: { msg_type?: string };
        parent_header?: { msg_id?: string };
        content?: Record<string, unknown>;
      };
      const msgType = payload.msg_type ?? payload.header?.msg_type ?? "unknown";
      const parentMsgId = payload.parent_header?.msg_id;
      if (!parentMsgId) {
        return;
      }
      const output = toOutput(payload);
      if (!output) {
        return;
      }
      entry.listeners.forEach((listener) => {
        if (listener.msgId === parentMsgId) {
          listener.onOutput(output);
        }
      });
    } catch (error) {
      entry.listeners.forEach((listener) =>
        listener.onOutput({
          id: createId(),
          type: "error",
          text: `Failed to parse kernel message: ${
            (error as Error).message ?? "unknown error"
          }`,
        })
      );
    }
  };
  socket.onclose = () => {
   entry.isOpen = false;
   socketMap.delete(kernelId);
  };
  socket.onerror = () => {
    entry.listeners.forEach((listener) =>
      listener.onOutput({
        id: createId(),
        type: "error",
        text: "WebSocket error while communicating with kernel.",
      })
    );
  };
  socketMap.set(kernelId, entry);
  return entry;
};

const toOutput = (payload: {
  msg_type?: string;
  header?: { msg_type?: string };
  content?: Record<string, unknown>;
}): CellOutput | null => {
  const msg_type = payload.msg_type ?? payload.header?.msg_type ?? "";
  const { content } = payload;
  if (!content) {
    return null;
  }
  if (msg_type === "stream") {
    const text = Array.isArray(content.text)
      ? content.text.join("")
      : typeof content.text === "string"
      ? content.text
      : "";
    if (text) {
      return { id: createId(), type: "stream", text };
    }
  }
  if (msg_type === "execute_result" || msg_type === "display_data") {
    const data = content.data as Record<string, string | string[]> | undefined;
    const raw = data?.["text/plain"];
    const text = Array.isArray(raw) ? raw.join("") : raw;
    if (text) {
      return { id: createId(), type: "result", text };
    }
  }
  if (msg_type === "error") {
    const traceback = content.traceback as string[] | undefined;
    return {
      id: createId(),
      type: "error",
      text: traceback?.join("\n") ?? "Kernel execution error.",
    };
  }
  if (msg_type === "status" && typeof content.execution_state === "string") {
    return {
      id: createId(),
      type: "status",
      text: `Kernel status: ${content.execution_state}`,
    };
  }
  return null;
};

const buildExecuteRequest = (code: string, session: string, msgId: string) =>
  JSON.stringify({
    header: {
      msg_id: msgId,
      username: "admin",
      session,
      msg_type: "execute_request",
      version: "5.3",
    },
    parent_header: {},
    metadata: {},
    content: {
      code,
      silent: false,
      store_history: true,
      user_expressions: {},
      allow_stdin: false,
      stop_on_error: true,
    },
    channel: "shell",
  });

export const runCode = (
  kernelId: string,
  code: string,
  onOutput: Listener
) => {
  const entry = ensureSocket(kernelId);
  const msgId = createId();
  const listenerEntry: ListenerEntry = { msgId, onOutput };
  entry.listeners.add(listenerEntry);
  const payload = buildExecuteRequest(code, entry.sessionId, msgId);
  if (entry.isOpen) {
    entry.socket.send(payload);
  } else {
    entry.queue.push(payload);
  }
  return () => {
    entry.listeners.delete(listenerEntry);
    if (entry.listeners.size === 0) {
      entry.socket.close();
    }
  };
};

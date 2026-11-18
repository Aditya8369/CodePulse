import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { BattleSocketProvider } from "./battle-socket-provider";
import { WebSocketStatusIndicator } from "./websocket-status-indicator";

type Listener = (...args: unknown[]) => void;
const { socket, socketListeners, managerListeners } = vi.hoisted(() => {
  const socketListeners = new Map<string, Listener>();
  const managerListeners = new Map<string, Listener>();
  const socket = {
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: Listener) => socketListeners.set(event, handler)),
    off: vi.fn((event: string) => socketListeners.delete(event)),
    io: {
      on: vi.fn((event: string, handler: Listener) => managerListeners.set(event, handler)),
      off: vi.fn((event: string) => managerListeners.delete(event)),
    },
  };
  return { socket, socketListeners, managerListeners };
});

vi.mock("@/lib/socket-client", () => ({
  createBattleSocket: () => socket,
  MAX_RECONNECT_ATTEMPTS: 5,
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), success: vi.fn() } }));

function emit(listeners: Map<string, Listener>, event: string, ...args: unknown[]) {
  act(() => listeners.get(event)?.(...args));
}

beforeEach(() => {
  socket.connected = false;
  socket.connect.mockClear();
  socket.disconnect.mockClear();
  socketListeners.clear();
  managerListeners.clear();
  vi.mocked(toast.warning).mockClear();
  vi.mocked(toast.success).mockClear();
});

describe("battle socket status", () => {
  it("tracks disconnect, capped retries, manual retry and recovery without a reload", () => {
    const view = render(
      <BattleSocketProvider><WebSocketStatusIndicator /></BattleSocketProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Battle connecting");
    expect(socket.connect).toHaveBeenCalledOnce();

    socket.connected = true;
    emit(socketListeners, "connect");
    expect(screen.getByRole("status")).toHaveTextContent("Battle connected");
    expect(toast.success).not.toHaveBeenCalled();

    socket.connected = false;
    emit(socketListeners, "disconnect", "transport close");
    expect(screen.getByRole("status")).toHaveTextContent("Battle reconnecting");
    expect(toast.warning).toHaveBeenCalledOnce();

    emit(managerListeners, "reconnect_attempt", 3);
    expect(screen.getByRole("status")).toHaveTextContent("(3/5)");
    emit(managerListeners, "reconnect_failed");
    expect(screen.getByRole("status")).toHaveTextContent("Battle disconnected");
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    expect(socket.connect).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Battle connecting");

    socket.connected = true;
    emit(socketListeners, "connect");
    expect(screen.getByRole("status")).toHaveTextContent("Battle connected");
    expect(toast.success).toHaveBeenCalledOnce();
    view.unmount();
    expect(socket.disconnect).toHaveBeenCalledOnce();
    expect(socketListeners.size).toBe(0);
    expect(managerListeners.size).toBe(0);
  });

  it("does not warn or retry when the provider deliberately disconnects", () => {
    render(<BattleSocketProvider><WebSocketStatusIndicator /></BattleSocketProvider>);
    emit(socketListeners, "disconnect", "io client disconnect");
    expect(toast.warning).not.toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalledOnce();
  });
});

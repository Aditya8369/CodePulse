"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { createBattleSocket, MAX_RECONNECT_ATTEMPTS } from "@/lib/socket-client";

export type BattleSocketStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface BattleSocketContextValue {
  status: BattleSocketStatus;
  attempt: number;
  retry: () => void;
  socket: Socket | null;
}

const BattleSocketContext = createContext<BattleSocketContextValue | null>(null);

export function BattleSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BattleSocketStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const hasConnected = useRef(false);
  const lostConnection = useRef(false);

  useEffect(() => {
    const socket = createBattleSocket();
    socketRef.current = socket;

    const onConnect = () => {
      if (hasConnected.current && lostConnection.current) {
        toast.success("Battle connection restored");
      }
      hasConnected.current = true;
      lostConnection.current = false;
      setAttempt(0);
      setStatus("connected");
    };

    const onDisconnect = (reason: Socket.DisconnectReason) => {
      if (reason === "io client disconnect") return;
      if (hasConnected.current && !lostConnection.current) {
        toast.warning("Battle connection lost. Reconnecting…");
      }
      lostConnection.current = true;
      setStatus("reconnecting");
      setAttempt(0);
      // Socket.IO does not automatically retry a server-initiated disconnect.
      if (reason === "io server disconnect") socket.connect();
    };

    const onConnectError = () => {
      setStatus((current) => current === "disconnected" ? current : "reconnecting");
    };
    const onReconnectAttempt = (nextAttempt: number) => {
      setStatus("reconnecting");
      setAttempt(nextAttempt);
    };
    const onReconnectFailed = () => {
      setStatus("disconnected");
      setAttempt(MAX_RECONNECT_ATTEMPTS);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const retry = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.connected) return;
    setAttempt(0);
    setStatus("connecting");
    socket.connect();
  }, []);

  return (
    <BattleSocketContext.Provider value={{ status, attempt, retry, socket: socketRef.current }}>
      {children}
    </BattleSocketContext.Provider>
  );
}

export function useBattleSocketStatus() {
  const context = useContext(BattleSocketContext);
  if (!context) throw new Error("useBattleSocketStatus requires BattleSocketProvider");
  return context;
}

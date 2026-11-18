import { io } from "socket.io-client";

export const MAX_RECONNECT_ATTEMPTS = 5;

export function battleSocketUrl(apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://codepulse-h6ou.onrender.com/api/v1") {
  return `${new URL(apiUrl, typeof window === "undefined" ? "http://localhost:3000" : window.location.origin).origin}/battles`;
}

export function createBattleSocket() {
  return io(battleSocketUrl(), {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 16000,
    randomizationFactor: 0,
    timeout: 5000,
  });
}

import { describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { battleSocketUrl, createBattleSocket } from "./socket-client";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));

describe("battle socket client", () => {
  it("targets the existing Nest battle namespace for absolute and relative API URLs", () => {
    expect(battleSocketUrl("https://api.example.com/api/v1"))
      .toBe("https://api.example.com/battles");
    expect(battleSocketUrl("/api/v1"))
      .toBe(`${window.location.origin}/battles`);
  });

  it("uses capped exponential reconnect without connecting during render", () => {
    createBattleSocket();
    expect(io).toHaveBeenCalledWith(expect.stringMatching(/\/battles$/), {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      randomizationFactor: 0,
      timeout: 5000,
    });
  });
});

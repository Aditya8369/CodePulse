"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { createBattleSocket } from "@/lib/socket-client";
import {
  StudioDirector as StudioDirectorClass,
  studioDirector,
  type BattleTelemetryEvent,
  type PlayerId,
} from "@/lib/battle-director";
import { SpectatorMultiView } from "@/components/battles/spectator-multi-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface StudioDirectorProps {
  battleId: string;
}

const MOCK_PLAYERS: Record<PlayerId, { username: string; avatar: string }> = {
  p1: { username: "alpha_dev", avatar: "https://github.com/alpha_dev.png" },
  p2: { username: "beta_dev", avatar: "https://github.com/beta_dev.png" },
};

export function StudioDirector({ battleId }: StudioDirectorProps) {
  const searchParams = useSearchParams();
  const p1Name = searchParams.get("p1") || MOCK_PLAYERS.p1.username;
  const p2Name = searchParams.get("p2") || MOCK_PLAYERS.p2.username;
  const [connected, setConnected] = useState(false);
  const [, setFocus] = useState<"p1" | "p2" | "balanced">("balanced");
  const studioRef = useRef<StudioDirectorClass>(studioDirector);

  const ingestSocketEvent = useCallback(
    (event: BattleTelemetryEvent) => {
      const result = studioRef.current.ingest(event);
      setFocus(result.focus);
    },
    [],
  );

  useEffect(() => {
    const studio = studioRef.current;
    studio.reset();
    setFocus("balanced");

    const sock = createBattleSocket();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onKeystroke = (data: Record<string, unknown>) => {
      const player: PlayerId =
        String(data.userId) === searchParams.get("p1UserId") ||
        String(data.userId) === p1Name
          ? "p1"
          : "p2";
      ingestSocketEvent({
        battleId,
        userId: String(data.userId),
        player,
        eventType: "keystroke",
        data: { deltaLength: Number(data.deltaLength ?? 0), cursorPosition: data.cursorPosition },
        timestamp: Number(data.timestamp ?? Date.now()),
      });
    };

    const onTestProgress = (data: Record<string, unknown>) => {
      const player: PlayerId =
        String(data.userId) === searchParams.get("p1UserId") ||
        String(data.userId) === p1Name
          ? "p1"
          : "p2";
      ingestSocketEvent({
        battleId,
        userId: String(data.userId),
        player,
        eventType: "test_case_eval",
        data: {
          passedCount: Number(data.passedCount ?? 0),
          totalCount: Number(data.totalCount ?? 0),
          executionTimeMs: data.executionTimeMs,
        },
        timestamp: Number(data.timestamp ?? Date.now()),
      });
    };

    const onCodeSubmit = (data: Record<string, unknown>) => {
      const player: PlayerId =
        String(data.userId) === searchParams.get("p1UserId") ||
        String(data.userId) === p1Name
          ? "p1"
          : "p2";
      ingestSocketEvent({
        battleId,
        userId: String(data.userId),
        player,
        eventType: "code_submit",
        data: {},
        timestamp: Date.now(),
      });
    };

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("opponent_keystroke_stream", onKeystroke);
    sock.on("player_test_case_progress", onTestProgress);
    sock.on("player_solved_private_round", onCodeSubmit);

    sock.connect();
    void sock.emit("request_spectator_stream", { battleId, spectatorId: "spectator-web" });

    return () => {
      sock.off("connect", onConnect);
      sock.off("disconnect", onDisconnect);
      sock.off("opponent_keystroke_stream", onKeystroke);
      sock.off("player_test_case_progress", onTestProgress);
      sock.off("player_solved_private_round", onCodeSubmit);
      sock.disconnect();
      studio.reset();
    };
  }, [battleId, p1Name, ingestSocketEvent, searchParams]);

  const telemetryP1 = studioRef.current.getTelemetry("p1");
  const telemetryP2 = studioRef.current.getTelemetry("p2");

  return (
    <div className="h-full w-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">
            SD
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">Studio Director</h1>
            <p className="text-xs text-muted-foreground">
              Battle #{battleId.slice(0, 8)} · Live Esports Director AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium border",
              connected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20",
            )}
          >
            {connected ? "LIVE" : "OFFLINE"}
          </span>
          <Button variant="outline" size="sm" disabled={!connected}>
            <Loader2 className={cn("w-3 h-3 animate-spin", !connected ? "" : "hidden")} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Competitors</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Telemetry live
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <SpectatorMultiView
              battleId={battleId}
              player1={{
                id: "p1",
                username: p1Name,
                avatar: `https://github.com/${p1Name}.png`,
                telemetry: {
                  apm: telemetryP1.apm,
                  burstApm: telemetryP1.burstApm,
                  testProgress: telemetryP1.testProgress,
                  failingTests: telemetryP1.failingTests,
                  syntaxErrors: telemetryP1.syntaxErrors,
                  lastEvent: telemetryP1.lastEvent?.eventType ?? null,
                },
              }}
              player2={{
                id: "p2",
                username: p2Name,
                avatar: `https://github.com/${p2Name}.png`,
                telemetry: {
                  apm: telemetryP2.apm,
                  burstApm: telemetryP2.burstApm,
                  testProgress: telemetryP2.testProgress,
                  failingTests: telemetryP2.failingTests,
                  syntaxErrors: telemetryP2.syntaxErrors,
                  lastEvent: telemetryP2.lastEvent?.eventType ?? null,
                },
              }}
              layout="auto"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

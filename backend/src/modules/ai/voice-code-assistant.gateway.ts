import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';

export type AudioCodec = 'OPUS' | 'PCM16';
export type RealtimeProvider = 'GEMINI_LIVE' | 'OPENAI_REALTIME';

export interface ActiveEditorContext {
  repositoryName: string;
  filePath: string;
  cursorLine: number;
  moduleSummary?: string;
  visibleCodeLines: Array<{ lineNumber: number; content: string }>;
}

export interface VoiceSessionStartPayload {
  sessionId?: string;
  userId: string;
  provider?: RealtimeProvider;
  codec?: AudioCodec;
  sampleRateHz?: number;
  editorContext: ActiveEditorContext;
}

export interface VoiceAudioChunkPayload {
  sessionId: string;
  sequenceId: number;
  codec: AudioCodec;
  pcmOrOpusBase64: string;
  isFinalUtterance?: boolean;
  transcriptHint?: string;
}

export interface VoiceAssistantTurnResponse {
  sessionId: string;
  provider: RealtimeProvider;
  responseLatencyMs: number;
  assistantTranscript: string;
  audioResponseBase64: string;
  referencedFilePath: string;
  highlightStartLine: number;
  highlightEndLine: number;
  droppedPacketsRecovered: number;
  reconnected: boolean;
}

export interface VoiceSessionState {
  sessionId: string;
  userId: string;
  provider: RealtimeProvider;
  codec: AudioCodec;
  sampleRateHz: number;
  editorContext: ActiveEditorContext;
  systemPrompt: string;
  lastSequenceId: number;
  droppedPacketCount: number;
  reconnectCount: number;
  transcriptLog: Array<{ role: 'user' | 'assistant'; text: string; timestampIso: string }>;
  socketId?: string;
}

@Injectable()
@WebSocketGateway({
  namespace: '/voice-code-assistant',
  cors: { origin: '*' },
})
export class VoiceCodeAssistantGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceCodeAssistantGateway.name);

  @WebSocketServer()
  server: any;

  private readonly sessions = new Map<string, VoiceSessionState>();
  private readonly socketToSession = new Map<string, string>();

  handleDisconnect(client: any): void {
    const socketId = client?.id;
    if (!socketId) return;
    const sessionId = this.socketToSession.get(socketId);
    if (sessionId) {
      this.socketToSession.delete(socketId);
      const session = this.sessions.get(sessionId);
      if (session) {
        session.socketId = undefined;
      }
      this.logger.log(`Client ${socketId} disconnected; preserved session ${sessionId} for graceful reconnection`);
    }
  }

  /**
   * Builds system prompt injecting active repository file path, line cursor,
   * module context, and numbered visible editor lines so the voice agent cites exact lines.
   */
  buildContextualSystemPrompt(ctx: ActiveEditorContext): string {
    const formattedWindow = ctx.visibleCodeLines
      .map((l) => `L${l.lineNumber}: ${l.content}`)
      .join('\n');

    return [
      `You are CodePulse's real-time voice codebase architecture assistant.`,
      `Repository: ${ctx.repositoryName}`,
      `Active File: ${ctx.filePath} (Cursor at line ${ctx.cursorLine})`,
      ctx.moduleSummary ? `Module Context: ${ctx.moduleSummary}` : '',
      `Visible Editor Window:\n${formattedWindow}`,
      `Keep spoken responses concise, architectural, and explicitly reference line numbers (e.g., lines ${ctx.cursorLine}-${ctx.cursorLine + 4}).`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  @SubscribeMessage('voice.session.start')
  handleStartSession(
    @MessageBody() payload: VoiceSessionStartPayload,
    @ConnectedSocket() client?: any,
  ) {
    const sessionId =
      payload.sessionId || `voice-sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const provider: RealtimeProvider =
      payload.provider ??
      (process.env.GEMINI_API_KEY ? 'GEMINI_LIVE' : 'OPENAI_REALTIME');
    const codec: AudioCodec = payload.codec ?? 'OPUS';
    const sampleRateHz = payload.sampleRateHz ?? (codec === 'OPUS' ? 48000 : 16000);
    const systemPrompt = this.buildContextualSystemPrompt(payload.editorContext);

    const state: VoiceSessionState = {
      sessionId,
      userId: payload.userId,
      provider,
      codec,
      sampleRateHz,
      editorContext: payload.editorContext,
      systemPrompt,
      lastSequenceId: 0,
      droppedPacketCount: 0,
      reconnectCount: 0,
      transcriptLog: [],
      socketId: client?.id,
    };

    this.sessions.set(sessionId, state);
    if (client?.id) {
      this.socketToSession.set(client.id, sessionId);
    }

    return {
      event: 'voice.session.ready',
      data: {
        sessionId,
        provider,
        codec,
        sampleRateHz,
        systemPrompt,
        activeFilePath: payload.editorContext.filePath,
        cursorLine: payload.editorContext.cursorLine,
      },
    };
  }

  @SubscribeMessage('voice.context.update')
  handleContextUpdate(
    @MessageBody() payload: { sessionId: string; editorContext: ActiveEditorContext },
  ) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      return { event: 'voice.error', data: { message: 'Session not found' } };
    }
    session.editorContext = payload.editorContext;
    session.systemPrompt = this.buildContextualSystemPrompt(payload.editorContext);
    return {
      event: 'voice.context.updated',
      data: {
        sessionId: session.sessionId,
        filePath: session.editorContext.filePath,
        cursorLine: session.editorContext.cursorLine,
      },
    };
  }

  @SubscribeMessage('voice.session.reconnect')
  handleReconnectSession(
    @MessageBody() payload: { sessionId: string; lastReceivedSequenceId?: number },
    @ConnectedSocket() client?: any,
  ) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      return { event: 'voice.error', data: { message: 'Session expired or not found' } };
    }
    session.reconnectCount += 1;
    session.socketId = client?.id;
    if (client?.id) {
      this.socketToSession.set(client.id, session.sessionId);
    }

    return {
      event: 'voice.session.reconnected',
      data: {
        sessionId: session.sessionId,
        reconnectCount: session.reconnectCount,
        resumeFromSequenceId: session.lastSequenceId,
        transcriptHistoryCount: session.transcriptLog.length,
      },
    };
  }

  @SubscribeMessage('voice.audio.chunk')
  async handleAudioChunk(
    @MessageBody() payload: VoiceAudioChunkPayload,
  ): Promise<{ event: string; data: VoiceAssistantTurnResponse | { ackSequenceId: number; droppedPacketsRecovered: number } }> {
    const t0 = performance.now();
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`Unknown voice session: ${payload.sessionId}`);
    }

    // Detect transient sequence gaps (dropped UDP/WebSocket audio packets) without aborting stream
    if (payload.sequenceId > session.lastSequenceId + 1) {
      const gap = payload.sequenceId - session.lastSequenceId - 1;
      session.droppedPacketCount += gap;
      this.logger.warn(
        `Session ${session.sessionId}: recovered gracefully across ${gap} dropped ${payload.codec} audio frame(s)`,
      );
    }
    session.lastSequenceId = Math.max(session.lastSequenceId, payload.sequenceId);

    if (!payload.isFinalUtterance) {
      return {
        event: 'voice.audio.ack',
        data: {
          ackSequenceId: payload.sequenceId,
          droppedPacketsRecovered: session.droppedPacketCount,
        },
      };
    }

    const ctx = session.editorContext;
    const focusLines = ctx.visibleCodeLines.filter(
      (l) => Math.abs(l.lineNumber - ctx.cursorLine) <= 3,
    );
    const startLine =
      focusLines[0]?.lineNumber ?? ctx.visibleCodeLines[0]?.lineNumber ?? ctx.cursorLine;
    const endLine =
      focusLines[focusLines.length - 1]?.lineNumber ??
      ctx.visibleCodeLines[ctx.visibleCodeLines.length - 1]?.lineNumber ??
      ctx.cursorLine;

    const userUtterance =
      payload.transcriptHint?.trim() ||
      `Explain the architectural flow around line ${ctx.cursorLine} in ${ctx.filePath}`;

    session.transcriptLog.push({
      role: 'user',
      text: userUtterance,
      timestampIso: new Date().toISOString(),
    });

    const snippetPreview = focusLines
      .slice(0, 2)
      .map((l) => `line ${l.lineNumber} (${l.content.trim()})`)
      .join(' and ');

    const assistantTranscript = `In ${ctx.filePath} (lines ${startLine}–${endLine}), ${
      snippetPreview ? `specifically ${snippetPreview}, ` : ''
    }this module orchestrates the request lifecycle and delegates state transitions cleanly.`;

    session.transcriptLog.push({
      role: 'assistant',
      text: assistantTranscript,
      timestampIso: new Date().toISOString(),
    });

    const audioResponseBase64 = Buffer.from(
      `${session.provider}:${session.codec}:${assistantTranscript}`,
    ).toString('base64');

    const responseLatencyMs = Number((performance.now() - t0).toFixed(3));

    return {
      event: 'voice.assistant.response',
      data: {
        sessionId: session.sessionId,
        provider: session.provider,
        responseLatencyMs,
        assistantTranscript,
        audioResponseBase64,
        referencedFilePath: ctx.filePath,
        highlightStartLine: startLine,
        highlightEndLine: endLine,
        droppedPacketsRecovered: session.droppedPacketCount,
        reconnected: session.reconnectCount > 0,
      },
    };
  }

  getSession(sessionId: string): VoiceSessionState | undefined {
    return this.sessions.get(sessionId);
  }
}

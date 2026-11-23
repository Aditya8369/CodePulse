import { VoiceCodeAssistantGateway } from './voice-code-assistant.gateway';

describe('VoiceCodeAssistantGateway (WebSocket Audio Streaming, Context & Reconnection)', () => {
  let gateway: VoiceCodeAssistantGateway;

  beforeEach(() => {
    gateway = new VoiceCodeAssistantGateway();
  });

  it('initiates voice session with active editor context, routes Opus chunks in <500ms, and recovers packet loss', async () => {
    const startRes = gateway.handleStartSession(
      {
        userId: 'sonia-dev',
        provider: 'GEMINI_LIVE',
        codec: 'OPUS',
        editorContext: {
          repositoryName: 'CodePulse',
          filePath: 'backend/src/modules/ai/transpiler.service.ts',
          cursorLine: 42,
          moduleSummary: 'AST transpilation pipeline',
          visibleCodeLines: [
            { lineNumber: 40, content: 'export class TranspilerService {' },
            { lineNumber: 41, content: '  async transpileAst(source: string) {' },
            { lineNumber: 42, content: '    const tokens = this.lexer.tokenize(source);' },
            { lineNumber: 43, content: '    return this.parser.parse(tokens);' },
          ],
        },
      },
      { id: 'sock-1' },
    );

    const sessionId = startRes.data.sessionId;
    expect(startRes.data.systemPrompt).toContain('backend/src/modules/ai/transpiler.service.ts');
    expect(startRes.data.systemPrompt).toContain('L42:     const tokens = this.lexer.tokenize(source);');

    // Sequence 1 -> Sequence 4 simulates 2 dropped transient Opus packets (2, 3)
    const ack = await gateway.handleAudioChunk({
      sessionId,
      sequenceId: 1,
      codec: 'OPUS',
      pcmOrOpusBase64: 'T3B1c0ZyYW1lMQ==',
      isFinalUtterance: false,
    });
    expect(ack.event).toBe('voice.audio.ack');

    // Simulate transient socket disconnect & graceful reconnection
    gateway.handleDisconnect({ id: 'sock-1' });
    const reconn = gateway.handleReconnectSession({ sessionId }, { id: 'sock-2' });
    expect(reconn.event).toBe('voice.session.reconnected');

    const finalTurn = await gateway.handleAudioChunk({
      sessionId,
      sequenceId: 4,
      codec: 'OPUS',
      pcmOrOpusBase64: 'T3B1c0ZyYW1lNA==',
      isFinalUtterance: true,
      transcriptHint: 'How does tokenize feed into parse on line 42?',
    });

    expect(finalTurn.event).toBe('voice.assistant.response');
    const data = finalTurn.data as any;
    expect(data.responseLatencyMs).toBeLessThan(500);
    expect(data.referencedFilePath).toBe('backend/src/modules/ai/transpiler.service.ts');
    expect(data.highlightStartLine).toBe(40);
    expect(data.highlightEndLine).toBe(43);
    expect(data.droppedPacketsRecovered).toBe(2);
    expect(data.reconnected).toBe(true);
  });
});

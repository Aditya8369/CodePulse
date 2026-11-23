import { describe, it, expect } from 'vitest';
import { VoiceCodeAssistantGateway } from './voice-code-assistant.gateway';

describe('VoiceCodeAssistantGateway (Vitest)', () => {
  it('routes PCM16 audio sessions and updates active cursor context dynamically', async () => {
    const gateway = new VoiceCodeAssistantGateway();
    const start = gateway.handleStartSession({
      userId: 'dev-2',
      provider: 'OPENAI_REALTIME',
      codec: 'PCM16',
      editorContext: {
        repositoryName: 'CodePulse',
        filePath: 'src/app/page.tsx',
        cursorLine: 10,
        visibleCodeLines: [{ lineNumber: 10, content: 'export default function Home() {}' }],
      },
    });

    gateway.handleContextUpdate({
      sessionId: start.data.sessionId,
      editorContext: {
        repositoryName: 'CodePulse',
        filePath: 'src/components/voice/voice-assistant-modal.tsx',
        cursorLine: 88,
        visibleCodeLines: [{ lineNumber: 88, content: 'const handleExport = () => {' }],
      },
    });

    const resp = await gateway.handleAudioChunk({
      sessionId: start.data.sessionId,
      sequenceId: 1,
      codec: 'PCM16',
      pcmOrOpusBase64: 'UENNMTY=',
      isFinalUtterance: true,
    });

    const data = resp.data as any;
    expect(data.referencedFilePath).toBe('src/components/voice/voice-assistant-modal.tsx');
    expect(data.highlightStartLine).toBe(88);
    expect(data.responseLatencyMs).toBeLessThan(500);
  });
});

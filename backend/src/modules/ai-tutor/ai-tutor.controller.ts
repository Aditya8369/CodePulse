import { Controller, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { AiTutorService } from './ai-tutor.service';
import type { ExplanationRequest } from './ai-tutor.service';

@Controller('ai-tutor')
export class AiTutorController {
  constructor(private readonly aiTutorService: AiTutorService) {}

  @Post('explain')
  explainQuestion(@Body() body: ExplanationRequest) {
    return {
      success: true,
      cached: false,
      summary: 'Explanation stream ready to connect via SSE.',
    };
  }

  @Sse('stream')
  streamExplanation(): Observable<MessageEvent> {
    return this.aiTutorService
      .streamExplanation({
        question: 'What is the event loop output?',
        codeSnippet: 'console.log(1); Promise.resolve().then(() => console.log(2));',
        chosenOption: '1, 3, 2',
        correctOption: '1, 2, 3',
      })
      .pipe(map(chunk => ({ data: chunk })));
  }
}

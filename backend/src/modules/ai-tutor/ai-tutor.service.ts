import { Injectable, Logger } from '@nestjs/common';
import { Observable, interval, map, take } from 'rxjs';

export interface ExplanationRequest {
  question: string;
  codeSnippet: string;
  chosenOption: string;
  correctOption: string;
}

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger(AiTutorService.name);

  /**
   * Streams step-by-step code execution explanations chunk-by-chunk using simulated token emitter
   */
  streamExplanation(dto: ExplanationRequest): Observable<string> {
    const explanationChunks = [
      `### 🤖 AI Tutor Breakdown\n\n`,
      `**Your selection:** "${dto.chosenOption}" vs **Correct:** "${dto.correctOption}".\n\n`,
      `#### 🔍 Code Analysis:\n`,
      `In the given snippet, variable scope and asynchronous event loop order determine the outcome.\n`,
      `\`\`\`typescript\n${dto.codeSnippet}\n\`\`\`\n\n`,
      `#### 💡 Key Takeaway:\n`,
      `Microtasks (Promises) always drain before macrotasks (setTimeout).\n`,
      `Refactor recommendation: Prefer explicit async/await rather than raw callback chaining.`,
    ];

    return interval(120).pipe(
      take(explanationChunks.length),
      map(index => explanationChunks[index])
    );
  }
}

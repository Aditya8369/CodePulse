import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MentorshipSentimentCalibratorService {
  private readonly logger = new Logger(MentorshipSentimentCalibratorService.name);

  public calibrateFeedback(stars: number, feedbackText: string): { calibratedRating: number; sentimentScore: number } {
    const text = feedbackText.toLowerCase();
    const positiveWords = ['great', 'excellent', 'helpful', 'awesome', 'inspiring', 'clear'];
    const negativeWords = ['terrible', 'unhelpful', 'rude', 'confusing', 'late', 'bad'];

    let pos = 0, neg = 0;
    positiveWords.forEach(w => { if (text.includes(w)) pos++; });
    negativeWords.forEach(w => { if (text.includes(w)) neg++; });

    const sentiment = pos - neg;
    let adjusted = stars;
    if (sentiment > 1 && stars < 5) adjusted = Math.min(5, stars + 0.5);
    else if (sentiment < -1 && stars > 1) adjusted = Math.max(1, stars - 0.5);

    return {
      calibratedRating: adjusted,
      sentimentScore: sentiment
    };
  }
}

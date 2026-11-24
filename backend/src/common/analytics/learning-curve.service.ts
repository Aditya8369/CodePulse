export interface ProgressPoint {
  day: number;
  score: number;
}

export interface LearningCurveProfile {
  studentId: string;
  slope: number;
  asymptoticProficiency: number;
  isAtRisk: boolean;
  halfLifeDays: number;
}

export class LearningCurveService {
  constructor(private readonly riskSlopeThreshold = 0.05) {}

  public fitLearningCurve(studentId: string, history: ProgressPoint[]): LearningCurveProfile {
    if (history.length < 2) {
      return { studentId, slope: 0, asymptoticProficiency: 0, isAtRisk: false, halfLifeDays: 0 };
    }

    // Fit logarithmic model: Score = a + b * ln(day + 1)
    // using linear regression on X = ln(day + 1) and Y = Score
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    const n = history.length;

    for (const pt of history) {
      const x = Math.log(pt.day + 1);
      const y = pt.score;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const a = (sumY - b * sumX) / n;

    // Half life estimation based on slope decay
    const halfLifeDays = b > 0 ? Math.round(Math.log(2) / (b / 100)) : 0;
    const isAtRisk = b < this.riskSlopeThreshold;

    return {
      studentId,
      slope: Math.round(b * 1000) / 1000,
      asymptoticProficiency: Math.round((a + b * Math.log(31)) * 10) / 10,
      isAtRisk,
      halfLifeDays
    };
  }
}

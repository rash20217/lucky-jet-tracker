import type { Round, Stats, Prediction } from './types';

export function generateMultiplier(): number {
  const rand = Math.random();
  if (rand < 0.45) return parseFloat((1 + Math.random() * 0.99).toFixed(2));
  if (rand < 0.72) return parseFloat((2 + Math.random() * 2.99).toFixed(2));
  if (rand < 0.86) return parseFloat((5 + Math.random() * 4.99).toFixed(2));
  if (rand < 0.94) return parseFloat((10 + Math.random() * 19.99).toFixed(2));
  if (rand < 0.98) return parseFloat((30 + Math.random() * 49.99).toFixed(2));
  return parseFloat((80 + Math.random() * 120).toFixed(2));
}

export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

export function getBarColor(multiplier: number): string {
  if (multiplier < 2) return '#e07030';
  if (multiplier < 5) return '#6b7aff';
  if (multiplier < 10) return '#4ade80';
  return '#a855f7';
}

export function computeStats(rounds: Round[]): Stats {
  if (rounds.length === 0) {
    return { average: 0, best: 0, lowest: 0, totalRounds: 0, pct2x: 0, pct5x: 0, pct10x: 0 };
  }
  const mults = rounds.map(r => r.multiplier);
  const average = mults.reduce((a, b) => a + b, 0) / mults.length;
  const best = Math.max(...mults);
  const lowest = Math.min(...mults);
  const totalRounds = rounds.length;
  const pct2x = Math.round((mults.filter(m => m >= 2).length / totalRounds) * 100);
  const pct5x = Math.round((mults.filter(m => m >= 5).length / totalRounds) * 100);
  const pct10x = Math.round((mults.filter(m => m >= 10).length / totalRounds) * 100);
  return { average, best, lowest, totalRounds, pct2x, pct5x, pct10x };
}

export function computePrediction(rounds: Round[]): Prediction {
  const recent = rounds.slice(-10);
  if (recent.length === 0) {
    return { low: 1.5, high: 4, confidence: 55, strategy: 'REBOND', recentAverage: 0 };
  }
  const recentAverage = recent.reduce((a, b) => a + b.multiplier, 0) / recent.length;
  const recentLow = Math.min(...recent.map(r => r.multiplier));
  const recentHigh = Math.max(...recent.map(r => r.multiplier));

  const lowCount = recent.filter(r => r.multiplier < 2).length;
  const strategy = lowCount >= 4 ? 'REBOND' : 'PRUDENCE';

  let predLow: number;
  let predHigh: number;
  let confidence: number;

  if (lowCount >= 5) {
    predLow = 1.5;
    predHigh = Math.min(recentAverage * 1.5, 10);
    confidence = 60 + lowCount * 3;
  } else {
    predLow = Math.max(1.1, recentLow * 0.9);
    predHigh = Math.min(recentHigh * 1.2, recentAverage * 2);
    confidence = 45 + Math.floor(Math.random() * 20);
  }

  return {
    low: parseFloat(predLow.toFixed(1)),
    high: parseFloat(predHigh.toFixed(1)),
    confidence: Math.min(confidence, 89),
    strategy,
    recentAverage: parseFloat(recentAverage.toFixed(2)),
  };
}

export function generateInitialRounds(): Round[] {
  const rounds: Round[] = [];
  const now = new Date();
  for (let i = 30; i >= 1; i--) {
    const t = new Date(now.getTime() - i * 25000);
    rounds.push({
      id: 1077 - i,
      time: formatTime(t),
      multiplier: generateMultiplier(),
      source: 'HISTORIQUE',
    });
  }
  return rounds;
}

export interface Round {
  id: number;
  roundId?: string;
  time: string;
  multiplier: number;
  source: 'LIVE' | 'HISTORIQUE';
  timestamp: number;
}

export interface Stats {
  average: number;
  best: number;
  lowest: number;
  totalRounds: number;
  pct2x: number;
  pct5x: number;
  pct10x: number;
}

export interface Prediction {
  low: number;
  high: number;
  confidence: number;
  strategy: string;
  recentAverage: number;
}

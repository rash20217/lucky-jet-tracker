export type Zone = 'B' | 'M' | 'H' | 'ATTENTE';

export interface EngineRound {
  multi: number;
  time: string;
  hash?: string;
}

interface FeatureScores {
  pattern: Record<Zone, number>;
  volatility: Record<Zone, number>;
  interval: Record<Zone, number>;
  ending: Record<Zone, number>;
}

export interface PredictionResult {
  zone: Zone;
  confidence: number;
  interval: string;
  advice: string;
  weights: Record<string, number>;
  seedJustChanged: boolean;
  accuracy: { global: number; recent: number; total: number };
}

interface PredictionState {
  predictedZone: Zone;
  scores: FeatureScores;
  weightedScores: Record<Zone, number>;
}

export class AutoAdaptiveEngine {
  history: EngineRound[] = [];
  weights: Record<string, number> = { pattern: 0.40, volatility: 0.30, interval: 0.25, ending: 0.05 };
  private lastPredictionState: PredictionState | null = null;
  performance: { total: number; correct: number; history: number[] } = { total: 0, correct: 0, history: [] };
  private learningRate = 0.06;
  seedChangedRecently = false;
  private seedTimer: ReturnType<typeof setTimeout> | null = null;

  addRound(round: EngineRound): void {
    this.history.push(round);
    if (this.history.length > 300) this.history.shift();

    if (this.lastPredictionState) {
      this._learnFromError(round.multi);
      this.lastPredictionState = null;
    }

    this._checkConceptDrift();
    if (this.performance.history.length > 50) this.performance.history.shift();
  }

  predict(): PredictionResult {
    const recent = this.performance.history.slice(-20);
    const recentAcc = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0.5;
    const globalAcc = this.performance.total > 0 ? this.performance.correct / this.performance.total : 0;

    if (this.history.length < 5) {
      return {
        zone: 'ATTENTE',
        confidence: 0,
        advice: 'En attente de données...',
        interval: '-- x - -- x',
        weights: { ...this.weights },
        seedJustChanged: this.seedChangedRecently,
        accuracy: { global: Math.round(globalAcc * 100), recent: Math.round(recentAcc * 100), total: this.history.length },
      };
    }

    const scores = this._calculateFeatureScores();
    const weighted: Record<string, number> = { B: 0, M: 0, H: 0 };
    for (const [sensor, weight] of Object.entries(this.weights)) {
      weighted.B += (scores[sensor as keyof FeatureScores].B ?? 0) * weight;
      weighted.M += (scores[sensor as keyof FeatureScores].M ?? 0) * weight;
      weighted.H += (scores[sensor as keyof FeatureScores].H ?? 0) * weight;
    }

    let maxZone: Zone = 'B';
    let maxScore = weighted.B;
    if (weighted.M > maxScore) { maxScore = weighted.M; maxZone = 'M'; }
    if (weighted.H > maxScore) { maxScore = weighted.H; maxZone = 'H'; }

    let confidence = Math.round(Math.min(maxScore * 100, 85) * (0.5 + recentAcc * 0.5));
    confidence = Math.min(confidence, 82);

    this.lastPredictionState = {
      predictedZone: maxZone,
      scores,
      weightedScores: { B: weighted.B, M: weighted.M, H: weighted.H, ATTENTE: 0 },
    };

    const intervalMap: Record<Zone, string> = {
      B: '1.00x — 1.50x',
      M: '1.50x — 3.00x',
      H: '3.00x — 10.00x+',
      ATTENTE: '-- x - -- x',
    };

    let advice = '⚪ Prudence, confiance modérée.';
    if (maxZone === 'H' && confidence > 65 && recentAcc > 0.6) advice = '🟢 SIGNAL FORT — Visez un cash-out vers 3.0x – 5.0x';
    else if (maxZone === 'H' && confidence > 50) advice = '🟡 Signal modéré HAUT. Misez léger.';
    else if (maxZone === 'M' && confidence > 60) advice = '🟡 Zone MOYENNE. Cash-out rapide vers 2.0x.';
    else if (maxZone === 'B' && confidence > 60) advice = '🔴 Zone BASSE — Évitez ou cash-out immédiat.';

    return {
      zone: maxZone,
      confidence,
      interval: intervalMap[maxZone],
      advice,
      weights: { ...this.weights },
      seedJustChanged: this.seedChangedRecently,
      accuracy: { global: Math.round(globalAcc * 100), recent: Math.round(recentAcc * 100), total: this.history.length },
    };
  }

  private _learnFromError(actualMultiplier: number): void {
    const actualZone = this._getZone(actualMultiplier);
    const predicted = this.lastPredictionState!;
    const wasCorrect = predicted.predictedZone === actualZone;

    this.performance.total++;
    if (wasCorrect) this.performance.correct++;
    this.performance.history.push(wasCorrect ? 1 : 0);

    const reward = wasCorrect ? 1 : -1;
    for (const [sensorName, weight] of Object.entries(this.weights)) {
      const s = predicted.scores[sensorName as keyof FeatureScores];
      const scoreForActual = s[actualZone] ?? 0;
      const totalScore = (s.B ?? 0) + (s.M ?? 0) + (s.H ?? 0);
      const normalizedScore = totalScore > 0 ? scoreForActual / totalScore : 0.33;
      const adjustment = (normalizedScore - 0.33) * reward * this.learningRate;
      let newWeight = weight + adjustment;
      newWeight = Math.max(0.05, Math.min(0.85, newWeight));
      this.weights[sensorName] = newWeight;
    }
    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(this.weights)) {
      this.weights[key] = this.weights[key] / totalWeight;
    }
  }

  private _checkConceptDrift(): void {
    const totalHistory = this.performance.history.length;
    if (totalHistory < 40) return;
    const recent = this.performance.history.slice(-20);
    const recentAcc = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = this.performance.history.slice(-40, -20);
    const olderAcc = older.reduce((a, b) => a + b, 0) / older.length;
    if (olderAcc - recentAcc > 0.25) {
      console.warn(`[ADAPTIVE] Drift détecté: ${Math.round(olderAcc * 100)}% → ${Math.round(recentAcc * 100)}%. Reset.`);
      this._resetWeights();
    }
  }

  private _resetWeights(): void {
    this.weights = { pattern: 0.40, volatility: 0.30, interval: 0.25, ending: 0.05 };
    this.performance.history = [];
    this.performance.total = 0;
    this.performance.correct = 0;
    this.seedChangedRecently = true;
    if (this.seedTimer) clearTimeout(this.seedTimer);
    this.seedTimer = setTimeout(() => { this.seedChangedRecently = false; }, 30000);
  }

  private _calculateFeatureScores(): FeatureScores {
    const scores: FeatureScores = {
      pattern: { B: 0, M: 0, H: 0, ATTENTE: 0 },
      volatility: { B: 0, M: 0, H: 0, ATTENTE: 0 },
      interval: { B: 0, M: 0, H: 0, ATTENTE: 0 },
      ending: { B: 0, M: 0, H: 0, ATTENTE: 0 },
    };

    const pat = this._getPatternPrediction();
    if (pat) scores.pattern[pat.zone] = pat.confidence / 100;

    const vol = this._getVolatilityScore();
    if (vol === 'Faible') scores.volatility.B = 0.7;
    else if (vol === 'Modérée') scores.volatility.M = 0.7;
    else if (vol === 'Élevée') { scores.volatility.B = 0.4; scores.volatility.H = 0.4; }
    else { scores.volatility.B = 0.5; scores.volatility.H = 0.5; }

    const itvl = this._getIntervalPrediction();
    if (itvl) scores.interval[itvl.zone] = itvl.confidence / 100;

    const end = this._getEndingPrediction();
    if (end) scores.ending[end.zone] = end.confidence / 100;

    for (const sensor of Object.values(scores)) {
      if (!sensor.B && !sensor.M && !sensor.H) {
        sensor.B = 0.33; sensor.M = 0.33; sensor.H = 0.33;
      }
    }
    return scores;
  }

  _getZone(m: number): Zone {
    return m < 1.5 ? 'B' : m < 3.0 ? 'M' : 'H';
  }

  private _getPatternPrediction(): { zone: Zone; confidence: number } | null {
    if (this.history.length < 5) return null;
    const zones = this.history.map(r => this._getZone(r.multi));
    const last4 = zones.slice(-4).join('');
    let occ = 0;
    const nextCounts: Record<Zone, number> = { B: 0, M: 0, H: 0, ATTENTE: 0 };
    for (let i = 0; i < zones.length - 5; i++) {
      if (zones.slice(i, i + 4).join('') === last4) {
        occ++;
        nextCounts[zones[i + 4]]++;
      }
    }
    if (occ < 2) return null;
    const sorted = (Object.entries(nextCounts) as [Zone, number][]).sort((a, b) => b[1] - a[1]);
    return { zone: sorted[0][0], confidence: (sorted[0][1] / occ) * 100 };
  }

  private _getVolatilityScore(): string {
    if (this.history.length < 5) return 'Faible';
    const slice = this.history.slice(-10);
    const mean = slice.reduce((a, b) => a + b.multi, 0) / slice.length;
    const variance = slice.map(r => Math.pow(r.multi - mean, 2)).reduce((a, b) => a + b, 0) / slice.length;
    const vol = Math.sqrt(variance);
    if (vol < 0.5) return 'Faible';
    if (vol < 1.0) return 'Modérée';
    if (vol < 1.8) return 'Élevée';
    return 'Très élevée';
  }

  private _getIntervalPrediction(): { zone: Zone; confidence: number } | null {
    if (this.history.length < 3) return null;
    const gaps: number[] = [];
    for (let i = 1; i < this.history.length; i++) gaps.push(this.history[i].multi - this.history[i - 1].multi);
    const lastGap = gaps[gaps.length - 1];
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (lastGap > avg * 1.5) return { zone: 'H', confidence: 60 };
    if (lastGap < avg * 0.5) return { zone: 'B', confidence: 55 };
    return { zone: 'M', confidence: 50 };
  }

  private _getEndingPrediction(): { zone: Zone; confidence: number } | null {
    if (this.history.length < 5) return null;
    const endings = this.history.map(r => r.multi.toFixed(2).split('.')[1]);
    const freq: Record<string, number> = {};
    endings.forEach(e => { freq[e] = (freq[e] || 0) + 1; });
    const lastEnding = endings[endings.length - 1];
    if (freq[lastEnding] > 2) {
      const lastZone = this._getZone(this.history[this.history.length - 1].multi);
      return { zone: lastZone, confidence: 45 };
    }
    return null;
  }
}

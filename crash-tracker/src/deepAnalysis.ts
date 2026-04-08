import type { Round } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 3_600_000;

function minsAgo(ts: number) { return (Date.now() - ts) / MIN; }
function secsAgo(ts: number) { return (Date.now() - ts) / 1000; }

function fmtTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}
function fmtTimeFuture(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}

function pct(n: number, d: number): number {
  if (d === 0) return 0;
  return Math.round((n / d) * 100);
}

function termination(m: number): string {
  const dec = Math.round((m % 1) * 100);
  return `.${String(dec).padStart(2, '0')}`;
}

const CLEAN_TERMS = [0, 20, 35, 50, 65, 80];
const BAD_TERMS   = [49, 51, 73, 88];

function isClean(m: number): boolean {
  const dec = Math.round((m % 1) * 100);
  return CLEAN_TERMS.includes(dec);
}
function isBad(m: number): boolean {
  const dec = Math.round((m % 1) * 100);
  return BAD_TERMS.includes(dec);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CycleState = 'tres_chaud' | 'chaud' | 'stable' | 'froid' | 'froid_extreme';

export interface SignalInfo {
  label: string;
  color: string;
  count: number;
}

export interface ProbWindow {
  label: string;
  minutes: number;
  pctAbove50x: number;
  pctAbove100x: number;
  nextExpectedAt: string;
}

export interface EntryWindow {
  from: string;
  to: string;
  reason: string;
  frequency: string;
}

export interface TrapWarning {
  type: string;
  detected: boolean;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

export interface DeepAnalysisResult {
  // Section 1 – Cycle & signals
  cycle: CycleState;
  cycleLabel: string;
  cycleColor: string;
  recentLow2x: number;
  recentLow5x: number;
  recentHigh10x: number;
  recentHigh50x: number;
  sinceLastBig10x: string;
  sinceLastBig50x: string;
  accumulationMin: number;
  onesInAcc: number;
  signals: SignalInfo[];

  // Section 2 – Probability
  windows: ProbWindow[];
  avgInterval10x: number;
  avgInterval50x: number;
  nextCriticalWindow: string;

  // Section 3 – Action plan
  strategyMode: 'agressif' | 'prudent' | 'rebond' | 'attente';
  strategyLabel: string;
  entryWindows: EntryWindow[];
  recommendedTimer: string;
  recommendedTarget: string;
  splitPlan: Array<{ pct: string; timer: string; target: string }>;
  progression: string;

  // Section 4 – Anti-trap & practical tips
  traps: TrapWarning[];
  tips: string[];

  // Meta
  basedOnRounds: number;
  generatedAt: string;
}

// ── Main analysis ─────────────────────────────────────────────────────────────

export function runDeepAnalysis(rounds: Round[]): DeepAnalysisResult {
  const now = Date.now();
  const sorted = [...rounds]
    .filter(r => r.timestamp != null)
    .sort((a, b) => b.timestamp - a.timestamp);

  // ── 0. Last N minutes windows ─────────────────────────────────────────────
  const last10min  = sorted.filter(r => minsAgo(r.timestamp) < 10);
  const last30min  = sorted.filter(r => minsAgo(r.timestamp) < 30);
  const last60min  = sorted.filter(r => minsAgo(r.timestamp) < 60);
  const last2h     = sorted.filter(r => minsAgo(r.timestamp) < 120);

  // ── 1. Signal counts ──────────────────────────────────────────────────────
  const recentLow2x  = last10min.filter(r => r.multiplier < 2).length;
  const recentLow5x  = last10min.filter(r => r.multiplier < 5).length;
  const recentHigh10x = last30min.filter(r => r.multiplier >= 10).length;
  const recentHigh50x = last60min.filter(r => r.multiplier >= 50).length;

  const lastBig10  = sorted.find(r => r.multiplier >= 10);
  const lastBig50  = sorted.find(r => r.multiplier >= 50);
  const lastBig100 = sorted.find(r => r.multiplier >= 100);
  const lastBig5   = sorted.find(r => r.multiplier >= 5);
  const lastOne    = sorted.find(r => r.multiplier <= 1.01);

  const sinceLastBig10x = lastBig10
    ? `${minsAgo(lastBig10.timestamp).toFixed(1)} min (${lastBig10.multiplier}x)`
    : 'Aucun dans l\'historique';
  const sinceLastBig50x = lastBig50
    ? `${minsAgo(lastBig50.timestamp).toFixed(1)} min (${lastBig50.multiplier}x)`
    : 'Aucun dans l\'historique';

  // Accumulation = depuis dernier > 5x
  const accStartTs   = lastBig5 ? lastBig5.timestamp : (sorted[sorted.length - 1]?.timestamp ?? now);
  const accDurMin    = minsAgo(accStartTs);
  const accRounds    = sorted.filter(r => r.timestamp > accStartTs);
  const onesInAcc    = accRounds.filter(r => r.multiplier <= 1.01).length;

  // ── 2. Cycle state ────────────────────────────────────────────────────────
  const peaks100_2h  = last2h.filter(r => r.multiplier >= 100).length;
  const peaks10_10m  = last10min.filter(r => r.multiplier >= 10).length;
  const allLow25     = sorted.slice(0, 25).every(r => r.multiplier < 2);
  const no20xIn45min = !last60min.find(r => r.multiplier >= 20 && minsAgo(r.timestamp) < 45);

  let cycle: CycleState;
  if (peaks100_2h >= 3 || sorted.slice(0, 1).some(r => r.multiplier >= 500)) {
    cycle = 'tres_chaud';
  } else if (peaks10_10m >= 3 || (lastBig100 && minsAgo(lastBig100.timestamp) < 10)) {
    cycle = 'chaud';
  } else if (allLow25 && no20xIn45min) {
    cycle = 'froid_extreme';
  } else if (!lastBig5 || minsAgo(lastBig5.timestamp) > 5) {
    cycle = 'froid';
  } else {
    cycle = 'stable';
  }

  const cycleMap: Record<CycleState, { label: string; color: string }> = {
    tres_chaud:   { label: '🔥 Très Chaud',   color: '#ff2d55' },
    chaud:        { label: '🟠 Chaud',         color: '#ff8c00' },
    stable:       { label: '🟡 Stable',        color: '#ffd700' },
    froid:        { label: '❄️ Froid',          color: '#60a5fa' },
    froid_extreme:{ label: '🧊 Froid Extrême', color: '#93c5fd' },
  };

  // ── 3. Signals list ───────────────────────────────────────────────────────
  const signals: SignalInfo[] = [];

  if (accDurMin < 2 && onesInAcc >= 1) {
    signals.push({ label: '🔴 Accumulation courte + 1.00x → Hit imminent', color: '#ff2d55', count: onesInAcc });
  } else if (accDurMin < 2) {
    signals.push({ label: '🔴 Accumulation < 2 min → Signal très fort', color: '#ff4500', count: 0 });
  }
  if (accDurMin >= 2 && accDurMin < 3 && onesInAcc >= 1) {
    signals.push({ label: '🟠 Accumulation 2–3 min + 1.00x → Signal fort', color: '#ff8c00', count: onesInAcc });
  }
  if (recentHigh10x >= 2) {
    signals.push({ label: `🔥 ${recentHigh10x}× hits > 10x en < 30 min → Cycle chaud`, color: '#ff2d55', count: recentHigh10x });
  }
  if (lastOne && secsAgo(lastOne.timestamp) < 90) {
    signals.push({ label: `⚡ 1.00x il y a ${secsAgo(lastOne.timestamp).toFixed(0)}s → Rebond possible`, color: '#a78bfa', count: 1 });
  }
  if (accDurMin > 4 && onesInAcc >= 2) {
    signals.push({ label: `🔴 Acc. > 4 min + ${onesInAcc}× 1.00x → Hit fort attendu`, color: '#ff4500', count: onesInAcc });
  }
  if (lastBig50 && minsAgo(lastBig50.timestamp) < 5) {
    signals.push({ label: `⚠️ Latence post-${lastBig50.multiplier}x : attendre 32–38 min`, color: '#ffd700', count: 0 });
  }
  if (signals.length === 0) {
    signals.push({ label: '⚪ Aucun signal fort détecté — rester en observation', color: '#888', count: 0 });
  }

  // ── 4. Average intervals between big hits ─────────────────────────────────
  function avgInterval(threshold: number, window: Round[]): number {
    const hits = [...window].filter(r => r.multiplier >= threshold)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (hits.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < hits.length; i++) {
      sum += (hits[i].timestamp - hits[i - 1].timestamp) / MIN;
    }
    return Math.round(sum / (hits.length - 1));
  }

  const avgInterval10x = avgInterval(10, last60min) || avgInterval(10, sorted.slice(0, 50)) || 8;
  const avgInterval50x = avgInterval(50, last2h)    || avgInterval(50, sorted.slice(0, 50)) || 35;

  // ── 5. Probability windows ────────────────────────────────────────────────
  const total60 = last60min.length || 1;
  const hits50in60  = last60min.filter(r => r.multiplier >= 50).length;
  const hits100in60 = last60min.filter(r => r.multiplier >= 100).length;

  function probInWindow(minutes: number): { p50: number; p100: number } {
    const ratio = minutes / 60;
    const rounds_in_window = Math.round(total60 * ratio);
    if (rounds_in_window < 1) return { p50: 0, p100: 0 };
    const rate50  = hits50in60  / total60;
    const rate100 = hits100in60 / total60;
    const p50  = Math.round((1 - Math.pow(1 - rate50,  rounds_in_window)) * 100);
    const p100 = Math.round((1 - Math.pow(1 - rate100, rounds_in_window)) * 100);
    return { p50: Math.min(p50, 99), p100: Math.min(p100, 99) };
  }

  const timeSinceLast50 = lastBig50 ? minsAgo(lastBig50.timestamp) : Infinity;
  const nextExp50min = avgInterval50x > 0
    ? Math.max(0, avgInterval50x - timeSinceLast50)
    : 20;

  const nextCriticalTs = now + nextExp50min * MIN;
  const nextCriticalWindow = fmtTimeFuture(nextCriticalTs);

  const windows: ProbWindow[] = [15, 30, 60].map(m => {
    const { p50, p100 } = probInWindow(m);
    return {
      label: `${m} min`,
      minutes: m,
      pctAbove50x: p50,
      pctAbove100x: p100,
      nextExpectedAt: fmtTimeFuture(now + m * MIN),
    };
  });

  // ── 6. Entry windows (based on recurring patterns) ────────────────────────
  const entryWindows: EntryWindow[] = [];

  // After a 1.00x within last 90s
  if (lastOne && secsAgo(lastOne.timestamp) < 90) {
    const rebondTs = lastOne.timestamp + 5200;
    entryWindows.push({
      from: fmtTimeFuture(rebondTs),
      to:   fmtTimeFuture(rebondTs + 3000),
      reason: `Stratégie rebond après 1.00x (il y a ${secsAgo(lastOne.timestamp).toFixed(0)}s)`,
      frequency: 'Timer 5,2s → sortie à 1.80x minimum',
    });
  }

  // If accumulation < 3 min → 10x window soon
  if (accDurMin < 3 && accDurMin > 0.5) {
    const eta10 = (avgInterval10x - accDurMin) * MIN;
    if (eta10 > 0) {
      entryWindows.push({
        from: fmtTimeFuture(now + Math.max(0, eta10 - 30000)),
        to:   fmtTimeFuture(now + eta10 + 30000),
        reason: `Accumulation ${accDurMin.toFixed(1)} min → 10x attendu dans ~${Math.max(0, avgInterval10x - accDurMin).toFixed(1)} min`,
        frequency: `Intervalle moyen 10x : ${avgInterval10x} min`,
      });
    }
  }

  // General next >50x window
  if (nextExp50min > 0) {
    entryWindows.push({
      from: fmtTimeFuture(now + nextExp50min * MIN - 2 * MIN),
      to:   fmtTimeFuture(now + nextExp50min * MIN + 3 * MIN),
      reason: `Fenêtre critique prochaine >50x`,
      frequency: `Intervalle moyen 50x : ${avgInterval50x} min`,
    });
  }

  // ── 7. Strategy mode ──────────────────────────────────────────────────────
  let strategyMode: DeepAnalysisResult['strategyMode'];
  let strategyLabel: string;
  let recommendedTimer: string;
  let recommendedTarget: string;
  let splitPlan: Array<{ pct: string; timer: string; target: string }>;
  let progression: string;

  const recentOne90s = lastOne && secsAgo(lastOne.timestamp) < 90;
  const hotSignal = cycle === 'tres_chaud' || cycle === 'chaud';
  const accShort = accDurMin < 3;

  if (recentOne90s) {
    strategyMode = 'rebond';
    strategyLabel = '🪂 Stratégie Rebond (1.00x récent)';
    recommendedTimer = '5,2s';
    recommendedTarget = '1.80x minimum';
    splitPlan = [{ pct: '100%', timer: '5,2s', target: '1.80x' }];
    progression = 'Rebond direct après 1.00x — mise normale';
  } else if (hotSignal && accShort) {
    strategyMode = 'agressif';
    strategyLabel = '🚀 Mode Agressif (cycle chaud + accumulation courte)';
    recommendedTimer = '1m03s';
    recommendedTarget = '10x+';
    splitPlan = [
      { pct: '50%', timer: '11,45s', target: '2x (sécurisé)' },
      { pct: '50%', timer: '1m03s',  target: '10x+ (offensif)' },
    ];
    progression = 'Si 3 échecs à 2x → mise ×1.5';
  } else if (cycle === 'froid' || cycle === 'froid_extreme') {
    strategyMode = 'attente';
    strategyLabel = '❄️ Mode Attente (cycle froid)';
    recommendedTimer = '11,45s';
    recommendedTarget = '2x';
    splitPlan = [{ pct: '100%', timer: '11,45s', target: '2x (sécurisé)' }];
    progression = 'Rester sur 2x jusqu\'au signal de réveil';
  } else {
    strategyMode = 'prudent';
    strategyLabel = '🛡️ Mode Prudent (split dynamique)';
    recommendedTimer = '1m03s';
    recommendedTarget = '10x';
    splitPlan = [
      { pct: '50%', timer: '11,45s', target: '2x (sécurisé)' },
      { pct: '50%', timer: '1m03s',  target: '10x (offensif)' },
    ];
    progression = 'Après 3 échecs à 2x → palier ×1.5 / Après 2 échecs à 10x → retour 2x pendant 10 min';
  }

  // ── 8. Anti-trap detections ───────────────────────────────────────────────
  const traps: TrapWarning[] = [];

  // Piège 1 : Liquidité fantôme (> 5 oscillations > 100% en 10 tours)
  const last10 = sorted.slice(0, 10);
  let bigSwings = 0;
  for (let i = 1; i < last10.length; i++) {
    const ratio = last10[i - 1].multiplier / last10[i].multiplier;
    if (ratio > 2 || ratio < 0.5) bigSwings++;
  }
  const fantomeLiquidite = bigSwings > 5;
  traps.push({
    type: '💧 Liquidité Fantôme',
    detected: fantomeLiquidite,
    severity: 'high',
    detail: fantomeLiquidite
      ? `${bigSwings} oscillations >100% sur 10 tours — IGNORER les signaux`
      : `Oscillations normales (${bigSwings}/10)`,
  });

  // Piège 2 : Rebond trompeur (vérifier 3 closes consécutifs)
  const last3 = last10.slice(0, 3).map(r => r.multiplier);
  const rebondTrompeur = last3.length >= 3 &&
    last3[2] > last3[1] && last3[1] < last3[0] && last3[0] < 3;
  traps.push({
    type: '📈 Rebond Trompeur',
    detected: rebondTrompeur,
    severity: 'medium',
    detail: rebondTrompeur
      ? `Séquence: ${last3.reverse().map(x => x.toFixed(2)).join(' → ')} — exiger 3 closes consécutifs`
      : 'Aucun rebond trompeur détecté',
  });

  // Piège 3 : Terminaisons aléatoires sur les 3 derniers > 50x
  const last3big50 = sorted.filter(r => r.multiplier >= 50).slice(0, 3);
  const badTerminations = last3big50.filter(r => isBad(r.multiplier));
  const terminaisonAlea = badTerminations.length >= 2;
  traps.push({
    type: '🎯 Terminaison Aléatoire',
    detected: terminaisonAlea,
    severity: 'high',
    detail: terminaisonAlea
      ? `${badTerminations.length} terminaisons bloquantes sur derniers >50x : ${badTerminations.map(r => r.multiplier + termination(r.multiplier)).join(', ')}`
      : last3big50.length > 0
        ? `Terminaisons OK : ${last3big50.map(r => r.multiplier.toFixed(2)).join(', ')}`
        : 'Pas assez de >50x pour analyser',
  });

  // Piège 4 : Signal isolé (1 seul big hit sans confirmation)
  const signalIsole = recentHigh10x === 1 && last10min.filter(r => r.multiplier >= 5).length < 2;
  traps.push({
    type: '📡 Signal Isolé',
    detected: signalIsole,
    severity: 'medium',
    detail: signalIsole
      ? `Un seul hit > 10x sans confirmation. Attendre 3 closes > 50% du pic`
      : 'Signal confirmé par plusieurs hits',
  });

  // Piège 5 : Double pic < 15 min
  const recent300x = sorted.filter(r => r.multiplier >= 300 && minsAgo(r.timestamp) < 15);
  const doublePic = recent300x.length >= 1;
  traps.push({
    type: '⚡ Double Pic Immédiat',
    detected: doublePic,
    severity: 'high',
    detail: doublePic
      ? `Pic > 300x il y a ${minsAgo(recent300x[0].timestamp).toFixed(1)} min — NE PAS rejouer`
      : 'Aucun pic > 300x récent',
  });

  // ── 9. Practical tips ────────────────────────────────────────────────────
  const tips: string[] = [];

  // Accumulation signal
  if (recentLow2x >= 5) {
    tips.push(`📊 ${recentLow2x} cotes < 2x en 10 min — accumulation critique → hit ≥ 10x attendu dans 5 à 9 min`);
  }

  // Post-50x latency
  if (lastBig50) {
    const lagMin = minsAgo(lastBig50.timestamp);
    if (lagMin < 38) {
      const rem = Math.max(0, 32 - lagMin);
      tips.push(`⏳ Après ${lastBig50.multiplier}x : latence ${lagMin.toFixed(1)} min / ${rem.toFixed(1)} min restantes avant prochain gros hit`);
    }
  }

  // 1.00x series
  const recent1x = sorted.slice(0, 20).filter(r => r.multiplier <= 1.01).length;
  if (recent1x >= 2) {
    tips.push(`🔴 ${recent1x}× 1.00x dans les 20 derniers tours — précurseur fort de hit ≥ 10x`);
  }

  // Timer calibration reminder
  tips.push('⏱️ Calibrage timers : 2x = 11,45s | 5x = ~27s | 10x = 1m03s | 50x = 2m20s | 100x = 4m45s');

  // Consecutive low sequence
  const consecLow = (() => {
    let count = 0;
    for (const r of sorted) {
      if (r.multiplier < 1.4) count++; else break;
    }
    return count;
  })();
  if (consecLow >= 3) {
    tips.push(`📉 ${consecLow} cotes consécutives 1.00–1.40x → précède souvent un 10x+ dans 5–9 min`);
  }

  // Volume filter tip
  tips.push(`🔎 Plages optimales : 01h–03h (moins de pièges) | Exiger terminaison .00/.20/.35/.50/.65/.80`);

  const generatedAt = fmtTime(now);

  return {
    cycle,
    cycleLabel: cycleMap[cycle].label,
    cycleColor: cycleMap[cycle].color,
    recentLow2x,
    recentLow5x,
    recentHigh10x,
    recentHigh50x,
    sinceLastBig10x,
    sinceLastBig50x,
    accumulationMin: Math.round(accDurMin * 10) / 10,
    onesInAcc,
    signals,
    windows,
    avgInterval10x,
    avgInterval50x,
    nextCriticalWindow,
    strategyMode,
    strategyLabel,
    entryWindows,
    recommendedTimer,
    recommendedTarget,
    splitPlan,
    progression,
    traps,
    tips,
    basedOnRounds: sorted.length,
    generatedAt,
  };
}

import type { Round } from './types';

export type SignalLevel =
  | 'maximum'
  | 'tres_fort'
  | 'fort'
  | 'modere'
  | 'faible'
  | 'tres_faible'
  | 'blocage'
  | 'attente';

export type Phase =
  | 'tres_chaud'
  | 'chaud'
  | 'transition'
  | 'froid'
  | 'froid_extreme';

export interface SplitPart {
  pct: string;
  timer: string;
  cible: string;
}

export interface AnalysisResult {
  heureEntree: string;
  timer: string;
  cible: string;
  niveauLabel: string;
  niveauCode: SignalLevel;
  phase: Phase;
  phaseLabel: string;
  details: string[];
  split: SplitPart[];
  blocage: boolean;
  blocageRaison?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 3_600_000;

function isOne(r: Round) { return r.multiplier <= 1.01; }
function isBig(r: Round, threshold: number) { return r.multiplier >= threshold; }

function formatTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 8);
}

function minsAgo(ts: number): number {
  return (Date.now() - ts) / MIN;
}

function termination(m: number): string {
  const decimals = Math.round((m % 1) * 100);
  return String(decimals).padStart(2, '0');
}

const BAD_TERMS = [49, 51, 73, 88];
function hasBadTermination(m: number): boolean {
  const dec = Math.round((m % 1) * 100);
  return BAD_TERMS.includes(dec);
}

function hasCleanTermination(m: number): boolean {
  const dec = Math.round((m % 1) * 100);
  return [0, 20, 35, 50, 65, 80].includes(dec);
}

// ── Core analysis ─────────────────────────────────────────────────────────────

export function analyzeHistory(rounds: Round[]): AnalysisResult {
  const now = Date.now();
  const sorted = [...rounds]
    .filter(r => r.timestamp != null)
    .sort((a, b) => b.timestamp - a.timestamp);

  const details: string[] = [];

  // ── 0. Insufficient data ──────────────────────────────────────────────────
  if (sorted.length < 3) {
    return {
      heureEntree: formatTime(now),
      timer: '—',
      cible: '—',
      niveauLabel: '⚪ Données insuffisantes',
      niveauCode: 'attente',
      phase: 'froid',
      phaseLabel: 'Inconnu',
      details: ['Pas assez de données (< 3 tours). Attendez quelques rounds.'],
      split: [],
      blocage: true,
      blocageRaison: 'Données insuffisantes',
    };
  }

  // ── 1. Classify phase ─────────────────────────────────────────────────────
  const last2h = sorted.filter(r => (now - r.timestamp) < 2 * HOUR);
  const peaks100_2h = last2h.filter(r => isBig(r, 100));
  const lastBig500 = sorted.find(r => isBig(r, 500));
  const lastBig300 = sorted.find(r => isBig(r, 300));
  const lastBig100 = sorted.find(r => isBig(r, 100));
  const lastBig50  = sorted.find(r => isBig(r, 50));
  const lastBig10  = sorted.find(r => isBig(r, 10));
  const lastBig5   = sorted.find(r => isBig(r, 5));

  let phase: Phase;

  const trèsChaud =
    peaks100_2h.length >= 3 ||
    (lastBig500 && minsAgo(lastBig500.timestamp) < 120);

  const chaud =
    (() => {
      const last3min = sorted.filter(r => minsAgo(r.timestamp) < 3);
      const big5in3min = last3min.filter(r => isBig(r, 5)).length >= 2;
      const lastBig5ago = lastBig5 ? minsAgo(lastBig5.timestamp) : Infinity;
      const recentOne = sorted.slice(0, 10).some(isOne);
      return big5in3min || (lastBig5ago < 2 && recentOne);
    })();

  const timeSince5x = lastBig5 ? minsAgo(lastBig5.timestamp) : Infinity;
  const timeSince10x = lastBig10 ? minsAgo(lastBig10.timestamp) : Infinity;

  if (trèsChaud) {
    phase = 'tres_chaud';
  } else if (chaud) {
    phase = 'chaud';
  } else if (timeSince10x >= 3 && timeSince10x <= 5) {
    phase = 'transition';
  } else if (timeSince5x > 5) {
    const last15 = sorted.slice(0, 15);
    const allCold = last15.every(r => r.multiplier < 3);
    const noOnes = last15.every(r => !isOne(r));
    phase = (allCold && noOnes && last15.length >= 15) ? 'froid_extreme' : 'froid';
  } else {
    phase = 'froid';
  }

  const phaseLabels: Record<Phase, string> = {
    tres_chaud: '🔥 Très Chaud',
    chaud: '🟠 Chaud',
    transition: '🟡 Transition',
    froid: '❄️ Froid',
    froid_extreme: '🧊 Froid Extrême',
  };

  details.push(`Phase : ${phaseLabels[phase]}`);

  // ── 2. Blocage checks ──────────────────────────────────────────────────────

  // Blocage: dernier pic >300x depuis < 15 min
  if (lastBig300 && minsAgo(lastBig300.timestamp) < 15) {
    details.push(`❌ Dernier pic > 300x il y a ${minsAgo(lastBig300.timestamp).toFixed(1)} min (latence 15 min minimum)`);
    return makeBlocage(now, phase, phaseLabels[phase], details,
      `Dernier pic > 300x trop récent (${minsAgo(lastBig300.timestamp).toFixed(1)} min). Attendre 15 min.`);
  }

  // Blocage: terminaisons mauvaises sur les 3 derniers > 50x
  const last3big50 = sorted.filter(r => isBig(r, 50)).slice(0, 3);
  if (last3big50.length >= 3 && last3big50.every(r => hasBadTermination(r.multiplier))) {
    const terms = last3big50.map(r => termination(r.multiplier) + '%').join(', ');
    details.push(`❌ Terminaisons défavorables sur 3 derniers > 50x : ${terms}`);
    return makeBlocage(now, phase, phaseLabels[phase], details,
      `Terminaisons bloquantes (.49/.51/.73/.88) : ${terms}`);
  }

  // Blocage: aucun pic > 100x depuis > 2h (pour stratégie >500x uniquement — on note)
  const no100xIn2h = peaks100_2h.length === 0;

  // ── 3. Accumulation ────────────────────────────────────────────────────────

  // Accumulation = temps écoulé depuis le dernier hit > 5x
  const accStartTs = lastBig5 ? lastBig5.timestamp : (sorted[sorted.length - 1]?.timestamp ?? now);
  const accDurMin = minsAgo(accStartTs);
  const accRounds = sorted.filter(r => r.timestamp > accStartTs);
  const onesInAcc = accRounds.filter(isOne).length;

  details.push(`Accumulation : ${accDurMin.toFixed(1)} min, ${onesInAcc} × 1.00x`);

  // ── 4. Signal from accumulation table ─────────────────────────────────────
  let niveauCode: SignalLevel;
  let timer: string;
  let cible: string;
  let split: SplitPart[];

  // Réveil simple : 1 cote > 5x présente et < 60s (section B)
  const reveilSimple = lastBig5 && minsAgo(lastBig5.timestamp) < 1;
  const reveilDouble = (() => {
    const last3min = sorted.filter(r => minsAgo(r.timestamp) < 3);
    const big5in3min = last3min.filter(r => isBig(r, 5)).length >= 2;
    const oneInLast90s = sorted.filter(r => minsAgo(r.timestamp) < 1.5).some(isOne);
    return big5in3min && oneInLast90s;
  })();

  // Hit moyen → petite cote → gros hit (section D)
  const hitMoyen10_15 = sorted.find(r => r.multiplier >= 10 && r.multiplier <= 15);
  const miniAfterMedium = hitMoyen10_15 &&
    sorted.filter(r => r.timestamp > hitMoyen10_15.timestamp)
      .slice(0, 2).some(r => r.multiplier < 2) &&
    minsAgo(hitMoyen10_15.timestamp) < 0.5;

  if (reveilDouble) {
    niveauCode = 'maximum';
    timer = '1m03s';
    cible = '10x+';
    split = stdSplit10x();
    details.push('✅ Réveil double > 5x en < 3 min + 1.00x → Split prioritaire');
  } else if (miniAfterMedium) {
    niveauCode = 'fort';
    timer = '2m20s ou 4m45s';
    cible = '50x+';
    split = splitBig();
    details.push('✅ Hit 10–15x → cote < 2x → préparer second split 50x+');
  } else if (reveilSimple && sorted.filter(r => minsAgo(r.timestamp) < 1.5).some(isOne)) {
    niveauCode = 'maximum';
    timer = '1m03s';
    cible = '10x+';
    split = stdSplit10x();
    details.push('✅ Réveil > 5x + 1.00x dans 30s → Split prioritaire');
  } else if (reveilSimple) {
    niveauCode = 'fort';
    timer = '1m03s';
    cible = '10x';
    split = stdSplit10x();
    details.push('✅ Réveil simple (> 5x) → Split');
  } else if (accDurMin < 2 && onesInAcc >= 1) {
    niveauCode = 'maximum';
    timer = '1m03s';
    cible = '10x+';
    split = stdSplit10x();
    details.push('✅ Accumulation < 2 min + 1.00x → Signal Maximum');
  } else if (accDurMin < 2) {
    niveauCode = 'tres_fort';
    timer = '1m03s';
    cible = '10x+';
    split = stdSplit10x();
    details.push('✅ Accumulation < 2 min → Signal Très Fort');
  } else if (accDurMin < 3 && onesInAcc >= 1) {
    niveauCode = 'fort';
    timer = '1m03s';
    cible = '10x';
    split = stdSplit10x();
    details.push('✅ Accumulation 2–3 min + 1.00x → Signal Fort');
  } else if (accDurMin < 3) {
    niveauCode = 'modere';
    timer = '1m03s';
    cible = '10x';
    split = stdSplit10x();
    details.push('🟡 Accumulation 2–3 min → Signal Modéré');
  } else if (accDurMin < 4 && onesInAcc >= 1) {
    niveauCode = 'faible';
    timer = '1m03s';
    cible = '10x';
    split = stdSplit10x();
    details.push('🟠 Accumulation 3–4 min + 1.00x → Signal Faible');
  } else if (accDurMin < 4) {
    niveauCode = 'tres_faible';
    timer = '—';
    cible = '2x';
    split = [{ pct: '100%', timer: '11s45', cible: '2x (sécurisé)' }];
    details.push('⚪ Accumulation 3–4 min sans 1.00x → Ne pas split');
  } else if (accDurMin >= 4 && onesInAcc >= 2) {
    niveauCode = 'fort';
    timer = '1m03s';
    cible = '10x+';
    split = stdSplit10x();
    details.push('🔴 Accumulation > 4 min + 2× 1.00x → Signal Fort');
  } else {
    niveauCode = 'faible';
    timer = '1m03s';
    cible = '10x';
    split = stdSplit10x();
    details.push('🟠 Accumulation > 4 min → Signal Faible');
  }

  // ── 5. Très gros multiplicateur (>500x) check ──────────────────────────────
  const canTarget500 =
    peaks100_2h.length >= 2 &&
    lastBig500 == null &&
    last3big50.length >= 3 &&
    last3big50.every(r => hasCleanTermination(r.multiplier)) &&
    lastBig100 != null && minsAgo(lastBig100.timestamp) > 5 &&
    !no100xIn2h;

  if (canTarget500 && (niveauCode === 'maximum' || niveauCode === 'tres_fort' || niveauCode === 'fort')) {
    cible = '500x+';
    timer = '4m45s';
    split = splitBig500();
    details.push('🎯 Conditions >500x réunies : grappe 100x + terminaisons propres');
  } else if (trèsChaud && (niveauCode === 'maximum' || niveauCode === 'tres_fort')) {
    cible = '100x+';
    timer = '4m45s';
    split = splitBig();
    details.push('🔥 Phase très chaude : viser 100x+ (split long)');
  }

  // ── 6. Phase froide → forcer 2x sécurisé ─────────────────────────────────
  if ((phase === 'froid' || phase === 'froid_extreme') &&
      (niveauCode === 'tres_faible' || niveauCode === 'faible')) {
    cible = '2x';
    timer = '11s45';
    split = [{ pct: '100%', timer: '11s45', cible: '2x (sécurisé)' }];
    details.push('❄️ Phase froide → 2x sécurisé uniquement');
  }

  // ── 7. Entry time (now + small delay) ─────────────────────────────────────
  const entryDelay = niveauCode === 'maximum' || niveauCode === 'tres_fort' ? 0 : 5000;
  const heureEntree = formatTime(now + entryDelay);

  const niveauLabels: Record<SignalLevel, string> = {
    maximum:     '🔴 MAXIMUM',
    tres_fort:   '🔴 Très Fort',
    fort:        '🟠 Fort',
    modere:      '🟡 Modéré',
    faible:      '🟠 Faible',
    tres_faible: '⚪ Très Faible',
    blocage:     '🚫 Bloqué',
    attente:     '⏳ Attente',
  };

  // Phase froide → afficher aussi la latence post-100x si applicable
  if (lastBig100 && minsAgo(lastBig100.timestamp) < 15) {
    const rem = (15 - minsAgo(lastBig100.timestamp)).toFixed(1);
    details.push(`⏳ Latence post-100x : encore ~${rem} min avant de rejouer`);
  }

  return {
    heureEntree,
    timer,
    cible,
    niveauLabel: niveauLabels[niveauCode],
    niveauCode,
    phase,
    phaseLabel: phaseLabels[phase],
    details,
    split,
    blocage: false,
  };
}

// ── Split helpers ──────────────────────────────────────────────────────────────

function stdSplit10x(): SplitPart[] {
  return [
    { pct: '50%', timer: '11s45', cible: '2x (sécurisé)' },
    { pct: '50%', timer: '1m03s', cible: '10x+ (offensif)' },
  ];
}

function splitBig(): SplitPart[] {
  return [
    { pct: '70%', timer: '11s45', cible: '2x (sécurisé)' },
    { pct: '20%', timer: '2m20s', cible: '50x' },
    { pct: '10%', timer: '4m45s', cible: '100x+' },
  ];
}

function splitBig500(): SplitPart[] {
  return [
    { pct: '70%', timer: '11s45', cible: '2x (sécurisé)' },
    { pct: '20%', timer: '2m20s', cible: '50x' },
    { pct: '10%', timer: '4m45s', cible: '500x+' },
  ];
}

function makeBlocage(
  now: number,
  phase: Phase,
  phaseLabel: string,
  details: string[],
  raison: string,
): AnalysisResult {
  return {
    heureEntree: '—',
    timer: '—',
    cible: '—',
    niveauLabel: '🚫 Signal Bloqué',
    niveauCode: 'blocage',
    phase,
    phaseLabel,
    details,
    split: [],
    blocage: true,
    blocageRaison: raison,
  };
}

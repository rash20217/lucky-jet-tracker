import { useState, useEffect } from 'react';

interface LearnWindow {
  offset: number;
  len: number;
  edge: number;
  transform: string;
  score10: number;
  score25: number;
}

interface ZoneBucket {
  range: string;
  avgCrash: number | null;
  count: number;
  pctLow: number;
  pctMid: number;
  pctHigh: number;
}

interface PFData {
  currentHash: string | null;
  currentPrediction: number | null;
  predictionZone: number | null;
  predictionNorm: number | null;
  confidence: 'low' | 'medium' | 'high';
  chainValid: boolean | null;
  hasDigest: boolean;
  learn: {
    sampleSize: number;
    calibrated: boolean;
    bestWindow: LearnWindow | null;
    zoneModelReady: boolean;
    lastCalibrated: number;
  };
  accuracy: {
    exact: number;
    within10pct: number;
    within25pct: number;
    sampleSize: number;
  } | null;
  zoneModel: ZoneBucket[] | null;
  recentPairs: {
    hash: string;
    predicted: number;
    actual: number;
    diff: string;
  }[];
}

const ZONE_LABELS = ['< 2x', '2–5x', '5–10x', '> 10x'];
const ZONE_COLORS = ['#e07030', '#f59e0b', '#6b7aff', '#4ade80', '#a855f7'];

function predColor(v: number) {
  if (v < 1.5) return '#e07030';
  if (v < 2)   return '#f59e0b';
  if (v < 5)   return '#6b7aff';
  if (v < 10)  return '#4ade80';
  return '#a855f7';
}

function confidenceLabel(c: string) {
  if (c === 'high')   return { label: 'Élevée', color: '#4ade80' };
  if (c === 'medium') return { label: 'Modérée', color: '#f59e0b' };
  return { label: 'Faible', color: '#64748b' };
}

export default function PFPredictor() {
  const [data, setData] = useState<PFData | null>(null);
  const [showPairs, setShowPairs] = useState(false);
  const [showZones, setShowZones] = useState(false);

  useEffect(() => {
    async function fetchPF() {
      try {
        const res = await fetch('/api/pf-prediction');
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
    }
    fetchPF();
    const id = setInterval(fetchPF, 3000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const learn    = data.learn;
  const pred     = data.currentPrediction;
  const acc      = data.accuracy;
  const conf     = confidenceLabel(data.confidence);
  const sample   = learn.sampleSize;
  const bestW    = learn.bestWindow;
  const score10  = bestW?.score10 ?? 0;

  // Progress milestones
  const milestones = [5, 20, 50, 100, 200];
  const nextMile   = milestones.find(m => m > sample) ?? 200;
  const progress   = Math.min(100, Math.round(sample / nextMile * 100));

  // Status badge
  const statusLabel = !learn.calibrated   ? 'Calibration'
    : score10 < 15  ? 'Apprentissage'
    : score10 < 30  ? 'Progression'
    : 'Actif';
  const statusColor = !learn.calibrated ? '#64748b'
    : score10 < 15  ? '#f59e0b'
    : score10 < 30  ? '#6b7aff'
    : '#4ade80';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1421 0%, #111827 100%)',
      border: '1px solid #2a3a5c',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '22px', marginTop: '2px' }}>🔐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '2px', color: '#e2e8f0' }}>
            PROVABLY FAIR — PRÉDICTION RNG
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Auto-apprentissage sur les données live · {sample} rounds analysés
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: statusColor + '18',
          border: `1px solid ${statusColor}44`,
          borderRadius: '20px',
          padding: '5px 12px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: statusColor,
            animation: !learn.calibrated ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{ fontSize: '11px', color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────── */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            Progression vers {nextMile} rounds
          </span>
          <span style={{ fontSize: '10px', color: statusColor, fontWeight: 600 }}>
            {sample} / {nextMile}
          </span>
        </div>
        <div style={{ background: '#111827', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`,
            borderRadius: '6px',
            transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          {milestones.map(m => (
            <span key={m} style={{
              fontSize: '9px',
              color: sample >= m ? statusColor : '#3a4560',
              fontWeight: sample >= m ? 700 : 400,
            }}>{m}</span>
          ))}
        </div>
      </div>

      {/* ── Prediction box ──────────────────────────────────────── */}
      {pred != null ? (
        <div style={{
          background: '#0a0f1c',
          borderRadius: '12px',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>
              CRASH ESTIMÉ — PROCHAIN ROUND
            </div>
            <div style={{ fontSize: '38px', fontWeight: 900, color: predColor(pred), lineHeight: 1 }}>
              ~{pred.toFixed(2)}x
            </div>
            {data.predictionZone !== null && (
              <div style={{ fontSize: '11px', color: ZONE_COLORS[data.predictionZone] ?? '#64748b', marginTop: '5px' }}>
                Zone prédite : {ZONE_LABELS[data.predictionZone]}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>CONFIANCE</div>
            <div style={{
              fontSize: '13px',
              fontWeight: 700,
              color: conf.color,
              background: conf.color + '18',
              border: `1px solid ${conf.color}44`,
              borderRadius: '8px',
              padding: '4px 10px',
            }}>
              {conf.label}
            </div>
            {bestW && (
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                ±10% : <b style={{ color: '#e2e8f0' }}>{score10}%</b>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#0a0f1c', borderRadius: '12px', padding: '14px',
          textAlign: 'center', color: '#64748b', marginBottom: '12px',
          fontSize: '12px',
        }}>
          En attente du prochain round…
        </div>
      )}

      {/* ── Best window found ───────────────────────────────────── */}
      {bestW && (
        <div style={{
          background: '#070c17',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}>
          {[
            { label: 'Fenêtre',     value: `pos.${bestW.offset}+${bestW.len}` },
            { label: 'Formule',     value: bestW.transform },
            { label: 'House edge',  value: `${Math.round(bestW.edge * 100)}%` },
            { label: 'Score ±10%', value: `${score10}%`, highlight: score10 >= 25 },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '3px' }}>{s.label}</div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: s.highlight ? '#4ade80' : '#e2e8f0',
                fontFamily: s.label === 'Formule' ? 'monospace' : 'inherit',
              }}>
                {String(s.value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Accuracy stats ──────────────────────────────────────── */}
      {acc && acc.sampleSize > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {[
            { label: 'Exact (±1%)',    val: acc.exact,        color: '#4ade80' },
            { label: 'Proche (±10%)',  val: acc.within10pct,  color: '#6b7aff' },
            { label: 'Approx (±25%)', val: acc.within25pct,  color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#0a0f1c', borderRadius: '8px', padding: '10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.val}%</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Hash + integrity ────────────────────────────────────── */}
      {data.currentHash && (
        <div style={{
          background: '#070c17', borderRadius: '8px', padding: '8px 12px',
          marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>HASH:</span>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#4ade80', opacity: 0.7, wordBreak: 'break-all' }}>
            {data.currentHash.slice(0, 32)}…
          </span>
          {data.hasDigest && (
            <span style={{ fontSize: '10px', color: '#4ade80', whiteSpace: 'nowrap', marginLeft: 'auto' }}>✓</span>
          )}
        </div>
      )}

      {/* ── Zone model toggle ───────────────────────────────────── */}
      {data.zoneModel && learn.zoneModelReady && (
        <>
          <button onClick={() => setShowZones(p => !p)} style={{
            background: 'none', border: '1px solid #1e2535', borderRadius: '8px',
            color: '#64748b', fontSize: '11px', padding: '6px 14px',
            cursor: 'pointer', width: '100%', marginBottom: '6px',
          }}>
            {showZones ? '▲ Masquer' : '▼ Modèle de zones RNG'}
          </button>
          {showZones && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '4px', padding: '8px',
                background: '#070c17', borderRadius: '8px',
              }}>
                {data.zoneModel.map((b, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{
                      height: '40px', display: 'flex', flexDirection: 'column',
                      justifyContent: 'flex-end', gap: '1px',
                    }}>
                      <div style={{ height: `${b.pctHigh * 0.4}px`, background: '#6b7aff', borderRadius: '2px 2px 0 0', minHeight: b.pctHigh > 0 ? '2px' : '0' }} />
                      <div style={{ height: `${b.pctMid * 0.4}px`, background: '#f59e0b', minHeight: b.pctMid > 0 ? '2px' : '0' }} />
                      <div style={{ height: `${b.pctLow * 0.4}px`, background: '#e07030', borderRadius: '0 0 2px 2px', minHeight: b.pctLow > 0 ? '2px' : '0' }} />
                    </div>
                    <div style={{ fontSize: '8px', color: '#3a4560', marginTop: '2px' }}>{b.count}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '6px' }}>
                {[['#e07030','< 2x'], ['#f59e0b','2–5x'], ['#6b7aff','> 5x']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', background: c, borderRadius: '2px' }} />
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{l}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '10px', color: '#3a4560', textAlign: 'center', marginTop: '4px' }}>
                Distribution des crashes par segment du hash (8 buckets)
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Recent pairs toggle ─────────────────────────────────── */}
      {data.recentPairs.length > 0 && (
        <>
          <button onClick={() => setShowPairs(p => !p)} style={{
            background: 'none', border: '1px solid #1e2535', borderRadius: '8px',
            color: '#64748b', fontSize: '11px', padding: '6px 14px',
            cursor: 'pointer', width: '100%',
          }}>
            {showPairs ? '▲ Masquer' : '▼ Vérifications récentes'}
          </button>
          {showPairs && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px', padding: '5px 0', borderBottom: '1px solid #1e2535' }}>
                {['Hash', 'Estimé', 'Réel', 'Écart'].map(h => (
                  <div key={h} style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{h}</div>
                ))}
              </div>
              {data.recentPairs.map((p, i) => {
                const pct = parseInt(p.diff);
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: '6px', padding: '6px 0', borderBottom: '1px solid #0d1421', alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#4ade80', opacity: 0.7 }}>{p.hash}</div>
                    <div style={{ fontSize: '11px', color: '#6b7aff' }}>{p.predicted?.toFixed(2)}x</div>
                    <div style={{ fontSize: '11px', color: '#e2e8f0' }}>{p.actual.toFixed(2)}x</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: pct < 15 ? '#4ade80' : pct < 30 ? '#f59e0b' : '#e07030' }}>
                      {p.diff}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

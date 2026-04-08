import { useState, useEffect, useRef } from 'react';

interface Prediction {
  id: number;
  generatedAt: number;
  generatedAtFmt: string;
  windowStart: number;
  windowEnd: number;
  windowStartFmt: string;
  windowEndFmt: string;
  target: number;
  level: string;
  signal: string;
  timer: string;
  confidence: number;
  accDurMin: number;
  onesInAcc: number;
  avg10: number;
  note: string | null;
  status: 'pending' | 'success' | 'fail';
  bestMultiplier: number | null;
  roundsInWindow: number;
  resolvedAt: number | null;
}

interface Score {
  total: number;
  success: number;
  fail: number;
  rate: number;
}

interface ApiData {
  predictions: Prediction[];
  score: Score;
  nextPredictionIn: number;
  nextPredictionAt: string;
}

function formatMs(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const levelColors: Record<string, string> = {
  'MAXIMUM':  '#ff2d55',
  'FORT':     '#ff6b00',
  'MODÉRÉ':   '#ffd700',
  'CHAUD':    '#ff8c00',
  'AGRESSIF': '#a855f7',
  'PRUDENCE': '#60a5fa',
  'FAIBLE':   '#64748b',
};

function statusIcon(s: Prediction['status']) {
  if (s === 'success') return '✅';
  if (s === 'fail')    return '❌';
  return '⏳';
}

function statusColor(s: Prediction['status']) {
  if (s === 'success') return '#22c55e';
  if (s === 'fail')    return '#f87171';
  return '#fbbf24';
}

export default function PredictorPanel() {
  const [data, setData] = useState<ApiData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [serverIn, setServerIn] = useState(0);
  const fetchedAt = useRef(0);

  async function fetchData() {
    try {
      const r = await fetch('/api/predictions');
      const d: ApiData = await r.json();
      setData(d);
      setServerIn(d.nextPredictionIn);
      fetchedAt.current = Date.now();
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (serverIn <= 0) return;
      const elapsed = Date.now() - fetchedAt.current;
      setCountdown(Math.max(0, serverIn - elapsed));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [serverIn]);

  const active = data?.predictions.find(p => p.status === 'pending');
  const recent = data?.predictions.filter(p => p.status !== 'pending').slice(0, 8) ?? [];
  const score  = data?.score ?? { total: 0, success: 0, fail: 0, rate: 0 };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── Panel header ── */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(99,102,241,.2),rgba(168,85,247,.1))',
        border: '1px solid rgba(99,102,241,.4)',
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 15, letterSpacing: '0.04em' }}>
              🤖 PREDICTOR AUTOMATIQUE
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
              Prédictions toutes les 5 min · Fenêtre T+3 → T+5 min
            </div>
          </div>
          {/* Score badges */}
          <div style={{ display: 'flex', gap: 8 }}>
            <ScoreBadge label="✅" value={score.success} color="#22c55e" />
            <ScoreBadge label="❌" value={score.fail} color="#f87171" />
            <ScoreBadge label="%" value={score.rate} color="#a5b4fc" suffix="%" />
          </div>
        </div>

        {/* Countdown to next */}
        <div style={{
          background: 'rgba(0,0,0,.3)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Prochaine prédiction
            </div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, marginTop: 2 }}>
              à {data?.nextPredictionAt ?? '—'}
            </div>
          </div>
          <div style={{
            background: countdown < 30000 ? 'rgba(255,45,85,.15)' : 'rgba(99,102,241,.15)',
            border: `1px solid ${countdown < 30000 ? '#ff2d55' : '#6366f1'}`,
            borderRadius: 8,
            padding: '6px 14px',
            color: countdown < 30000 ? '#ff6b6b' : '#a5b4fc',
            fontWeight: 800,
            fontSize: 22,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.05em',
          }}>
            {formatMs(countdown)}
          </div>
        </div>
      </div>

      {/* ── Active prediction ── */}
      {active && (
        <div style={{
          background: 'rgba(251,191,36,.07)',
          border: '1px solid rgba(251,191,36,.35)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 10,
          animation: 'pulseGlow 2s infinite',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>⏳ PRÉDICTION EN COURS</span>
            <span style={{ color: '#64748b', fontSize: 11 }}>
              Générée à {active.generatedAtFmt}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <ActiveBox label="Fenêtre" value={`${active.windowStartFmt}`} sub={`→ ${active.windowEndFmt}`} color="#fbbf24" />
            <ActiveBox label="Cible" value={`≥ ${active.target}x`} sub={active.timer} color={levelColors[active.level] ?? '#a5b4fc'} />
            <ActiveBox label="Signal" value={active.level} sub={`${active.confidence}% conf.`} color={levelColors[active.level] ?? '#a5b4fc'} />
          </div>

          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#64748b' }}>
            <span>Acc: {active.accDurMin}min</span>
            <span>·</span>
            <span>{active.onesInAcc}× 1.00x</span>
            <span>·</span>
            <span>Moy: {active.avg10}x</span>
            {active.note && <><span>·</span><span style={{ color: '#f87171' }}>{active.note}</span></>}
          </div>
        </div>
      )}

      {!active && data && (
        <div style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 10,
          textAlign: 'center',
          color: '#475569',
          fontSize: 13,
        }}>
          Aucune prédiction active — prochaine dans {formatMs(countdown)}
        </div>
      )}

      {/* ── History ── */}
      {recent.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,.02)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#64748b', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              Historique des prédictions
            </span>
            <span style={{ color: '#475569', fontSize: 11 }}>
              Total: {score.total} · Taux: {score.rate}%
            </span>
          </div>
          {recent.map(pred => (
            <PredRow key={pred.id} pred={pred} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(251,191,36,0); }
          50% { box-shadow: 0 0 12px rgba(251,191,36,.15); }
        }
      `}</style>
    </div>
  );
}

function ScoreBadge({ label, value, color, suffix = '' }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div style={{
      background: `${color}15`,
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: '4px 10px',
      textAlign: 'center',
      minWidth: 44,
    }}>
      <div style={{ fontSize: 10, color: '#475569' }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 16 }}>{value}{suffix}</div>
    </div>
  );
}

function ActiveBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,.2)',
      borderRadius: 8,
      padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ color: '#475569', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 15 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function PredRow({ pred }: { pred: Prediction }) {
  const sColor = statusColor(pred.status);
  const lColor = levelColors[pred.level] ?? '#888';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 70px 1fr 80px 70px',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderBottom: '1px solid rgba(255,255,255,.04)',
      fontSize: 12,
    }}>
      <span style={{ fontSize: 14, textAlign: 'center' }}>{statusIcon(pred.status)}</span>
      <span style={{ color: '#475569' }}>{pred.generatedAtFmt}</span>
      <div>
        <span style={{ color: lColor, fontWeight: 700 }}>{pred.level}</span>
        <span style={{ color: '#475569', marginLeft: 6 }}>
          {pred.windowStartFmt}→{pred.windowEndFmt}
        </span>
      </div>
      <span style={{ color: '#94a3b8', textAlign: 'center' }}>≥ {pred.target}x</span>
      <span style={{ color: sColor, fontWeight: 700, textAlign: 'right' }}>
        {pred.bestMultiplier != null ? `${pred.bestMultiplier}x` : '—'}
      </span>
    </div>
  );
}

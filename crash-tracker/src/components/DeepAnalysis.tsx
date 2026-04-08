import { useState, useCallback } from 'react';
import type { Round } from '../types';
import { runDeepAnalysis } from '../deepAnalysis';
import type { DeepAnalysisResult, TrapWarning } from '../deepAnalysis';

interface Props {
  rounds: Round[];
}

export default function DeepAnalysis({ rounds }: Props) {
  const [result, setResult] = useState<DeepAnalysisResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setResult(runDeepAnalysis(rounds));
      setOpen(true);
      setLoading(false);
    }, 800);
  }, [rounds, loading]);

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Trigger button ── */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 12,
          border: '2px solid #1d4ed8',
          background: loading
            ? 'rgba(29,78,216,.06)'
            : 'linear-gradient(135deg,rgba(29,78,216,.2),rgba(99,102,241,.08))',
          color: loading ? '#555' : '#93c5fd',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.05em',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'all .2s',
        }}
      >
        <span style={{ fontSize: 18 }}>{loading ? '⏳' : '🔬'}</span>
        {loading ? 'Analyse approfondie en cours…' : 'Analyse Stratégique Approfondie'}
      </button>

      {/* ── Results panel ── */}
      {result && open && (
        <div style={{
          marginTop: 12,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(29,78,216,.4)',
          background: 'rgba(10,14,30,.7)',
          animation: 'fadeInUp .3s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg,rgba(29,78,216,.3),rgba(99,102,241,.15))',
            borderBottom: '1px solid rgba(29,78,216,.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <span style={{ color: '#93c5fd', fontWeight: 800, fontSize: 15 }}>
                🔬 Analyse Stratégique — {result.generatedAt}
              </span>
              <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                Basée sur {result.basedOnRounds} tours en temps réel
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', fontSize: 18, padding: 4,
            }}>✕</button>
          </div>

          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── Section 1: Cycle & Signals ── */}
            <Section title="🔎 Cycle Actuel & Détection des Signaux">
              {/* Cycle badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                background: `${result.cycleColor}18`,
                border: `1px solid ${result.cycleColor}44`,
                borderRadius: 10,
                marginBottom: 12,
              }}>
                <span style={{ fontSize: 26 }}>
                  {result.cycle === 'tres_chaud' ? '🔥' :
                   result.cycle === 'chaud' ? '🌡️' :
                   result.cycle === 'stable' ? '🟡' :
                   result.cycle === 'froid' ? '❄️' : '🧊'}
                </span>
                <div>
                  <div style={{ color: result.cycleColor, fontWeight: 800, fontSize: 16 }}>
                    {result.cycleLabel}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                    Accumulation : {result.accumulationMin} min · {result.onesInAcc}× 1.00x détectés
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <MiniStat label="Cotes < 2x (10 min)" value={String(result.recentLow2x)} color="#f87171" />
                <MiniStat label="Cotes < 5x (10 min)" value={String(result.recentLow5x)} color="#fb923c" />
                <MiniStat label="Hits > 10x (30 min)" value={String(result.recentHigh10x)} color="#4ade80" />
                <MiniStat label="Hits > 50x (60 min)" value={String(result.recentHigh50x)} color="#facc15" />
              </div>

              <Row label="Dernier > 10x" value={result.sinceLastBig10x} />
              <Row label="Dernier > 50x" value={result.sinceLastBig50x} />

              {/* Signals */}
              <div style={{ marginTop: 10 }}>
                {result.signals.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    marginBottom: 4,
                    background: `${s.color}12`,
                    border: `1px solid ${s.color}30`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: s.color,
                    fontWeight: 600,
                  }}>
                    {s.label}
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Section 2: Probability Windows ── */}
            <Section title="📊 Probabilités de Multiplicateurs Élevés">
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Prochaine fenêtre critique ≥ 50x attendue vers
                </div>
                <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 20 }}>
                  {result.nextCriticalWindow}
                </div>
                <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                  Intervalle moyen 10x : {result.avgInterval10x} min · Intervalle moyen 50x : {result.avgInterval50x} min
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.windows.map(w => (
                  <div key={w.label} style={{
                    background: 'rgba(255,255,255,.04)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 1fr',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 14 }}>{w.label}</div>
                    <ProbBar label="> 50x" pct={w.pctAbove50x} color="#facc15" />
                    <ProbBar label="> 100x" pct={w.pctAbove100x} color="#f87171" />
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Section 3: Action Plan ── */}
            <Section title="🧠 Plan d'Action">
              {/* Strategy badge */}
              <div style={{
                padding: '10px 14px',
                background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.3)',
                borderRadius: 10,
                marginBottom: 12,
                color: '#a5b4fc',
                fontWeight: 700,
                fontSize: 14,
              }}>
                {result.strategyLabel}
              </div>

              {/* Entry windows */}
              {result.entryWindows.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SectionSubtitle>🕒 Fenêtres d'Entrée Propices</SectionSubtitle>
                  {result.entryWindows.map((w, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,.04)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 6,
                    }}>
                      <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
                        {w.from} → {w.to}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{w.reason}</div>
                      <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{w.frequency}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Split plan */}
              <SectionSubtitle>💰 Gestion des Mises (Split)</SectionSubtitle>
              {result.splitPlan.map((s, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '55px 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(255,255,255,.04)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 6,
                }}>
                  <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 15 }}>{s.pct}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 13 }}>{s.target}</span>
                  <span style={{
                    background: 'rgba(99,102,241,.2)',
                    color: '#a5b4fc',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>⏱ {s.timer}</span>
                </div>
              ))}

              <div style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'rgba(251,191,36,.08)',
                borderRadius: 8,
                color: '#fbbf24',
                fontSize: 12,
                fontWeight: 600,
              }}>
                📈 Progression : {result.progression}
              </div>
            </Section>

            {/* ── Section 4: Anti-Traps ── */}
            <Section title="🛡️ Détection des Pièges">
              {result.traps.map((t, i) => (
                <TrapRow key={i} trap={t} />
              ))}
            </Section>

            {/* ── Section 5: Practical Tips ── */}
            <Section title="💡 Conseils Pratiques">
              {result.tips.map((tip, i) => (
                <div key={i} style={{
                  fontSize: 13,
                  color: '#94a3b8',
                  padding: '6px 0',
                  borderBottom: i < result.tips.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                  lineHeight: 1.5,
                }}>
                  {tip}
                </div>
              ))}
            </Section>

          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        color: '#64748b',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid rgba(255,255,255,.07)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#475569', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7, marginTop: 4 }}>
      {children}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      borderRadius: 8,
      padding: '8px 10px',
      textAlign: 'center',
    }}>
      <div style={{ color, fontWeight: 800, fontSize: 20 }}>{value}</div>
      <div style={{ color: '#475569', fontSize: 10, marginTop: 3 }}>{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,.04)',
    }}>
      <span style={{ color: '#475569', fontSize: 12 }}>{label}</span>
      <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ProbBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#64748b', fontSize: 10 }}>{label}</span>
        <span style={{ color, fontSize: 11, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          transition: 'width .5s ease',
        }} />
      </div>
    </div>
  );
}

function TrapRow({ trap }: { trap: TrapWarning }) {
  const sevColor = trap.severity === 'high' ? '#f87171' : trap.severity === 'medium' ? '#fb923c' : '#fbbf24';
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,.05)',
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: trap.detected ? sevColor : '#1e3a1e',
        border: `2px solid ${trap.detected ? sevColor : '#22c55e'}`,
        flexShrink: 0,
        marginTop: 4,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: trap.detected ? sevColor : '#22c55e',
          marginBottom: 2,
        }}>
          {trap.type} {trap.detected ? '⚠️ DÉTECTÉ' : '✅ OK'}
        </div>
        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
          {trap.detail}
        </div>
      </div>
    </div>
  );
}

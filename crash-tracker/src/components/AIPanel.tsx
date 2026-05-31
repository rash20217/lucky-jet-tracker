import { useState, useEffect } from 'react';

const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZONE_COLORS: Record<string, string> = {
  A: '#ef4444', B: '#f97316', C: '#6b7aff',
  D: '#4ade80', E: '#a855f7', F: '#fbbf24',
};
const ZONE_LABELS: Record<string, string> = {
  A: '< 1.5x', B: '1.5–2x', C: '2–5x',
  D: '5–10x', E: '10–50x', F: '> 50x',
};

interface MarkovData {
  current: string;
  currentLabel: string;
  transitions: Record<string, number>;
  bestNext: { zone: string; label: string; pct: number };
}

interface PatternData {
  bigram: string | null;
  patternNext: string | null;
  patternNextLabel: string | null;
  patternConf: number;
  topPatterns: Array<{ sequence: string; zones: string[]; count: number; pct: number }>;
  deepPatterns: Array<{ sequence: string; count: number }>;
}

interface MomentumData {
  ema5: number;
  ema20: number;
  trend: 'bullish' | 'bearish';
  strength: number;
  slope: number;
}

interface CompositeData {
  zone: string;
  label: string;
  confidence: number;
  votes: Record<string, number>;
}

interface AIData {
  markov: MarkovData;
  pattern: PatternData;
  momentum: MomentumData;
  streak: { type: string; count: number };
  zoneFreq: Record<string, number>;
  anomalies: { mean: number; stdDev: number; detected: boolean; values: number[] };
  composite: CompositeData;
  zoneLabels: Record<string, string>;
  basedOn: number;
  generatedAt: string;
  error?: string;
}

export default function AIPanel() {
  const [data, setData] = useState<AIData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'markov' | 'patterns' | 'momentum' | 'zones'>('markov');

  async function fetchAI() {
    try {
      const r = await fetch('/api/ai-analysis');
      const d: AIData = await r.json();
      setData(d);
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!open) return;
    fetchAI();
    const id = setInterval(fetchAI, 8000);
    return () => clearInterval(id);
  }, [open]);

  function handleOpen() {
    if (open) { setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    fetchAI().then(() => setLoading(false));
  }

  const totalVotes = data ? Object.values(data.composite.votes).reduce((a, b) => a + b, 0) : 0;

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 12,
          border: `2px solid ${open ? '#818cf8' : '#312e81'}`,
          background: open
            ? 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.12))'
            : 'linear-gradient(135deg,rgba(49,46,129,.4),rgba(49,46,129,.15))',
          color: open ? '#c7d2fe' : '#6366f1',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all .2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div style={{ textAlign: 'left' }}>
            <div>Intelligence Artificielle</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: '#6366f1', marginTop: 1 }}>
              Markov · Patterns · Momentum · Anomalies
            </div>
          </div>
        </div>
        <span style={{ fontSize: 18, color: '#6366f1' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Panel ── */}
      {open && (
        <div style={{
          marginTop: 10,
          borderRadius: 14,
          border: '1px solid rgba(99,102,241,.35)',
          background: 'rgba(10,12,28,.85)',
          overflow: 'hidden',
          animation: 'fadeInUp .25s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.1))',
            borderBottom: '1px solid rgba(99,102,241,.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <span style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 14 }}>
                🤖 Analyse IA — {data?.generatedAt ?? '—'}
              </span>
              <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                {data ? `Basée sur ${data.basedOn} tours · Mise à jour toutes les 8s` : 'Chargement…'}
              </div>
            </div>
            {data && (
              <div style={{
                background: `${ZONE_COLORS[data.composite.zone]}20`,
                border: `1.5px solid ${ZONE_COLORS[data.composite.zone]}60`,
                borderRadius: 10,
                padding: '6px 12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#64748b', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>IA Prédit</div>
                <div style={{ color: ZONE_COLORS[data.composite.zone], fontWeight: 800, fontSize: 16 }}>
                  {data.composite.label}
                </div>
                <div style={{ color: '#475569', fontSize: 10 }}>{data.composite.confidence}% conf.</div>
              </div>
            )}
          </div>

          {loading && !data && (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>🤖</div>
              <div>Analyse en cours…</div>
            </div>
          )}

          {data && !data.error && (
            <>
              {/* ── Tabs ── */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,.07)',
                background: 'rgba(0,0,0,.2)',
              }}>
                {([
                  { id: 'markov',   label: '⛓ Markov' },
                  { id: 'patterns', label: '🔁 Patterns' },
                  { id: 'momentum', label: '📈 Momentum' },
                  { id: 'zones',    label: '🗺 Zones' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      background: 'none',
                      border: 'none',
                      borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                      color: tab === t.id ? '#a5b4fc' : '#475569',
                      fontWeight: tab === t.id ? 700 : 400,
                      fontSize: 11,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: '16px' }}>

                {/* ══ Tab: Markov ══ */}
                {tab === 'markov' && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                      Probabilités de transition depuis le dernier tour
                    </div>

                    {/* Current zone */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 14,
                      padding: '10px 14px',
                      background: `${ZONE_COLORS[data.markov.current]}15`,
                      border: `1px solid ${ZONE_COLORS[data.markov.current]}40`,
                      borderRadius: 10,
                    }}>
                      <ZoneBadge zone={data.markov.current} />
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Zone actuelle</div>
                        <div style={{ color: ZONE_COLORS[data.markov.current], fontWeight: 700, fontSize: 16 }}>
                          {data.markov.currentLabel}
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Meilleur prochain</div>
                        <div style={{ color: ZONE_COLORS[data.markov.bestNext.zone], fontWeight: 800, fontSize: 15 }}>
                          {data.markov.bestNext.label} <span style={{ color: '#64748b', fontSize: 12 }}>({data.markov.bestNext.pct}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Transition bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {ZONES.map(z => {
                        const pct = data.markov.transitions[z] ?? 0;
                        return (
                          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ZoneBadge zone={z} small />
                            <div style={{ flex: 1 }}>
                              <div style={{
                                height: 8,
                                background: 'rgba(255,255,255,.07)',
                                borderRadius: 4,
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  background: ZONE_COLORS[z],
                                  borderRadius: 4,
                                  transition: 'width .5s ease',
                                }} />
                              </div>
                            </div>
                            <div style={{ color: ZONE_COLORS[z], fontWeight: 700, fontSize: 13, minWidth: 36, textAlign: 'right' }}>
                              {pct}%
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Composite vote breakdown */}
                    <div style={{
                      marginTop: 16,
                      padding: '12px 14px',
                      background: 'rgba(99,102,241,.08)',
                      border: '1px solid rgba(99,102,241,.25)',
                      borderRadius: 10,
                    }}>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Score IA composite (Markov + Patterns + Momentum)
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ZONES.map(z => {
                          const v = data.composite.votes[z] ?? 0;
                          const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                          return (
                            <div key={z} style={{
                              flex: 1,
                              minWidth: 44,
                              background: z === data.composite.zone ? `${ZONE_COLORS[z]}25` : 'rgba(255,255,255,.04)',
                              border: `1px solid ${z === data.composite.zone ? ZONE_COLORS[z] + '80' : 'rgba(255,255,255,.08)'}`,
                              borderRadius: 8,
                              padding: '8px 6px',
                              textAlign: 'center',
                            }}>
                              <div style={{ fontSize: 9, color: '#475569', marginBottom: 3 }}>{ZONE_LABELS[z]}</div>
                              <div style={{ color: ZONE_COLORS[z], fontWeight: 800, fontSize: 15 }}>{pct}%</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#64748b', fontSize: 12 }}>Prédiction finale :</span>
                        <span style={{
                          background: `${ZONE_COLORS[data.composite.zone]}20`,
                          border: `1px solid ${ZONE_COLORS[data.composite.zone]}50`,
                          color: ZONE_COLORS[data.composite.zone],
                          fontWeight: 800,
                          fontSize: 14,
                          borderRadius: 8,
                          padding: '3px 10px',
                        }}>
                          {data.composite.label}
                        </span>
                        <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{data.composite.confidence}% confiance</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══ Tab: Patterns ══ */}
                {tab === 'patterns' && (
                  <div>
                    {/* Pattern prediction */}
                    {data.pattern.patternNext ? (
                      <div style={{
                        padding: '12px 14px',
                        background: `${ZONE_COLORS[data.pattern.patternNext]}12`,
                        border: `1px solid ${ZONE_COLORS[data.pattern.patternNext]}40`,
                        borderRadius: 10,
                        marginBottom: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: 11 }}>Pattern détecté → prochain prédit</div>
                          <div style={{ color: ZONE_COLORS[data.pattern.patternNext], fontWeight: 800, fontSize: 18, marginTop: 2 }}>
                            {data.pattern.patternNextLabel}
                          </div>
                        </div>
                        <div style={{
                          background: 'rgba(0,0,0,.3)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          textAlign: 'center',
                        }}>
                          <div style={{ color: '#475569', fontSize: 10 }}>Confiance</div>
                          <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 18 }}>{data.pattern.patternConf}%</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,.04)',
                        borderRadius: 10,
                        marginBottom: 14,
                        color: '#475569',
                        fontSize: 13,
                        textAlign: 'center',
                      }}>
                        Aucun pattern N-gramme trouvé pour la séquence actuelle
                      </div>
                    )}

                    {/* Top 3-grams */}
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Séquences (3 tours) les plus fréquentes
                    </div>
                    {data.pattern.topPatterns.map((p, i) => (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        background: 'rgba(255,255,255,.03)',
                        border: '1px solid rgba(255,255,255,.06)',
                        borderRadius: 9,
                        marginBottom: 6,
                      }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                            {p.zones.map((z, zi) => (
                              <span key={zi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ZoneBadge zone={z} small />
                                {zi < p.zones.length - 1 && <span style={{ color: '#334155', fontSize: 14 }}>→</span>}
                              </span>
                            ))}
                          </div>
                          <div style={{ color: '#475569', fontSize: 11 }}>{p.sequence}</div>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{p.count}×</div>
                        <div style={{
                          background: 'rgba(99,102,241,.15)',
                          border: '1px solid rgba(99,102,241,.3)',
                          color: '#a5b4fc',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 12,
                          fontWeight: 700,
                        }}>
                          {p.pct}%
                        </div>
                      </div>
                    ))}

                    {/* Deep 4-grams */}
                    {data.pattern.deepPatterns.length > 0 && (
                      <>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14, marginBottom: 8 }}>
                          Séquences profondes (4 tours)
                        </div>
                        {data.pattern.deepPatterns.map((p, i) => (
                          <div key={i} style={{
                            padding: '8px 12px',
                            background: 'rgba(139,92,246,.06)',
                            border: '1px solid rgba(139,92,246,.15)',
                            borderRadius: 8,
                            marginBottom: 5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <div style={{ color: '#94a3b8', fontSize: 12 }}>{p.sequence}</div>
                            <div style={{ color: '#7c3aed', fontWeight: 700, fontSize: 12 }}>{p.count}×</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ══ Tab: Momentum ══ */}
                {tab === 'momentum' && (
                  <div>
                    {/* Trend badge */}
                    <div style={{
                      display: 'flex',
                      gap: 10,
                      marginBottom: 16,
                    }}>
                      <div style={{
                        flex: 1,
                        padding: '14px',
                        background: data.momentum.trend === 'bullish'
                          ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                        border: `1px solid ${data.momentum.trend === 'bullish' ? '#22c55e50' : '#ef444450'}`,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>
                          {data.momentum.trend === 'bullish' ? '📈' : '📉'}
                        </div>
                        <div style={{
                          color: data.momentum.trend === 'bullish' ? '#4ade80' : '#f87171',
                          fontWeight: 800,
                          fontSize: 18,
                        }}>
                          {data.momentum.trend === 'bullish' ? 'HAUSSIER' : 'BAISSIER'}
                        </div>
                        <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                          Force : {data.momentum.strength}%
                        </div>
                      </div>

                      <div style={{
                        flex: 1,
                        padding: '14px',
                        background: data.streak.type === 'high' ? 'rgba(168,85,247,.1)' : 'rgba(239,68,68,.08)',
                        border: `1px solid ${data.streak.type === 'high' ? '#a855f740' : '#ef444430'}`,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>
                          {data.streak.type === 'high' ? '🔥' : '❄️'}
                        </div>
                        <div style={{
                          color: data.streak.type === 'high' ? '#c084fc' : '#f87171',
                          fontWeight: 800,
                          fontSize: 18,
                        }}>
                          {data.streak.count} consécutifs
                        </div>
                        <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                          Série {data.streak.type === 'high' ? 'hauts' : 'bas'}
                        </div>
                      </div>
                    </div>

                    {/* EMAs */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        Moyennes Mobiles Exponentielles
                      </div>
                      {[
                        { label: 'EMA 5 (court terme)', value: data.momentum.ema5, color: '#fbbf24' },
                        { label: 'EMA 20 (long terme)',  value: data.momentum.ema20, color: '#60a5fa' },
                      ].map(e => (
                        <div key={e.label} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '9px 12px',
                          background: 'rgba(255,255,255,.04)',
                          borderRadius: 8,
                          marginBottom: 6,
                        }}>
                          <span style={{ color: '#94a3b8', fontSize: 13 }}>{e.label}</span>
                          <span style={{ color: e.color, fontWeight: 800, fontSize: 16 }}>{e.value}x</span>
                        </div>
                      ))}
                      <div style={{
                        padding: '9px 12px',
                        background: 'rgba(255,255,255,.04)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>Pente (10 derniers tours)</span>
                        <span style={{
                          color: data.momentum.slope >= 0 ? '#4ade80' : '#f87171',
                          fontWeight: 800,
                          fontSize: 16,
                        }}>
                          {data.momentum.slope >= 0 ? '+' : ''}{data.momentum.slope}
                        </span>
                      </div>
                    </div>

                    {/* Anomalies */}
                    <div style={{
                      padding: '12px 14px',
                      background: data.anomalies.detected ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.08)',
                      border: `1px solid ${data.anomalies.detected ? '#ef444440' : '#22c55e30'}`,
                      borderRadius: 10,
                    }}>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        Détection d'anomalies (σ {'>'} 2)
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Moyenne historique</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.mean}x</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>Écart-type (σ)</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.stdDev}x</span>
                      </div>
                      {data.anomalies.detected ? (
                        <div style={{ color: '#f87171', fontWeight: 700, fontSize: 13 }}>
                          ⚠️ Multiplicateurs anormaux détectés : {data.anomalies.values.join(', ')}x
                        </div>
                      ) : (
                        <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                          ✅ Aucune anomalie — distribution normale
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ══ Tab: Zones ══ */}
                {tab === 'zones' && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                      Fréquence des zones sur les 20 derniers tours
                    </div>

                    {/* Heatmap grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                      {ZONES.map(z => {
                        const pct = data.zoneFreq[z] ?? 0;
                        return (
                          <div key={z} style={{
                            background: `${ZONE_COLORS[z]}${Math.round(pct * 2.55).toString(16).padStart(2, '0')}`,
                            border: `1.5px solid ${ZONE_COLORS[z]}50`,
                            borderRadius: 10,
                            padding: '12px 8px',
                            textAlign: 'center',
                          }}>
                            <ZoneBadge zone={z} />
                            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4, marginBottom: 2 }}>{ZONE_LABELS[z]}</div>
                            <div style={{ color: ZONE_COLORS[z], fontWeight: 800, fontSize: 22 }}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Distribution bar */}
                    <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Distribution visuelle
                    </div>
                    <div style={{ display: 'flex', height: 40, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                      {ZONES.map(z => {
                        const pct = data.zoneFreq[z] ?? 0;
                        if (pct === 0) return null;
                        return (
                          <div key={z} style={{
                            flex: pct,
                            background: ZONE_COLORS[z],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: pct > 8 ? 'auto' : 0,
                            overflow: 'hidden',
                            transition: 'flex .5s ease',
                          }}>
                            {pct > 8 && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,0,0,.7)' }}>{pct}%</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Zone legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {ZONES.map(z => (
                        <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: ZONE_COLORS[z] }} />
                          {ZONE_LABELS[z]}
                        </div>
                      ))}
                    </div>

                    {/* Interpretation */}
                    <div style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      background: 'rgba(99,102,241,.08)',
                      border: '1px solid rgba(99,102,241,.2)',
                      borderRadius: 10,
                    }}>
                      <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        Interprétation IA
                      </div>
                      {(() => {
                        const lowFreq  = (data.zoneFreq['A'] ?? 0) + (data.zoneFreq['B'] ?? 0);
                        const highFreq = (data.zoneFreq['D'] ?? 0) + (data.zoneFreq['E'] ?? 0) + (data.zoneFreq['F'] ?? 0);
                        const tips = [];
                        if (lowFreq >= 50) tips.push('🔴 Forte accumulation de cotes < 2x (signal de rebond imminent)');
                        if (highFreq >= 40) tips.push('🔥 Cycle chaud — nombreux hits > 5x récents');
                        if ((data.zoneFreq['A'] ?? 0) >= 25) tips.push('⚡ Nombreux 1.00x — précurseur fort d\'un grand hit');
                        if (tips.length === 0) tips.push('⚪ Distribution équilibrée — pas de signal dominant');
                        return tips.map((t, i) => (
                          <div key={i} style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>{t}</div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

              </div>
            </>
          )}

          {data?.error && (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              ⏳ {data.error}
            </div>
          )}
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

function ZoneBadge({ zone, small }: { zone: string; small?: boolean }) {
  return (
    <div style={{
      width:  small ? 22 : 32,
      height: small ? 22 : 32,
      borderRadius: small ? 5 : 8,
      background: `${ZONE_COLORS[zone]}25`,
      border: `1.5px solid ${ZONE_COLORS[zone]}70`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: ZONE_COLORS[zone],
      fontWeight: 800,
      fontSize: small ? 11 : 14,
      flexShrink: 0,
    }}>
      {zone}
    </div>
  );
}

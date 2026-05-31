import { useState, useEffect, useRef } from 'react';

const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZONE_COLORS: Record<string, string> = {
  A: '#ef4444', B: '#f97316', C: '#6b7aff',
  D: '#4ade80', E: '#a855f7', F: '#fbbf24',
};
const ZONE_LABELS: Record<string, string> = {
  A: '< 1.5x', B: '1.5–2x', C: '2–5x',
  D: '5–10x', E: '10–50x', F: '> 50x',
};

interface EntryPlan {
  target: string;
  targetLabel: string;
  urgency: string;
  windowFrom: string;
  windowTo: string;
  windowFromTs: number;
  windowToTs: number;
  windowOpen: boolean;
  msToWindowOpen: number;
  msToWindowClose: number;
  hitExpectedAt: string;
  hitExpectedTs: number;
  confidence: number;
  zone: string;
  zoneLabel: string;
}

interface TimingData {
  avgRoundSec: number;
  nextRoundIn: number;
  nextRoundAt: string;
  avg5xMin: number; avg10xMin: number; avg50xMin: number;
  msSince5x: string; msSince10x: string; msSince50x: string;
  msUntil5x: number; msUntil10x: number; msUntil50x: number;
  next5xAt: string; next10xAt: string; next50xAt: string;
  last5x:  { mult: number; at: string } | null;
  last10x: { mult: number; at: string } | null;
  last50x: { mult: number; at: string } | null;
}

interface MarkovData {
  current: string; currentLabel: string;
  transitions: Record<string, number>;
  bestNext: { zone: string; label: string; pct: number };
}

interface PatternData {
  patternNext: string | null;
  patternNextLabel: string | null;
  patternConf: number;
  patternCount: number;
  topPatterns: Array<{ sequence: string; zones: string[]; count: number; pct: number }>;
  deepPatterns: Array<{ sequence: string; count: number }>;
}

interface AIData {
  entry: EntryPlan;
  timing: TimingData;
  markov: MarkovData;
  pattern: PatternData;
  momentum: { ema5: number; ema20: number; trend: string; strength: number };
  streak: { type: string; count: number };
  zoneFreq: Record<string, number>;
  anomalies: { mean: number; stdDev: number; detected: boolean; values: number[] };
  composite: { zone: string; label: string; confidence: number; votes: Record<string, number> };
  basedOn: number;
  generatedAt: string;
  error?: string;
}

function fmtMs(ms: number): string {
  const abs = Math.abs(ms);
  const totalSec = Math.ceil(abs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const sign = ms < 0 ? '-' : '';
  return m > 0
    ? `${sign}${m}m${String(s).padStart(2, '0')}s`
    : `${sign}${s}s`;
}

function fmtSec(sec: number): string {
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

const URGENCY_COLOR: Record<string, string> = {
  'IMMINENT':   '#ff2d55',
  'EN RETARD':  '#ff8c00',
  'BIENTÔT':    '#fbbf24',
  'EN ATTENTE': '#60a5fa',
};

export default function AIPanel() {
  const [data, setData]     = useState<AIData | null>(null);
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<'entry' | 'timing' | 'markov' | 'patterns'>('entry');
  const [now, setNow]       = useState(Date.now());
  const fetchedAt           = useRef(0);
  const [serverEntry, setServerEntry] = useState<EntryPlan | null>(null);

  async function fetchAI() {
    try {
      const r  = await fetch('/api/ai-analysis');
      const d: AIData = await r.json();
      if (d && !d.error && d.entry && d.composite) {
        setData(d);
        setServerEntry(d.entry);
        fetchedAt.current = Date.now();
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchAI();
    const id = setInterval(fetchAI, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchAI();
  }, [open]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (!serverEntry || !data) {
    return (
      <button
        onClick={() => { setOpen(true); fetchAI(); }}
        style={btnStyle(false)}
      >
        <span style={{ fontSize: 20 }}>🤖</span>
        <div style={{ textAlign: 'left' }}>
          <div>Intelligence Artificielle</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: '#6366f1', marginTop: 1 }}>
            Analyse temporelle · Patterns · Markov
          </div>
        </div>
        <span style={{ color: '#6366f1', fontSize: 18 }}>▼</span>
      </button>
    );
  }

  // Live countdown using client clock + server data
  const elapsed       = now - fetchedAt.current;
  const liveToOpen    = (serverEntry.msToWindowOpen  - elapsed);
  const liveToClose   = (serverEntry.msToWindowClose - elapsed);
  const liveWindowOpen = liveToOpen <= 0 && liveToClose > 0;
  const urgency       = serverEntry.urgency;
  const urgColor      = URGENCY_COLOR[urgency] ?? '#60a5fa';
  const zoneColor     = ZONE_COLORS[serverEntry.zone] ?? '#6366f1';

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Compact always-visible summary ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: liveWindowOpen
            ? 'linear-gradient(135deg,rgba(255,45,85,.18),rgba(255,140,0,.12))'
            : 'linear-gradient(135deg,rgba(49,46,129,.5),rgba(49,46,129,.2))',
          border: `2px solid ${liveWindowOpen ? urgColor : '#312e81'}`,
          borderRadius: 14,
          padding: '14px 16px',
          cursor: 'pointer',
          transition: 'all .2s',
          marginBottom: open ? 10 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>
                INTELLIGENCE ARTIFICIELLE
              </span>
              <span style={{
                background: `${urgColor}25`,
                border: `1px solid ${urgColor}60`,
                color: urgColor,
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 6,
                padding: '1px 7px',
                letterSpacing: '0.05em',
                animation: liveWindowOpen ? 'pulse 1.2s infinite' : 'none',
              }}>
                {urgency}
              </span>
            </div>

            {/* Main entry window */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Fenêtre d'entrée IA
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                  {serverEntry.windowFrom}
                  <span style={{ color: '#334155', fontWeight: 400, fontSize: 14, margin: '0 6px' }}>→</span>
                  {serverEntry.windowTo}
                </div>
              </div>

              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {liveWindowOpen ? 'Se ferme dans' : liveToOpen > 0 ? 'Ouvre dans' : 'En retard de'}
                </div>
                <div style={{
                  color: liveWindowOpen ? '#ff2d55' : urgColor,
                  fontWeight: 800,
                  fontSize: 20,
                  fontVariantNumeric: 'tabular-nums',
                  animation: liveWindowOpen ? 'pulse 1.2s infinite' : 'none',
                }}>
                  {liveWindowOpen ? fmtMs(liveToClose) : fmtMs(Math.abs(liveToOpen))}
                </div>
              </div>
            </div>

            {/* Target + confidence bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{
                background: `${zoneColor}20`,
                border: `1px solid ${zoneColor}50`,
                color: zoneColor,
                fontSize: 13,
                fontWeight: 800,
                borderRadius: 7,
                padding: '3px 10px',
              }}>
                {serverEntry.target}
              </span>
              <span style={{ color: '#475569', fontSize: 11 }}>attendu vers</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>
                {serverEntry.hitExpectedAt}
              </span>
              <span style={{
                marginLeft: 'auto',
                color: '#a5b4fc',
                fontSize: 12,
                fontWeight: 700,
              }}>
                {serverEntry.confidence}% conf.
              </span>
            </div>
          </div>

          <span style={{ color: '#334155', fontSize: 16 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {open && (
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(99,102,241,.3)',
          background: 'rgba(8,10,24,.9)',
          overflow: 'hidden',
          animation: 'fadeInUp .2s ease',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,.3)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {([
              { id: 'entry',    label: '🎯 Entrée' },
              { id: 'timing',   label: '⏱ Timing' },
              { id: 'markov',   label: '⛓ Markov' },
              { id: 'patterns', label: '🔁 Patterns' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '10px 4px',
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                color: tab === t.id ? '#a5b4fc' : '#475569',
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 11, cursor: 'pointer', transition: 'all .15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 16 }}>

            {/* ══ TAB: ENTRY PLAN ══ */}
            {tab === 'entry' && (
              <div>
                {/* Window status */}
                <div style={{
                  padding: '14px 16px',
                  background: liveWindowOpen
                    ? 'rgba(255,45,85,.12)' : 'rgba(99,102,241,.1)',
                  border: `1px solid ${liveWindowOpen ? '#ff2d5560' : '#6366f140'}`,
                  borderRadius: 12,
                  marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                        {serverEntry.targetLabel}
                      </div>
                      <div style={{ color: liveWindowOpen ? '#ff2d55' : urgColor, fontWeight: 800, fontSize: 22 }}>
                        {liveWindowOpen ? '🟢 FENÊTRE OUVERTE — ENTREZ MAINTENANT' : `⏳ ${fmtMs(Math.abs(liveToOpen))} avant l'entrée`}
                      </div>
                    </div>
                    <div style={{
                      background: `${zoneColor}20`,
                      border: `1px solid ${zoneColor}50`,
                      borderRadius: 10,
                      padding: '8px 14px',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: '#475569', fontSize: 10 }}>Cible IA</div>
                      <div style={{ color: zoneColor, fontWeight: 800, fontSize: 20 }}>{serverEntry.target}</div>
                      <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{serverEntry.confidence}%</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <InfoBox label="Début d'entrée" value={serverEntry.windowFrom} color="#4ade80" />
                    <InfoBox label="Hit attendu"    value={serverEntry.hitExpectedAt} color={urgColor} />
                    <InfoBox label="Fin fenêtre"    value={serverEntry.windowTo} color="#f87171" />
                  </div>
                </div>

                {/* Zone prediction breakdown */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Score IA par zone (Markov + Patterns + Timing)
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {ZONES.map(z => {
                      const v = data.composite.votes[z] ?? 0;
                      const total = Object.values(data.composite.votes).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                      const isTop = z === data.composite.zone;
                      return (
                        <div key={z} style={{
                          flex: 1,
                          background: isTop ? `${ZONE_COLORS[z]}25` : 'rgba(255,255,255,.03)',
                          border: `1px solid ${isTop ? ZONE_COLORS[z] + '70' : 'rgba(255,255,255,.07)'}`,
                          borderRadius: 8, padding: '7px 4px', textAlign: 'center',
                        }}>
                          <div style={{ color: '#475569', fontSize: 9, marginBottom: 2 }}>{ZONE_LABELS[z]}</div>
                          <div style={{ color: ZONE_COLORS[z], fontWeight: 800, fontSize: 14 }}>{pct}%</div>
                          {isTop && <div style={{ color: ZONE_COLORS[z], fontSize: 9, marginTop: 1 }}>▲</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Signals that went into the prediction */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SignalRow
                    label="Chaîne de Markov"
                    value={`Depuis ${data.markov.currentLabel} → ${data.markov.bestNext.label}`}
                    detail={`${data.markov.bestNext.pct}% probabilité`}
                    color="#a5b4fc"
                  />
                  {data.pattern.patternNext && (
                    <SignalRow
                      label="Pattern N-gramme"
                      value={`→ ${data.pattern.patternNextLabel}`}
                      detail={`Observé ${data.pattern.patternCount}× (${data.pattern.patternConf}% conf.)`}
                      color="#c084fc"
                    />
                  )}
                  <SignalRow
                    label="Momentum EMA"
                    value={data.momentum.trend === 'bullish' ? '📈 Haussier' : '📉 Baissier'}
                    detail={`EMA5=${data.momentum.ema5}x / EMA20=${data.momentum.ema20}x`}
                    color={data.momentum.trend === 'bullish' ? '#4ade80' : '#f87171'}
                  />
                  <SignalRow
                    label="Série en cours"
                    value={`${data.streak.count} tours ${data.streak.type === 'low' ? 'bas' : 'hauts'} consécutifs`}
                    detail={data.streak.type === 'low' && data.streak.count >= 3 ? '⚡ Signal de rebond fort' : ''}
                    color={data.streak.type === 'low' ? '#f97316' : '#4ade80'}
                  />
                  {data.timing.msUntil10x < 0 && (
                    <SignalRow
                      label="Timing 10x"
                      value={`En retard de ${fmtSec(Math.abs(data.timing.msUntil10x))}`}
                      detail="Boost appliqué — hit potentiel imminent"
                      color="#ff2d55"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ══ TAB: TIMING ══ */}
            {tab === 'timing' && (
              <div>
                {/* Next round */}
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(99,102,241,.08)',
                  border: '1px solid rgba(99,102,241,.2)',
                  borderRadius: 10,
                  marginBottom: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Prochain tour estimé</div>
                    <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 16 }}>{data.timing.nextRoundAt}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Durée moyenne d'un tour</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{data.timing.avgRoundSec}s</div>
                  </div>
                </div>

                {/* Big hit timing table */}
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Intervalles moyens entre grands hits (données réelles)
                </div>
                {[
                  { label: '≥ 5x',  avg: data.timing.avg5xMin,  since: data.timing.msSince5x,  until: data.timing.msUntil5x,  at: data.timing.next5xAt,  last: data.timing.last5x,  color: '#4ade80' },
                  { label: '≥ 10x', avg: data.timing.avg10xMin, since: data.timing.msSince10x, until: data.timing.msUntil10x, at: data.timing.next10xAt, last: data.timing.last10x, color: '#a855f7' },
                  { label: '≥ 50x', avg: data.timing.avg50xMin, since: data.timing.msSince50x, until: data.timing.msUntil50x, at: data.timing.next50xAt, last: data.timing.last50x, color: '#fbbf24' },
                ].map(row => {
                  const overdue = row.until < 0;
                  const urgentColor = overdue ? '#ff2d55' : row.color;
                  return (
                    <div key={row.label} style={{
                      background: overdue ? 'rgba(255,45,85,.08)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${overdue ? '#ff2d5530' : 'rgba(255,255,255,.07)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: row.color, fontWeight: 800, fontSize: 16 }}>{row.label}</span>
                        <span style={{
                          background: `${urgentColor}20`,
                          border: `1px solid ${urgentColor}50`,
                          color: urgentColor,
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          padding: '2px 8px',
                        }}>
                          {overdue ? `⚠️ EN RETARD ${fmtSec(Math.abs(row.until))}` : `Dans ${fmtSec(row.until)}`}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                        <MiniCell label="Intervalle moy." value={`${row.avg} min`} color={row.color} />
                        <MiniCell label="Depuis dernier"  value={row.since} color="#94a3b8" />
                        <MiniCell label="Prochain estimé" value={row.at} color={urgentColor} />
                        <MiniCell label="Dernier hit"     value={row.last ? `${row.last.mult}x (${row.last.at})` : '—'} color="#64748b" />
                      </div>
                    </div>
                  );
                })}

                {/* Zone frequency */}
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>
                  Distribution zones (20 derniers tours)
                </div>
                <div style={{ display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                  {ZONES.map(z => {
                    const pct = data.zoneFreq[z] ?? 0;
                    if (pct === 0) return null;
                    return (
                      <div key={z} style={{
                        flex: pct, background: ZONE_COLORS[z],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: pct > 10 ? 'auto' : 0, overflow: 'hidden', transition: 'flex .5s ease',
                      }}>
                        {pct > 10 && <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,0,0,.7)' }}>{pct}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {ZONES.map(z => (
                    <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: ZONE_COLORS[z] }} />
                      {ZONE_LABELS[z]} ({data.zoneFreq[z] ?? 0}%)
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ TAB: MARKOV ══ */}
            {tab === 'markov' && (
              <div>
                <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Depuis la zone actuelle ({data.markov.currentLabel}), probabilité de chaque zone suivante
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {ZONES.map(z => {
                    const pct = data.markov.transitions[z] ?? 0;
                    return (
                      <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: `${ZONE_COLORS[z]}20`,
                          border: `1.5px solid ${ZONE_COLORS[z]}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: ZONE_COLORS[z], fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}>{z}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 10, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: ZONE_COLORS[z], borderRadius: 5, transition: 'width .5s ease',
                            }} />
                          </div>
                        </div>
                        <div style={{ color: ZONE_COLORS[z], fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'right' }}>{pct}%</div>
                        <div style={{ color: '#334155', fontSize: 11, minWidth: 50 }}>{ZONE_LABELS[z]}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: `${ZONE_COLORS[data.markov.bestNext.zone]}12`,
                  border: `1px solid ${ZONE_COLORS[data.markov.bestNext.zone]}35`,
                  borderRadius: 10,
                }}>
                  <span style={{ color: '#64748b', fontSize: 12 }}>Markov prédit : </span>
                  <span style={{ color: ZONE_COLORS[data.markov.bestNext.zone], fontWeight: 800, fontSize: 15 }}>
                    {data.markov.bestNext.label}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 12 }}> ({data.markov.bestNext.pct}%)</span>
                </div>

                {/* Anomalies */}
                <div style={{
                  marginTop: 10, padding: '10px 14px',
                  background: data.anomalies.detected ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.06)',
                  border: `1px solid ${data.anomalies.detected ? '#ef444430' : '#22c55e25'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Moyenne</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.mean}x</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Écart-type σ</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.stdDev}x</span>
                  </div>
                  {data.anomalies.detected
                    ? <div style={{ color: '#f87171', fontWeight: 700, fontSize: 12 }}>⚠️ Anomalies détectées : {data.anomalies.values.join(', ')}x</div>
                    : <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 12 }}>✅ Distribution normale — pas d'anomalie</div>
                  }
                </div>
              </div>
            )}

            {/* ══ TAB: PATTERNS ══ */}
            {tab === 'patterns' && (
              <div>
                {data.pattern.patternNext ? (
                  <div style={{
                    padding: '12px 14px',
                    background: `${ZONE_COLORS[data.pattern.patternNext]}10`,
                    border: `1px solid ${ZONE_COLORS[data.pattern.patternNext]}35`,
                    borderRadius: 10, marginBottom: 14,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>Pattern N-gramme → zone suivante</div>
                      <div style={{ color: ZONE_COLORS[data.pattern.patternNext], fontWeight: 800, fontSize: 20, marginTop: 2 }}>
                        {data.pattern.patternNextLabel}
                      </div>
                      <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                        Observé {data.pattern.patternCount} fois dans l'historique
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Confiance</div>
                      <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 22 }}>{data.pattern.patternConf}%</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, marginBottom: 14, color: '#475569', fontSize: 13, textAlign: 'center' }}>
                    Aucun pattern trouvé pour la séquence actuelle
                  </div>
                )}

                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Séquences 3 tours les plus fréquentes
                </div>
                {data.pattern.topPatterns.map((p, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    gap: 10, padding: '9px 12px',
                    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                    borderRadius: 9, marginBottom: 6, alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
                        {p.zones.map((z, zi) => (
                          <span key={zi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: 5,
                              background: `${ZONE_COLORS[z]}20`, border: `1px solid ${ZONE_COLORS[z]}60`,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: ZONE_COLORS[z], fontWeight: 800, fontSize: 10,
                            }}>{z}</span>
                            {zi < p.zones.length - 1 && <span style={{ color: '#334155', fontSize: 12 }}>→</span>}
                          </span>
                        ))}
                      </div>
                      <div style={{ color: '#475569', fontSize: 11 }}>{p.sequence}</div>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{p.count}×</div>
                    <div style={{
                      background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)',
                      color: '#a5b4fc', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700,
                    }}>{p.pct}%</div>
                  </div>
                ))}

                {data.pattern.deepPatterns.length > 0 && (
                  <>
                    <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 8 }}>
                      Séquences profondes (4 tours)
                    </div>
                    {data.pattern.deepPatterns.map((p, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.15)',
                        borderRadius: 8, marginBottom: 5,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{p.sequence}</div>
                        <div style={{ color: '#7c3aed', fontWeight: 700, fontSize: 12 }}>{p.count}×</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(255,255,255,.05)',
            display: 'flex', justifyContent: 'space-between',
            color: '#334155', fontSize: 11,
          }}>
            <span>🤖 IA · {data.basedOn} tours analysés</span>
            <span>Mis à jour à {data.generatedAt} · refresh 6s</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}

function btnStyle(active: boolean) {
  return {
    width: '100%', padding: '14px 20px', borderRadius: 12,
    border: `2px solid ${active ? '#818cf8' : '#312e81'}`,
    background: active
      ? 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.12))'
      : 'linear-gradient(135deg,rgba(49,46,129,.4),rgba(49,46,129,.15))',
    color: active ? '#c7d2fe' : '#6366f1',
    fontWeight: 800, fontSize: 15, letterSpacing: '0.05em',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 10, transition: 'all .2s',
  } as React.CSSProperties;
}

function InfoBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function MiniCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: 12 }}>{value}</div>
    </div>
  );
}

function SignalRow({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '110px 1fr auto',
      gap: 8, alignItems: 'center',
      padding: '8px 10px',
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 8,
    }}>
      <span style={{ color: '#475569', fontSize: 11 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontSize: 13 }}>{value}</span>
      {detail && <span style={{ color: '#475569', fontSize: 10, textAlign: 'right' }}>{detail}</span>}
    </div>
  );
}

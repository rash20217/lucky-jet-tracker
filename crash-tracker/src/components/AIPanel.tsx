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
const SIGNAL_COLORS: Record<string, string> = {
  'REBOND FORT': '#ff2d55',
  'REBOND':      '#f97316',
  'PRUDENCE':    '#fbbf24',
  'EN ATTENTE':  '#60a5fa',
};

interface AIData {
  entry: {
    target: string; targetLabel: string; urgency: string;
    windowFrom: string; windowTo: string;
    windowFromTs: number; windowToTs: number; windowOpen: boolean;
    msToWindowOpen: number; msToWindowClose: number;
    hitExpectedAt: string; hitExpectedTs: number;
    confidence: number; zone: string; zoneLabel: string;
  };
  timing: {
    avgRoundSec: number; nextRoundIn: number; nextRoundAt: string;
    avg5xMin: number; avg10xMin: number; avg50xMin: number;
    msSince5x: string; msSince10x: string; msSince50x: string;
    msUntil5x: number; msUntil10x: number; msUntil50x: number;
    next5xAt: string; next10xAt: string; next50xAt: string;
    last5x: { mult: number; at: string } | null;
    last10x: { mult: number; at: string } | null;
    last50x: { mult: number; at: string } | null;
  };
  markov: {
    current: string; currentLabel: string;
    transitions: Record<string, number>;
    bestNext: { zone: string; label: string; pct: number };
  };
  pattern: {
    patternNext: string | null; patternNextLabel: string | null;
    patternConf: number; patternCount: number;
    topPatterns: Array<{ sequence: string; zones: string[]; count: number; pct: number }>;
    deepPatterns: Array<{ sequence: string; count: number }>;
  };
  momentum: { ema5: number; ema20: number; trend: string; strength: number };
  streak: { type: string; count: number };
  zoneFreq: Record<string, number>;
  anomalies: { mean: number; stdDev: number; detected: boolean; values: number[] };
  composite: { zone: string; label: string; confidence: number; votes: Record<string, number> };
  series: {
    currentRun: { type: string; count: number; avg: number; trend: string; values: number[] };
    breakStats: {
      dataPoints: number; avgBreakValue: number;
      expectedBreakZone: string; expectedBreakLabel: string;
      breakProb: number; pct5x: number; pct10x: number;
      samples: number[];
    } | null;
    horizons: Record<string, { prob2x: number; prob5x: number; prob10x: number }>;
    condHorizons: Record<string, { prob2x: number; prob5x: number; prob10x: number }> | null;
    drySpell: Record<string, { rounds: number; avgInterval: number; percentile: number; status: string }>;
    cycles: {
      c2x:  { avg: number; min: number; max: number; roundsSince: number; due: boolean } | null;
      c5x:  { avg: number; min: number; max: number; roundsSince: number; due: boolean } | null;
      c10x: { avg: number; min: number; max: number; roundsSince: number; due: boolean } | null;
    };
    windows: Record<string, { avg: number; hi: number; lo: number; pctLow: number; pct2x: number; pct5x: number; size: number } | null>;
    signal: string; signalConf: number;
  };
  basedOn: number; generatedAt: string; error?: string;
}

function fmtMs(ms: number): string {
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60000);
  const s = Math.ceil((abs % 60000) / 1000);
  const sign = ms < 0 ? '-' : '';
  return m > 0 ? `${sign}${m}m${String(s).padStart(2, '0')}s` : `${sign}${s}s`;
}
function fmtSec(sec: number): string {
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

const URGENCY_COLOR: Record<string, string> = {
  'IMMINENT': '#ff2d55', 'EN RETARD': '#ff8c00', 'BIENTÔT': '#fbbf24', 'EN ATTENTE': '#60a5fa',
};

export default function AIPanel() {
  const [data, setData]               = useState<AIData | null>(null);
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState<'entry' | 'series' | 'timing' | 'markov'>('entry');
  const [now, setNow]                 = useState(Date.now());
  const fetchedAt                     = useRef(0);
  const [serverEntry, setServerEntry] = useState<AIData['entry'] | null>(null);

  async function fetchAI() {
    try {
      const r = await fetch('/api/ai-analysis');
      const d: AIData = await r.json();
      if (d && !d.error && d.entry && d.composite && d.series) {
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
      <div style={{
        background: 'linear-gradient(135deg,rgba(49,46,129,.4),rgba(49,46,129,.15))',
        border: '2px solid #312e81', borderRadius: 14, padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em' }}>INTELLIGENCE ARTIFICIELLE</div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Chargement de l'analyse…</div>
          </div>
        </div>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid #6366f1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const elapsed        = now - fetchedAt.current;
  const liveToOpen     = serverEntry.msToWindowOpen  - elapsed;
  const liveToClose    = serverEntry.msToWindowClose - elapsed;
  const liveWindowOpen = liveToOpen <= 0 && liveToClose > 0;
  const urgColor       = URGENCY_COLOR[serverEntry.urgency] ?? '#60a5fa';
  const zoneColor      = ZONE_COLORS[serverEntry.zone] ?? '#6366f1';

  const sig      = data.series.signal;
  const sigColor = SIGNAL_COLORS[sig] ?? '#60a5fa';

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Always-visible summary bar ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: liveWindowOpen
            ? 'linear-gradient(135deg,rgba(255,45,85,.18),rgba(255,140,0,.12))'
            : sig === 'REBOND FORT'
            ? 'linear-gradient(135deg,rgba(255,45,85,.14),rgba(255,100,0,.08))'
            : 'linear-gradient(135deg,rgba(49,46,129,.5),rgba(49,46,129,.2))',
          border: `2px solid ${liveWindowOpen ? urgColor : sig === 'REBOND FORT' ? '#ff2d5560' : '#312e81'}`,
          borderRadius: 14,
          padding: '14px 16px',
          cursor: 'pointer',
          marginBottom: open ? 10 : 0,
          transition: 'all .2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div style={{ flex: 1 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 12, letterSpacing: '0.06em' }}>
                INTELLIGENCE ARTIFICIELLE
              </span>
              <span style={{
                background: `${sigColor}22`, border: `1px solid ${sigColor}60`,
                color: sigColor, fontSize: 10, fontWeight: 800, borderRadius: 6,
                padding: '1px 7px', letterSpacing: '0.05em',
                animation: sig === 'REBOND FORT' ? 'pulse 1.2s infinite' : 'none',
              }}>
                {sig}
              </span>
              <span style={{
                background: `${urgColor}18`, border: `1px solid ${urgColor}50`,
                color: urgColor, fontSize: 10, fontWeight: 700, borderRadius: 6,
                padding: '1px 7px',
              }}>
                {serverEntry.urgency}
              </span>
            </div>
            {/* Entry window */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Fenêtre d'entrée IA
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                  {serverEntry.windowFrom}
                  <span style={{ color: '#334155', fontWeight: 400, fontSize: 13, margin: '0 6px' }}>→</span>
                  {serverEntry.windowTo}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ color: '#475569', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {liveWindowOpen ? 'Se ferme dans' : liveToOpen > 0 ? 'Ouvre dans' : 'En retard'}
                </div>
                <div style={{
                  color: liveWindowOpen ? '#ff2d55' : urgColor,
                  fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums',
                  animation: liveWindowOpen ? 'pulse 1.2s infinite' : 'none',
                }}>
                  {liveWindowOpen ? fmtMs(liveToClose) : fmtMs(Math.abs(liveToOpen))}
                </div>
              </div>
            </div>
            {/* Series signal + target */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
              <span style={{
                background: `${zoneColor}20`, border: `1px solid ${zoneColor}50`,
                color: zoneColor, fontSize: 13, fontWeight: 800, borderRadius: 7, padding: '2px 10px',
              }}>
                {serverEntry.target}
              </span>
              <span style={{ color: '#475569', fontSize: 11 }}>
                attendu vers <strong style={{ color: '#e2e8f0' }}>{serverEntry.hitExpectedAt}</strong>
              </span>
              {data.series.currentRun.type === 'low' && (
                <span style={{ color: sigColor, fontSize: 11, fontWeight: 700 }}>
                  · {data.series.currentRun.count} bas consécutifs
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: '#a5b4fc', fontSize: 12, fontWeight: 700 }}>
                {serverEntry.confidence}%
              </span>
            </div>
          </div>
          <span style={{ color: '#334155', fontSize: 14, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {open && (
        <div style={{
          borderRadius: 14, border: '1px solid rgba(99,102,241,.3)',
          background: 'rgba(8,10,24,.95)', overflow: 'hidden', animation: 'fadeInUp .2s ease',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,.35)', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {([
              { id: 'entry',  label: '🎯 Entrée' },
              { id: 'series', label: '📊 Séries' },
              { id: 'timing', label: '⏱ Timing' },
              { id: 'markov', label: '⛓ Markov' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                color: tab === t.id ? '#a5b4fc' : '#475569',
                fontWeight: tab === t.id ? 700 : 400, fontSize: 11, cursor: 'pointer', transition: 'all .15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 16 }}>

            {/* ══ TAB: ENTRÉE ══ */}
            {tab === 'entry' && (
              <div>
                {/* Entry window status */}
                <div style={{
                  padding: '12px 14px',
                  background: liveWindowOpen ? 'rgba(255,45,85,.12)' : 'rgba(99,102,241,.08)',
                  border: `1px solid ${liveWindowOpen ? '#ff2d5560' : '#6366f130'}`,
                  borderRadius: 12, marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                        {serverEntry.targetLabel}
                      </div>
                      <div style={{ color: liveWindowOpen ? '#ff2d55' : urgColor, fontWeight: 800, fontSize: 18 }}>
                        {liveWindowOpen ? '🟢 FENÊTRE OUVERTE — ENTREZ !' : `⏳ ${fmtMs(Math.abs(liveToOpen))} avant l'entrée`}
                      </div>
                    </div>
                    <div style={{
                      background: `${zoneColor}20`, border: `1px solid ${zoneColor}50`,
                      borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0,
                    }}>
                      <div style={{ color: '#475569', fontSize: 10 }}>Cible IA</div>
                      <div style={{ color: zoneColor, fontWeight: 800, fontSize: 20 }}>{serverEntry.target}</div>
                      <div style={{ color: '#475569', fontSize: 10, marginTop: 1 }}>{serverEntry.confidence}%</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <InfoBox label="Début" value={serverEntry.windowFrom} color="#4ade80" />
                    <InfoBox label="Hit estimé" value={serverEntry.hitExpectedAt} color={urgColor} />
                    <InfoBox label="Fin" value={serverEntry.windowTo} color="#f87171" />
                  </div>
                </div>

                {/* Zone votes */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Score IA par zone
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
                          <div style={{ color: ZONE_COLORS[z], fontWeight: 800, fontSize: 13 }}>{pct}%</div>
                          {isTop && <div style={{ color: ZONE_COLORS[z], fontSize: 9, marginTop: 1 }}>▲</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Signals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SignalRow label="Série en cours"
                    value={data.series.currentRun.type === 'low'
                      ? `🔴 ${data.series.currentRun.count} tours bas (< 2x)`
                      : `🟢 ${data.series.currentRun.count} tours hauts (≥ 2x)`}
                    detail={data.series.breakStats
                      ? `Rupture probable: ${data.series.breakStats.breakProb}% chance ≥ 2x`
                      : `Moy. série: ${data.series.currentRun.avg}x`}
                    color={data.series.currentRun.type === 'low' ? sigColor : '#4ade80'}
                  />
                  <SignalRow label="Signal séries"
                    value={data.series.signal}
                    detail={`${data.series.signalConf}% confiance`}
                    color={sigColor}
                  />
                  <SignalRow label="Markov"
                    value={`${data.markov.currentLabel} → ${data.markov.bestNext.label}`}
                    detail={`${data.markov.bestNext.pct}% probabilité`}
                    color="#a5b4fc"
                  />
                  {data.pattern.patternNext && (
                    <SignalRow label="Pattern"
                      value={`→ ${data.pattern.patternNextLabel}`}
                      detail={`${data.pattern.patternCount}× vu (${data.pattern.patternConf}% conf.)`}
                      color="#c084fc"
                    />
                  )}
                  <SignalRow label="Momentum EMA"
                    value={data.momentum.trend === 'bullish' ? '📈 Haussier' : '📉 Baissier'}
                    detail={`EMA5=${data.momentum.ema5}x EMA20=${data.momentum.ema20}x`}
                    color={data.momentum.trend === 'bullish' ? '#4ade80' : '#f87171'}
                  />
                  {data.series.drySpell.since10x.status !== 'normal' && (
                    <SignalRow label="Dry Spell ≥10x"
                      value={`${data.series.drySpell.since10x.rounds} tours sans 10x (${data.series.drySpell.since10x.percentile}%ile)`}
                      detail={`Statut: ${data.series.drySpell.since10x.status.toUpperCase()}`}
                      color={data.series.drySpell.since10x.status === 'critique' ? '#ff2d55' : '#f97316'}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ══ TAB: SÉRIES ══ */}
            {tab === 'series' && (
              <div>
                {/* Current run */}
                <div style={{
                  padding: '12px 14px',
                  background: data.series.currentRun.type === 'low'
                    ? `${sigColor}12` : 'rgba(74,222,128,.08)',
                  border: `1px solid ${data.series.currentRun.type === 'low' ? sigColor + '40' : '#4ade8040'}`,
                  borderRadius: 12, marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                        Série en cours
                      </div>
                      <div style={{ color: data.series.currentRun.type === 'low' ? sigColor : '#4ade80', fontWeight: 800, fontSize: 20 }}>
                        {data.series.currentRun.count} tours {data.series.currentRun.type === 'low' ? 'BAS' : 'HAUTS'} consécutifs
                      </div>
                      <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                        Moy. {data.series.currentRun.avg}x
                        {' · '}Tendance : {data.series.currentRun.trend === 'rising' ? '📈' : data.series.currentRun.trend === 'falling' ? '📉' : '➡️'} {data.series.currentRun.trend}
                      </div>
                    </div>
                    <div style={{
                      background: `${sigColor}20`, border: `1px solid ${sigColor}50`,
                      borderRadius: 10, padding: '8px 12px', textAlign: 'center',
                    }}>
                      <div style={{ color: '#64748b', fontSize: 10 }}>Signal</div>
                      <div style={{ color: sigColor, fontWeight: 800, fontSize: 13 }}>{sig}</div>
                      <div style={{ color: '#64748b', fontSize: 10, marginTop: 1 }}>{data.series.signalConf}%</div>
                    </div>
                  </div>
                  {/* Recent values in run */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {data.series.currentRun.values.map((v, i) => (
                      <span key={i} style={{
                        background: `${ZONE_COLORS[getZoneClient(v)]}18`,
                        border: `1px solid ${ZONE_COLORS[getZoneClient(v)]}40`,
                        color: ZONE_COLORS[getZoneClient(v)],
                        borderRadius: 7, padding: '3px 8px', fontSize: 12, fontWeight: 700,
                      }}>{v}x</span>
                    ))}
                  </div>
                </div>

                {/* Break stats */}
                {data.series.breakStats && data.series.currentRun.type === 'low' && (
                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(99,102,241,.08)',
                    border: '1px solid rgba(99,102,241,.25)',
                    borderRadius: 12, marginBottom: 14,
                  }}>
                    <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Rupture de série — historique ({data.series.breakStats.dataPoints} obs.)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <InfoBox label="Prob. ≥ 2x" value={`${data.series.breakStats.breakProb}%`} color="#6b7aff" />
                      <InfoBox label="Prob. ≥ 5x" value={`${data.series.breakStats.pct5x}%`} color="#4ade80" />
                      <InfoBox label="Prob. ≥ 10x" value={`${data.series.breakStats.pct10x}%`} color="#a855f7" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        Zone de rupture attendue :
                        <span style={{ color: ZONE_COLORS[data.series.breakStats.expectedBreakZone], fontWeight: 700, marginLeft: 6 }}>
                          {data.series.breakStats.expectedBreakLabel} (moy. {data.series.breakStats.avgBreakValue}x)
                        </span>
                      </div>
                    </div>
                    {data.series.breakStats.samples.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ color: '#334155', fontSize: 10, marginBottom: 5 }}>Valeurs historiques de rupture :</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {data.series.breakStats.samples.map((v, i) => (
                            <span key={i} style={{
                              background: `${ZONE_COLORS[getZoneClient(v)]}15`,
                              border: `1px solid ${ZONE_COLORS[getZoneClient(v)]}35`,
                              color: ZONE_COLORS[getZoneClient(v)],
                              borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                            }}>{v}x</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-horizon probabilities */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Probabilités multi-horizons
                    {data.series.condHorizons && (
                      <span style={{ color: '#f97316', fontWeight: 700, marginLeft: 6 }}>
                        (après série basse)
                      </span>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ color: '#475569', fontWeight: 600, padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.07)' }}>Horizon</th>
                          {(['≥ 2x', '≥ 5x', '≥ 10x'] as const).map(th => (
                            <th key={th} style={{ color: '#475569', fontWeight: 600, padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.07)' }}>{th}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(['next1', 'next2', 'next3', 'next5'] as const).map(k => {
                          const h = (data.series.condHorizons ?? data.series.horizons)[k];
                          return (
                            <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                              <td style={{ padding: '8px 8px', color: '#94a3b8', fontWeight: 600 }}>
                                {k === 'next1' ? 'Prochain tour' : k === 'next2' ? '2 prochains' : k === 'next3' ? '3 prochains' : '5 prochains'}
                              </td>
                              <ProbCell pct={h.prob2x} color="#6b7aff" />
                              <ProbCell pct={h.prob5x} color="#4ade80" />
                              <ProbCell pct={h.prob10x} color="#a855f7" />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dry spell meters */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Compteur de sécheresse (tours sans hit)
                  </div>
                  {[
                    { key: 'since2x',  label: '≥ 2x',  color: '#6b7aff' },
                    { key: 'since5x',  label: '≥ 5x',  color: '#4ade80' },
                    { key: 'since10x', label: '≥ 10x', color: '#a855f7' },
                  ].map(row => {
                    const ds = data.series.drySpell[row.key];
                    const pct = Math.min(ds.percentile, 100);
                    const barColor = pct >= 90 ? '#ff2d55' : pct >= 70 ? '#f97316' : pct >= 50 ? '#fbbf24' : row.color;
                    return (
                      <div key={row.key} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: row.color, fontWeight: 700, fontSize: 13 }}>{row.label}</span>
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>{ds.rounds} tours sans hit</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: `${barColor}20`, border: `1px solid ${barColor}50`,
                              color: barColor, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '1px 7px',
                            }}>{ds.status.toUpperCase()}</span>
                            <span style={{ color: barColor, fontWeight: 800, fontSize: 13 }}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`, borderRadius: 4,
                            background: barColor, transition: 'width .5s ease',
                            animation: pct >= 90 ? 'pulse 1.5s infinite' : 'none',
                          }} />
                        </div>
                        <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>
                          Intervalle moyen: {ds.avgInterval} tours
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cycle detection */}
                <div>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Cycles entre grands hits (en tours)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { key: 'c2x',  label: '≥ 2x',  color: '#6b7aff' },
                      { key: 'c5x',  label: '≥ 5x',  color: '#4ade80' },
                      { key: 'c10x', label: '≥ 10x', color: '#a855f7' },
                    ].map(row => {
                      const cy = data.series.cycles[row.key as 'c2x' | 'c5x' | 'c10x'];
                      if (!cy) return null;
                      return (
                        <div key={row.key} style={{
                          display: 'grid', gridTemplateColumns: '50px 1fr auto',
                          gap: 10, padding: '9px 12px',
                          background: cy.due ? 'rgba(255,45,85,.07)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${cy.due ? '#ff2d5530' : 'rgba(255,255,255,.06)'}`,
                          borderRadius: 9, alignItems: 'center',
                        }}>
                          <span style={{ color: row.color, fontWeight: 800, fontSize: 14 }}>{row.label}</span>
                          <div>
                            <span style={{ color: '#94a3b8', fontSize: 12 }}>
                              Toutes les ~<strong style={{ color: '#e2e8f0' }}>{cy.avg}</strong> tours
                              {' · '}Depuis <strong style={{ color: cy.due ? '#ff2d55' : '#e2e8f0' }}>{cy.roundsSince}</strong> tours
                            </span>
                          </div>
                          {cy.due && (
                            <span style={{
                              background: 'rgba(255,45,85,.15)', border: '1px solid #ff2d5550',
                              color: '#ff2d55', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '2px 7px',
                            }}>DÛ</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rolling windows */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Fenêtres glissantes
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { key: 'last5', label: '5 derniers' },
                      { key: 'last10', label: '10 derniers' },
                      { key: 'last20', label: '20 derniers' },
                    ].map(row => {
                      const w = data.series.windows[row.key];
                      if (!w) return null;
                      return (
                        <div key={row.key} style={{
                          background: 'rgba(255,255,255,.03)',
                          border: '1px solid rgba(255,255,255,.07)',
                          borderRadius: 10, padding: '10px 10px',
                        }}>
                          <div style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{row.label}</div>
                          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{w.avg}x</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <Pill label="Bas" value={`${w.pctLow}%`} color="#ef4444" />
                            <Pill label="2x+" value={`${w.pct2x}%`} color="#6b7aff" />
                            <Pill label="5x+" value={`${w.pct5x}%`} color="#4ade80" />
                          </div>
                          <div style={{ color: '#334155', fontSize: 10, marginTop: 6 }}>
                            Hi: <span style={{ color: '#4ade80' }}>{w.hi}x</span>
                            {' · '}Lo: <span style={{ color: '#ef4444' }}>{w.lo}x</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAB: TIMING ══ */}
            {tab === 'timing' && (
              <div>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)',
                  borderRadius: 10, marginBottom: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Prochain tour estimé</div>
                    <div style={{ color: '#a5b4fc', fontWeight: 800, fontSize: 16 }}>{data.timing.nextRoundAt}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: 11 }}>Durée moy. d'un tour</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{data.timing.avgRoundSec}s</div>
                  </div>
                </div>

                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Intervalles de temps entre grands hits (données réelles)
                </div>
                {[
                  { label: '≥ 5x',  avg: data.timing.avg5xMin,  since: data.timing.msSince5x,  until: data.timing.msUntil5x,  at: data.timing.next5xAt,  last: data.timing.last5x,  color: '#4ade80' },
                  { label: '≥ 10x', avg: data.timing.avg10xMin, since: data.timing.msSince10x, until: data.timing.msUntil10x, at: data.timing.next10xAt, last: data.timing.last10x, color: '#a855f7' },
                  { label: '≥ 50x', avg: data.timing.avg50xMin, since: data.timing.msSince50x, until: data.timing.msUntil50x, at: data.timing.next50xAt, last: data.timing.last50x, color: '#fbbf24' },
                ].map(row => {
                  const overdue = row.until < 0;
                  const uc = overdue ? '#ff2d55' : row.color;
                  return (
                    <div key={row.label} style={{
                      background: overdue ? 'rgba(255,45,85,.08)' : 'rgba(255,255,255,.03)',
                      border: `1px solid ${overdue ? '#ff2d5530' : 'rgba(255,255,255,.07)'}`,
                      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: row.color, fontWeight: 800, fontSize: 16 }}>{row.label}</span>
                        <span style={{
                          background: `${uc}20`, border: `1px solid ${uc}50`,
                          color: uc, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
                        }}>
                          {overdue ? `⚠️ EN RETARD ${fmtSec(Math.abs(row.until))}` : `Dans ${fmtSec(row.until)}`}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                        <MiniCell label="Interv. moy." value={`${row.avg} min`} color={row.color} />
                        <MiniCell label="Depuis" value={row.since} color="#94a3b8" />
                        <MiniCell label="Prochain" value={row.at} color={uc} />
                        <MiniCell label="Dernier" value={row.last ? `${row.last.mult}x` : '—'} color="#64748b" />
                      </div>
                    </div>
                  );
                })}

                {/* Zone freq */}
                <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>
                  Distribution zones (20 derniers tours)
                </div>
                <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
                  {ZONES.map(z => {
                    const pct = data.zoneFreq[z] ?? 0;
                    if (!pct) return null;
                    return (
                      <div key={z} style={{
                        flex: pct, background: ZONE_COLORS[z],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: pct > 10 ? 'auto' : 0, overflow: 'hidden',
                      }}>
                        {pct > 10 && <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(0,0,0,.7)' }}>{pct}%</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ TAB: MARKOV ══ */}
            {tab === 'markov' && (
              <div>
                <div style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
                  Depuis <strong style={{ color: '#e2e8f0' }}>{data.markov.currentLabel}</strong>, proba. de chaque zone suivante
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                  {ZONES.map(z => {
                    const pct = data.markov.transitions[z] ?? 0;
                    return (
                      <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: `${ZONE_COLORS[z]}20`, border: `1.5px solid ${ZONE_COLORS[z]}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: ZONE_COLORS[z], fontWeight: 800, fontSize: 12, flexShrink: 0,
                        }}>{z}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 10, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: ZONE_COLORS[z], borderRadius: 5 }} />
                          </div>
                        </div>
                        <div style={{ color: ZONE_COLORS[z], fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'right' }}>{pct}%</div>
                        <div style={{ color: '#334155', fontSize: 11, minWidth: 50 }}>{ZONE_LABELS[z]}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Top N-gram patterns */}
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
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                        {p.zones.map((z, zi) => (
                          <span key={zi} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: 5,
                              background: `${ZONE_COLORS[z]}20`, border: `1px solid ${ZONE_COLORS[z]}60`,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: ZONE_COLORS[z], fontWeight: 800, fontSize: 10,
                            }}>{z}</span>
                            {zi < p.zones.length - 1 && <span style={{ color: '#334155', fontSize: 11 }}>→</span>}
                          </span>
                        ))}
                      </div>
                      <div style={{ color: '#475569', fontSize: 10 }}>{p.sequence}</div>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{p.count}×</div>
                    <div style={{
                      background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)',
                      color: '#a5b4fc', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700,
                    }}>{p.pct}%</div>
                  </div>
                ))}

                {/* Anomalies */}
                <div style={{
                  marginTop: 10, padding: '10px 14px',
                  background: data.anomalies.detected ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.06)',
                  border: `1px solid ${data.anomalies.detected ? '#ef444430' : '#22c55e25'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Moyenne historique</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.mean}x</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>Écart-type σ</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{data.anomalies.stdDev}x</span>
                  </div>
                  {data.anomalies.detected
                    ? <div style={{ color: '#f87171', fontWeight: 700, fontSize: 12 }}>⚠️ Anomalies : {data.anomalies.values.join(', ')}x</div>
                    : <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 12 }}>✅ Distribution normale</div>
                  }
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,.05)',
            display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: 11,
          }}>
            <span>🤖 {data.basedOn} tours analysés</span>
            <span>{data.generatedAt} · refresh 8s</span>
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

function getZoneClient(v: number): string {
  if (v < 1.5) return 'A';
  if (v < 2)   return 'B';
  if (v < 5)   return 'C';
  if (v < 10)  return 'D';
  if (v < 50)  return 'E';
  return 'F';
}

function InfoBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 9, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
      <div style={{ color, fontWeight: 800, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
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
      display: 'grid', gridTemplateColumns: '90px 1fr auto',
      gap: 8, alignItems: 'center', padding: '8px 10px',
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8,
    }}>
      <span style={{ color: '#475569', fontSize: 11 }}>{label}</span>
      <span style={{ color, fontWeight: 700, fontSize: 12 }}>{value}</span>
      {detail && <span style={{ color: '#475569', fontSize: 10, textAlign: 'right' }}>{detail}</span>}
    </div>
  );
}

function ProbCell({ pct, color }: { pct: number; color: string }) {
  return (
    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
      <div style={{ color, fontWeight: 800, fontSize: 14 }}>{pct}%</div>
      <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </td>
  );
}

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{
      background: `${color}15`, border: `1px solid ${color}30`,
      color, fontSize: 9, fontWeight: 700, borderRadius: 5, padding: '2px 5px',
    }}>{label} {value}</span>
  );
}

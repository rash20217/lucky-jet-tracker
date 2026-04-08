import { useState, useEffect, useCallback } from 'react';
import type { Round } from '../types';
import { analyzeHistory } from '../analysis';
import type { AnalysisResult, SignalLevel } from '../analysis';

interface Props {
  rounds: Round[];
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const levelColors: Record<SignalLevel, string> = {
  maximum:     '#ff2d55',
  tres_fort:   '#ff4500',
  fort:        '#ff8c00',
  modere:      '#ffd700',
  faible:      '#ff8c00',
  tres_faible: '#888',
  blocage:     '#666',
  attente:     '#555',
};

const levelBg: Record<SignalLevel, string> = {
  maximum:     'rgba(255,45,85,0.15)',
  tres_fort:   'rgba(255,69,0,0.15)',
  fort:        'rgba(255,140,0,0.12)',
  modere:      'rgba(255,215,0,0.10)',
  faible:      'rgba(255,140,0,0.08)',
  tres_faible: 'rgba(136,136,136,0.08)',
  blocage:     'rgba(102,102,102,0.08)',
  attente:     'rgba(85,85,85,0.08)',
};

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export default function PredictionSignal({ rounds }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [lastUsed, setLastUsed] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lastUsed == null) { setCooldown(0); return; }
    const tick = () => {
      const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
      setCooldown(Math.max(0, remaining));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUsed]);

  const handleAnalyze = useCallback(() => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setTimeout(() => {
      const r = analyzeHistory(rounds);
      setResult(r);
      setLastUsed(Date.now());
      setLoading(false);
    }, 600);
  }, [rounds, cooldown, loading]);

  const canUse = cooldown === 0 && !loading;
  const color = result ? levelColors[result.niveauCode] : '#a78bfa';
  const bg = result ? levelBg[result.niveauCode] : 'transparent';

  return (
    <div style={{ marginBottom: 20 }}>

      {/* ── Bouton ── */}
      <button
        onClick={handleAnalyze}
        disabled={!canUse}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 12,
          border: `2px solid ${canUse ? '#a78bfa' : '#333'}`,
          background: canUse
            ? 'linear-gradient(135deg,rgba(167,139,250,.18),rgba(167,139,250,.06))'
            : 'rgba(255,255,255,.04)',
          color: canUse ? '#d8b4fe' : '#555',
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: '0.05em',
          cursor: canUse ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'all .2s',
        }}
      >
        {loading ? (
          <span style={{ fontSize: 18 }}>⏳</span>
        ) : (
          <span style={{ fontSize: 18 }}>🎯</span>
        )}
        {loading
          ? 'Analyse en cours…'
          : cooldown > 0
          ? `Disponible dans ${formatMs(cooldown)}`
          : 'Analyser le signal (toutes les 5 min)'}
      </button>

      {/* ── Résultat ── */}
      {result && (
        <div
          style={{
            marginTop: 12,
            background: bg,
            border: `1px solid ${color}44`,
            borderRadius: 14,
            padding: '18px 20px',
            animation: 'fadeInUp .3s ease',
          }}
        >
          {/* Header signal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color, fontWeight: 800, fontSize: 18, letterSpacing: '0.04em' }}>
              {result.niveauLabel}
            </span>
            <span style={{
              background: 'rgba(255,255,255,.06)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              color: '#888',
            }}>
              {result.phaseLabel}
            </span>
          </div>

          {/* Tableau principal */}
          {!result.blocage && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginBottom: 16,
            }}>
              <InfoBox label="Heure d'entrée" value={result.heureEntree} color={color} />
              <InfoBox label="Cible" value={result.cible} color={color} />
              <InfoBox label="Timer cash-out" value={result.timer} color={color} />
            </div>
          )}

          {/* Blocage */}
          {result.blocage && result.blocageRaison && (
            <div style={{
              background: 'rgba(255,59,48,.1)',
              border: '1px solid rgba(255,59,48,.3)',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#ff6b6b',
              fontSize: 14,
              marginBottom: 14,
              fontWeight: 600,
            }}>
              🚫 {result.blocageRaison}
            </div>
          )}

          {/* Split recommendation */}
          {result.split.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: '#888', fontSize: 11, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                Gestion des mises (Split)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.split.map((s, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr auto',
                    alignItems: 'center',
                    gap: 10,
                    background: 'rgba(255,255,255,.04)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}>
                    <span style={{ color, fontWeight: 800, fontSize: 16 }}>{s.pct}</span>
                    <span style={{ color: '#ccc', fontSize: 13 }}>{s.cible}</span>
                    <span style={{
                      background: 'rgba(167,139,250,.15)',
                      color: '#c4b5fd',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}>⏱ {s.timer}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Détails */}
          <div>
            <div style={{ color: '#888', fontSize: 11, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
              Analyse
            </div>
            {result.details.map((d, i) => (
              <div key={i} style={{
                fontSize: 13,
                color: '#aaa',
                padding: '4px 0',
                borderBottom: i < result.details.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none',
                lineHeight: 1.5,
              }}>
                {d}
              </div>
            ))}
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

function InfoBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.05)',
      borderRadius: 10,
      padding: '12px 10px',
      textAlign: 'center',
    }}>
      <div style={{ color: '#666', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontWeight: 800, fontSize: 20 }}>{value}</div>
    </div>
  );
}

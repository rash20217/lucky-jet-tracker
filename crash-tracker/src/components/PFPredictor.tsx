import { useState, useEffect } from 'react';

interface PFData {
  currentHash: string | null;
  currentPrediction: number | null;
  bestFormula: string;
  chainValid: boolean | null;
  hasDigest: boolean;
  allFormulas: { [key: string]: number | null };
  accuracy: {
    exact: number;
    within10pct: number;
    within25pct: number;
    sampleSize: number;
  } | null;
  formulaScores: { [key: string]: number };
  recentPairs: {
    hash: string;
    predicted: number;
    actual: number;
    diff: string;
  }[];
}

const FORMULA_LABELS: Record<string, string> = {
  bgaming52: 'BGaming 52-bit',
  standard32: 'Standard 32-bit',
  sha256_52: 'SHA256→52-bit',
  hmac32: 'HMAC 32-bit',
};

export default function PFPredictor() {
  const [data, setData] = useState<PFData | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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

  const acc = data.accuracy;
  const bestScore = acc?.within10pct ?? 0;
  const isCalibrating = !acc || acc.sampleSize < 10;

  // Best formula score from formulaScores
  const topScore = Math.max(0, ...Object.values(data.formulaScores));

  // Status interpretation
  const status: 'calibrating' | 'learning' | 'active' = 
    !acc || acc.sampleSize < 5   ? 'calibrating' :
    topScore < 20                ? 'learning'    :
    'active';

  const statusColor = status === 'active' ? '#4ade80' : status === 'learning' ? '#f59e0b' : '#64748b';
  const statusLabel = status === 'active' ? 'Actif' : status === 'learning' ? 'Apprentissage' : 'Calibration';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1421 0%, #111827 100%)',
      border: '1px solid #2a3a5c',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ fontSize: '22px' }}>🔐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '2px', color: '#e2e8f0' }}>
            PROVABLY FAIR
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Vérification + estimation RNG · Hash capturé à chaque round
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: statusColor + '18',
          border: `1px solid ${statusColor}44`,
          borderRadius: '20px',
          padding: '5px 12px',
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: statusColor,
            animation: status === 'calibrating' ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{ fontSize: '11px', color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
        </div>
      </div>

      {/* Hash + integrity row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '14px',
      }}>
        {/* Hash card */}
        <div style={{ background: '#070c17', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', marginBottom: '6px' }}>
            HASH ROUND EN COURS
          </div>
          {data.currentHash ? (
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#4ade80', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {data.currentHash.slice(0, 24)}…
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#3a4560' }}>En attente…</div>
          )}
        </div>

        {/* Integrity card */}
        <div style={{ background: '#070c17', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', marginBottom: '6px' }}>
            INTÉGRITÉ
          </div>
          <div style={{ fontSize: '12px', color: data.hasDigest ? '#4ade80' : '#64748b', fontWeight: 600, marginBottom: '4px' }}>
            {data.hasDigest ? '✓ Digest vérifié' : '⏳ En attente digest'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {data.chainValid === true && '✓ Chaîne hash valide'}
            {data.chainValid === false && '● Hash indépendants'}
            {data.chainValid === null && 'Analyse en cours…'}
          </div>
        </div>
      </div>

      {/* Formula calibration status */}
      <div style={{
        background: '#0a0f1c',
        borderRadius: '10px',
        padding: '14px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px' }}>
            AUTO-CALIBRATION FORMULE RNG
          </div>
          <div style={{ fontSize: '11px', color: statusColor, fontWeight: 700 }}>
            {acc ? `${acc.sampleSize} rounds analysés` : 'Démarrage…'}
          </div>
        </div>

        {Object.entries(data.formulaScores).map(([name, score]) => (
          <div key={name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}>
            <div style={{
              fontSize: '11px',
              color: name === data.bestFormula ? '#6b7aff' : '#64748b',
              width: '130px',
              flexShrink: 0,
            }}>
              {name === data.bestFormula ? '▶ ' : '  '}{FORMULA_LABELS[name] ?? name}
            </div>
            <div style={{
              flex: 1,
              background: '#111827',
              borderRadius: '4px',
              height: '6px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${score}%`,
                height: '100%',
                background: score > 40 ? '#4ade80' : score > 20 ? '#6b7aff' : '#3a4560',
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: '#e2e8f0', width: '30px', textAlign: 'right', fontWeight: score > 40 ? 700 : 400 }}>
              {score}%
            </div>
          </div>
        ))}

        {topScore < 15 && acc && acc.sampleSize >= 5 && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: '#f59e0b11',
            border: '1px solid #f59e0b33',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#f59e0b',
          }}>
            ℹ️ Formule Lucky Jet non-standard détectée — analyse continue. Les prédictions ci-dessous sont des estimations statistiques.
          </div>
        )}
      </div>

      {/* Prediction (best effort) */}
      {data.currentPrediction != null && (
        <div style={{
          background: '#070c17',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px', marginBottom: '4px' }}>
              ESTIMATION ({FORMULA_LABELS[data.bestFormula]?.split(' ')[0] ?? 'Formule'} {data.formulaScores[data.bestFormula] ?? 0}%)
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 900,
              color: data.currentPrediction < 2 ? '#f59e0b' : data.currentPrediction < 5 ? '#6b7aff' : '#4ade80',
            }}>
              ~{data.currentPrediction.toFixed(2)}x
            </div>
          </div>
          <div style={{ flex: 1, fontSize: '11px', color: '#64748b', lineHeight: 1.7 }}>
            {isCalibrating && <span style={{ color: '#f59e0b' }}>⚙ Précision formule en cours d'évaluation<br /></span>}
            Confiance: <b style={{ color: topScore > 30 ? '#4ade80' : '#f59e0b' }}>{topScore > 30 ? 'Modérée' : topScore > 15 ? 'Faible' : 'Très faible'}</b>
            {acc && <><br />Accuracy ±10%: <b style={{ color: '#e2e8f0' }}>{acc.within10pct}%</b> / {acc.sampleSize} tours</>}
          </div>
        </div>
      )}

      {/* Toggle recent pairs */}
      {data.recentPairs.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(p => !p)}
            style={{
              background: 'none',
              border: '1px solid #1e2535',
              borderRadius: '8px',
              color: '#64748b',
              fontSize: '11px',
              padding: '6px 14px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {showDetails ? '▲ Masquer les vérifications' : '▼ Voir les vérifications récentes'}
          </button>

          {showDetails && (
            <div style={{ marginTop: '10px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: '6px',
                padding: '5px 0',
                borderBottom: '1px solid #1e2535',
              }}>
                {['Hash', 'Estimé', 'Réel', 'Écart'].map(h => (
                  <div key={h} style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{h}</div>
                ))}
              </div>
              {data.recentPairs.map((p, i) => {
                const pct = parseInt(p.diff);
                return (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: '6px',
                    padding: '6px 0',
                    borderBottom: '1px solid #0d1421',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#4ade80', opacity: 0.7 }}>{p.hash}</div>
                    <div style={{ fontSize: '11px', color: '#6b7aff' }}>{p.predicted?.toFixed(2)}x</div>
                    <div style={{ fontSize: '11px', color: '#e2e8f0' }}>{p.actual.toFixed(2)}x</div>
                    <div style={{ fontSize: '10px', color: pct < 15 ? '#4ade80' : pct < 30 ? '#f59e0b' : '#e07030', fontWeight: 700 }}>
                      {p.diff}
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: '10px', color: '#3a4560', marginTop: '8px', textAlign: 'center' }}>
                Le jeu Lucky Jet utilise une formule RNG propriétaire non publiée.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

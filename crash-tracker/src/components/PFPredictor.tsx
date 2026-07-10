import { useState, useEffect } from 'react';

interface PFData {
  currentHash: string | null;
  currentPrediction: number | null;
  accuracy: {
    exact: number;
    within10pct: number;
    within25pct: number;
    sampleSize: number;
  } | null;
  recentPairs: {
    hash: string;
    predicted: number;
    actual: number;
    diff: string;
  }[];
}

export default function PFPredictor() {
  const [data, setData] = useState<PFData | null>(null);
  const [showPairs, setShowPairs] = useState(false);

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

  const pred = data.currentPrediction;
  const acc = data.accuracy;

  function predColor(v: number) {
    if (v < 1.5) return '#e07030';
    if (v < 2)   return '#f59e0b';
    if (v < 5)   return '#6b7aff';
    if (v < 10)  return '#4ade80';
    return '#a855f7';
  }

  function zone(v: number) {
    if (v < 1.5) return 'A — Très bas';
    if (v < 2)   return 'B — Bas';
    if (v < 5)   return 'C — Moyen';
    if (v < 10)  return 'D — Haut';
    if (v < 50)  return 'E — Très haut';
    return 'F — Extrême';
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1421 0%, #111827 100%)',
      border: '1px solid #2a3a5c',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '20px' }}>🔐</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '2px', color: '#e2e8f0' }}>
            PROVABLY FAIR — PRÉDICTION RNG
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Formule mathématique appliquée au hash SHA-512
          </div>
        </div>
        {acc && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Précision formule</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: acc.within10pct > 50 ? '#4ade80' : '#f59e0b' }}>
              {acc.within10pct}%
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>±10% sur {acc.sampleSize} tours</div>
          </div>
        )}
      </div>

      {pred != null ? (
        <div style={{
          background: '#0a0f1c',
          borderRadius: '12px',
          padding: '18px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '14px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', marginBottom: '6px' }}>
              CRASH PRÉDIT (RNG)
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, color: predColor(pred) }}>
              {pred.toFixed(2)}x
            </div>
            <div style={{
              display: 'inline-block',
              background: predColor(pred) + '22',
              border: `1px solid ${predColor(pred)}44`,
              borderRadius: '8px',
              padding: '3px 10px',
              fontSize: '11px',
              color: predColor(pred),
              fontWeight: 700,
              marginTop: '4px',
            }}>
              Zone {zone(pred)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', marginBottom: '8px' }}>
              INTERPRÉTATION
            </div>
            <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.6' }}>
              {pred < 1.5 && <>⚠️ Crash imminent probable<br />Ne pas miser</>}
              {pred >= 1.5 && pred < 2 && <>🟡 Crash bas attendu<br />Viser retrait à <b>1.3x</b></>}
              {pred >= 2 && pred < 5 && <>🔵 Tour correct attendu<br />Viser retrait à <b>{(pred * 0.7).toFixed(2)}x</b></>}
              {pred >= 5 && pred < 10 && <>🟢 Bon multiplicateur prévu<br />Viser retrait à <b>{(pred * 0.65).toFixed(2)}x</b></>}
              {pred >= 10 && <>🟣 Grand multiplicateur prévu!<br />Stratégie <b>retrait progressif</b></>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#0a0f1c',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center',
          color: '#64748b',
          marginBottom: '14px',
        }}>
          En attente du prochain round…
        </div>
      )}

      {data.currentHash && (
        <div style={{
          background: '#070c17',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>HASH:</span>
          <span style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#4ade80',
            wordBreak: 'break-all',
            opacity: 0.8,
          }}>
            {data.currentHash.slice(0, 32)}…
          </span>
        </div>
      )}

      {acc && acc.sampleSize > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            marginBottom: '12px',
          }}>
            {[
              { label: 'Exact (±1%)', val: acc.exact, color: '#4ade80' },
              { label: 'Proche (±10%)', val: acc.within10pct, color: '#6b7aff' },
              { label: 'Approx (±25%)', val: acc.within25pct, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#0a0f1c',
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.val}%</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPairs(p => !p)}
            style={{
              background: 'none',
              border: '1px solid #2a3a5c',
              borderRadius: '8px',
              color: '#64748b',
              fontSize: '12px',
              padding: '6px 14px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {showPairs ? '▲ Masquer' : '▼ Voir les vérifications récentes'}
          </button>

          {showPairs && data.recentPairs.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                gap: '6px',
                padding: '6px 0',
                borderBottom: '1px solid #1e2535',
              }}>
                {['Hash', 'Prédit', 'Réel', 'Écart'].map(h => (
                  <div key={h} style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>{h}</div>
                ))}
              </div>
              {data.recentPairs.map((p, i) => {
                const ok = parseInt(p.diff) < 15;
                return (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr',
                    gap: '6px',
                    padding: '7px 0',
                    borderBottom: '1px solid #111827',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#4ade80', opacity: 0.7 }}>{p.hash}</div>
                    <div style={{ fontSize: '12px', color: '#6b7aff', fontWeight: 600 }}>{p.predicted?.toFixed(2)}x</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.actual.toFixed(2)}x</div>
                    <div style={{ fontSize: '11px', color: ok ? '#4ade80' : '#e07030', fontWeight: 700 }}>{p.diff}</div>
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

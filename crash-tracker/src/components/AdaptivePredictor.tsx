import { useRef, useState, useEffect } from 'react';
import type { Round } from '../types';
import { AutoAdaptiveEngine } from '../AutoAdaptiveEngine';
import type { PredictionResult, Zone } from '../AutoAdaptiveEngine';

interface Props {
  rounds: Round[];
}

const ZONE_COLOR: Record<Zone, string> = {
  B: '#4fc3f7',
  M: '#ffb74d',
  H: '#ef5350',
  ATTENTE: '#7888aa',
};

const ZONE_LABEL: Record<Zone, string> = {
  B: 'BAS',
  M: 'MOYEN',
  H: 'HAUT',
  ATTENTE: '—',
};

const SENSOR_COLORS = ['#4fc3f7', '#ffb74d', '#aed581', '#ce93d8'];
const SENSORS: { key: string; label: string; emoji: string }[] = [
  { key: 'pattern', label: 'Patterns', emoji: '🧩' },
  { key: 'volatility', label: 'Volatilité', emoji: '🌊' },
  { key: 'interval', label: 'Intervalles', emoji: '📏' },
  { key: 'ending', label: 'Terminaisons', emoji: '🔢' },
];

export default function AdaptivePredictor({ rounds }: Props) {
  const engineRef = useRef<AutoAdaptiveEngine>(new AutoAdaptiveEngine());
  const processedCount = useRef(0);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const engine = engineRef.current;
    const reversedRounds = [...rounds].reverse();

    if (processedCount.current === 0 && reversedRounds.length > 0) {
      for (const r of reversedRounds) {
        engine.addRound({ multi: r.multiplier, time: r.time, hash: r.hashSeed });
      }
      processedCount.current = reversedRounds.length;
    } else {
      const newRounds = reversedRounds.slice(processedCount.current);
      for (const r of newRounds) {
        engine.addRound({ multi: r.multiplier, time: r.time, hash: r.hashSeed });
      }
      processedCount.current = reversedRounds.length;
    }

    setPrediction(engine.predict());
  }, [rounds]);

  if (!prediction) return null;

  const { zone, confidence, interval, advice, weights, seedJustChanged, accuracy } = prediction;
  const zoneColor = ZONE_COLOR[zone];
  const isWaiting = zone === 'ATTENTE';

  return (
    <div style={{
      background: '#131520',
      border: '1px solid #1e2340',
      borderRadius: '16px',
      marginBottom: '14px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🧠</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px' }}>
              MOTEUR AUTO-APPRENANT
            </div>
            <div style={{ color: '#7888aa', fontSize: '11px' }}>
              Patterns · Volatilité · Intervalles · Terminaisons · {accuracy.total} rounds analysés
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {seedJustChanged && (
            <span style={{
              background: '#3a1010',
              color: '#ff6b6b',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.5px',
            }}>RECALIBRAGE</span>
          )}
          <div style={{
            background: isWaiting ? '#1e2340' : `${zoneColor}22`,
            color: isWaiting ? '#7888aa' : zoneColor,
            border: `1px solid ${isWaiting ? '#2a3050' : zoneColor + '55'}`,
            borderRadius: '8px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            {isWaiting ? 'ATTENTE' : `ZONE ${ZONE_LABEL[zone]}`}
          </div>
          <span style={{ color: '#7888aa', fontSize: '16px' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>

          {/* Prédiction principale */}
          <div style={{
            background: '#0f1117',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <div style={{ color: '#7888aa', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>
                ZONE PRÉDITE
              </div>
              <div style={{
                fontSize: '36px',
                fontWeight: 800,
                color: zoneColor,
                letterSpacing: '-1px',
                lineHeight: 1,
              }}>
                {isWaiting ? '—' : ZONE_LABEL[zone]}
              </div>
              <div style={{ color: '#9aa5be', fontSize: '13px', marginTop: '6px' }}>
                {interval}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#7888aa', fontSize: '10px', letterSpacing: '1px', marginBottom: '4px' }}>
                CONFIANCE
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#f0a500', lineHeight: 1 }}>
                {confidence}%
              </div>
              <div style={{
                width: '120px',
                height: '5px',
                background: '#1e2340',
                borderRadius: '4px',
                marginTop: '8px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${confidence}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #f0a500, #ff5500)',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </div>

          {/* Conseil */}
          <div style={{
            background: '#0f1117',
            borderLeft: `3px solid #f0a500`,
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#ccc',
            marginBottom: '12px',
          }}>
            {advice}
          </div>

          {/* Poids des capteurs */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#7888aa', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
              ⚙️ POIDS DES CAPTEURS (apprentissage en direct)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {SENSORS.map((s, i) => {
                const pct = Math.round((weights[s.key] || 0) * 100);
                return (
                  <div key={s.key} style={{
                    background: '#0f1117',
                    borderRadius: '10px',
                    padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#aaa' }}>{s.emoji} {s.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: SENSOR_COLORS[i] }}>{pct}%</span>
                    </div>
                    <div style={{ height: '4px', background: '#1e2340', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: SENSOR_COLORS[i],
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fiabilité */}
          <div style={{
            background: '#0f1117',
            borderRadius: '12px',
            padding: '12px 14px',
          }}>
            <div style={{ color: '#7888aa', fontSize: '10px', letterSpacing: '1px', marginBottom: '10px' }}>
              📊 FIABILITÉ &amp; STATUT SEED
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {[
                { label: 'Globale', value: `${accuracy.global}%` },
                { label: 'Récente (20)', value: `${accuracy.recent}%` },
                { label: 'Rounds', value: accuracy.total },
              ].map(item => (
                <div key={item.label} style={{
                  flex: 1,
                  background: '#131520',
                  borderRadius: '8px',
                  padding: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f0a500' }}>{item.value}</div>
                  <div style={{ fontSize: '10px', color: '#7888aa', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div style={{ height: '4px', background: '#1e2340', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{
                width: `${accuracy.recent}%`,
                height: '100%',
                background: accuracy.recent > 65 ? '#4ade80' : accuracy.recent > 50 ? '#f0a500' : '#ef5350',
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #1e2340',
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: seedJustChanged ? '#ff1744' : accuracy.recent > 60 ? '#00c853' : '#ffab00',
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <span style={{ fontSize: '12px', color: '#9aa5be' }}>
                {seedJustChanged
                  ? '🔄 NOUVELLE SEED — Recalibrage en cours...'
                  : `Seed stable · Précision récente: ${accuracy.recent}%`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { Round } from '../types';

interface Props {
  rounds: Round[];
}

export default function RoundTable({ rounds }: Props) {
  const recent = rounds.slice(-10).reverse();

  function getMultiplierColor(mult: number): string {
    if (mult < 2) return '#e07030';
    if (mult < 5) return '#6b7aff';
    if (mult < 10) return '#4ade80';
    return '#a855f7';
  }

  return (
    <div style={{
      background: '#161b27',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '8px',
        paddingBottom: '12px',
        borderBottom: '1px solid #2a3044',
        marginBottom: '4px',
      }}>
        {['TOUR', 'HEURE', 'MULTIPLICATEUR', 'SOURCE'].map(h => (
          <div key={h} style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#7888aa',
            textAlign: 'center',
          }}>
            {h}
          </div>
        ))}
      </div>

      {recent.map((round, idx) => (
        <div
          key={round.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '8px',
            padding: '14px 0',
            borderBottom: idx < recent.length - 1 ? '1px solid #1e2535' : 'none',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center', color: '#9aa5be', fontSize: '14px' }}>
            #{round.id}
          </div>
          <div style={{ textAlign: 'center', color: '#9aa5be', fontSize: '14px', fontFamily: 'monospace' }}>
            {round.time}
          </div>
          <div style={{
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 700,
            color: getMultiplierColor(round.multiplier),
          }}>
            {round.multiplier.toFixed(2)}x
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {round.source === 'LIVE' ? (
              <span style={{
                border: '1.5px solid #4ade80',
                color: '#4ade80',
                borderRadius: '20px',
                padding: '2px 12px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1px',
              }}>
                LIVE
              </span>
            ) : (
              <span style={{
                border: '1.5px solid #3a4560',
                color: '#6b7a9a',
                borderRadius: '20px',
                padding: '2px 12px',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                HIST
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

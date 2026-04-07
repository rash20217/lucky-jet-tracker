import type { Round } from '../types';
import { getBarColor } from '../utils';

interface Props {
  rounds: Round[];
}

export default function HistoryChart({ rounds }: Props) {
  const visible = rounds.slice(-30);
  const maxMult = Math.max(...visible.map(r => r.multiplier), 10);

  return (
    <div style={{
      background: '#161b27',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '1px', color: '#e2e8f0' }}>
            HISTORIQUE DES TOURS
          </span>
        </div>
        <span style={{ color: '#6b7aff', fontWeight: 700, fontSize: '15px' }}>
          {rounds.length} tours
        </span>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: '100px',
        paddingBottom: '8px',
        borderBottom: '1px solid #2a3044',
      }}>
        {visible.map((round) => {
          const heightPct = Math.max(8, (Math.log10(round.multiplier + 1) / Math.log10(maxMult + 1)) * 100);
          return (
            <div
              key={round.id}
              title={`#${round.id}: ${round.multiplier}x`}
              style={{
                flex: 1,
                height: `${heightPct}%`,
                background: getBarColor(round.multiplier),
                borderRadius: '3px 3px 0 0',
                minWidth: '6px',
                transition: 'height 0.3s ease',
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

import type { Prediction } from '../types';

interface Props {
  prediction: Prediction;
  onRefresh: () => void;
}

export default function PredictionCard({ prediction, onRefresh }: Props) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1f35 0%, #1e1540 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '16px',
      border: '1px solid #2a2560',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          color: '#9aa5be',
        }}>
          PRÉDICTION PROCHAIN TOUR
        </span>
      </div>

      <div style={{
        fontSize: '48px',
        fontWeight: 800,
        background: 'linear-gradient(90deg, #a855f7, #ec4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '8px',
        lineHeight: 1.1,
      }}>
        {prediction.low}x — {prediction.high}x
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: 'center',
        }}>
          <div style={{
            flex: 1,
            maxWidth: '200px',
            height: '4px',
            background: '#2a2d45',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${prediction.confidence}%`,
              background: 'linear-gradient(90deg, #6b7aff, #a855f7)',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ color: '#7888aa', fontSize: '13px', whiteSpace: 'nowrap' }}>
            {prediction.confidence}% conf.
          </span>
        </div>
      </div>

      <button
        onClick={onRefresh}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #3a3020, #4a3a10)',
          border: '2px solid #c49a20',
          color: '#f5c842',
          borderRadius: '12px',
          padding: '12px 32px',
          fontSize: '15px',
          fontWeight: 800,
          letterSpacing: '2px',
          cursor: 'pointer',
          marginBottom: '14px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.background = 'linear-gradient(135deg, #4a4025, #5a4a15)';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.background = 'linear-gradient(135deg, #3a3020, #4a3a10)';
        }}
      >
        <span style={{ fontSize: '16px' }}>🔄</span>
        {prediction.strategy}
      </button>

      <div style={{ color: '#7888aa', fontSize: '14px' }}>
        Moyenne récente:{' '}
        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
          {prediction.recentAverage}x
        </span>
      </div>
    </div>
  );
}

import type { Stats } from '../types';

interface Props {
  stats: Stats;
}

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{
      background: '#1e2535',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '24px',
        fontWeight: 800,
        color: color || '#e2e8f0',
        marginBottom: '4px',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: '#7888aa',
      }}>
        {label}
      </div>
    </div>
  );
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}>
        <span style={{ color: '#9aa5be', fontSize: '14px' }}>{label}</span>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '14px' }}>{pct}%</span>
      </div>
      <div style={{
        height: '6px',
        background: '#2a3044',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function StatsPanel({ stats }: Props) {
  return (
    <div style={{
      background: '#161b27',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: '18px' }}>📊</span>
        <span style={{
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '1px',
          color: '#e2e8f0',
        }}>
          STATISTIQUES
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <StatCard value={`${stats.average.toFixed(2)}x`} label="MOYENNE" />
        <StatCard value={`${stats.best.toFixed(2)}x`} label="MEILLEUR" color="#f5c842" />
        <StatCard value={`${stats.lowest.toFixed(2)}x`} label="PLUS BAS" color="#e07030" />
        <StatCard value={`${stats.totalRounds}`} label="TOURS" />
      </div>

      <ProgressBar label="Tours ≥ 2x" pct={stats.pct2x} color="linear-gradient(90deg, #6b7aff, #a855f7)" />
      <ProgressBar label="Tours ≥ 5x" pct={stats.pct5x} color="linear-gradient(90deg, #22c55e, #4ade80)" />
      <ProgressBar label="Tours ≥ 10x" pct={stats.pct10x} color="linear-gradient(90deg, #f59e0b, #fcd34d)" />
    </div>
  );
}

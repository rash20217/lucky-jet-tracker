import { useState, useEffect, useRef } from 'react';
import type { Round } from './types';
import { generateMultiplier, formatTime, computeStats, computePrediction, generateInitialRounds } from './utils';
import HistoryChart from './components/HistoryChart';
import RoundTable from './components/RoundTable';
import PredictionCard from './components/PredictionCard';
import StatsPanel from './components/StatsPanel';
import './index.css';

export default function App() {
  const [rounds, setRounds] = useState<Round[]>(() => generateInitialRounds());
  const [isLive, setIsLive] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const roundIdRef = useRef(1078);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stats = computeStats(rounds);
  const prediction = computePrediction(rounds);

  function addNewRound() {
    const newRound: Round = {
      id: roundIdRef.current++,
      time: formatTime(new Date()),
      multiplier: generateMultiplier(),
      source: 'LIVE',
    };
    setRounds(prev => [...prev.slice(-99), newRound]);
    setIsAdding(true);
    setTimeout(() => setIsAdding(false), 500);
  }

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => {
        addNewRound();
      }, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive]);

  function handleRefreshPrediction() {
    addNewRound();
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      padding: '16px',
      maxWidth: '520px',
      margin: '0 auto',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingTop: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #6b7aff, #a855f7)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}>
            🚀
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#e2e8f0' }}>CrashTracker</div>
            <div style={{ fontSize: '11px', color: '#7888aa', letterSpacing: '1px' }}>ANALYSE EN TEMPS RÉEL</div>
          </div>
        </div>

        <button
          onClick={() => setIsLive(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isLive ? '#1a2a1a' : '#2a1a1a',
            border: `1.5px solid ${isLive ? '#22c55e' : '#e07030'}`,
            color: isLive ? '#4ade80' : '#e07030',
            borderRadius: '20px',
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1px',
            cursor: 'pointer',
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isLive ? '#4ade80' : '#e07030',
            animation: isLive ? 'pulse 1.5s infinite' : 'none',
          }} />
          {isLive ? 'LIVE' : 'PAUSE'}
        </button>
      </div>

      {isAdding && (
        <div style={{
          background: 'linear-gradient(135deg, #1a2535, #1e2d20)',
          border: '1px solid #22c55e',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.3s ease',
        }}>
          <span style={{ fontSize: '16px' }}>✅</span>
          <span style={{ color: '#4ade80', fontSize: '14px', fontWeight: 600 }}>
            Nouveau tour #{roundIdRef.current - 1} ajouté !
          </span>
        </div>
      )}

      <PredictionCard prediction={prediction} onRefresh={handleRefreshPrediction} />
      <StatsPanel stats={stats} />
      <HistoryChart rounds={rounds} />
      <RoundTable rounds={rounds} />

      <div style={{
        textAlign: 'center',
        color: '#3a4560',
        fontSize: '12px',
        paddingTop: '8px',
        paddingBottom: '20px',
      }}>
        Mise à jour automatique toutes les 5 secondes · Simulation uniquement
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

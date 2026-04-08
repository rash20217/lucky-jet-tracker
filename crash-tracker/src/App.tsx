import { useState, useEffect, useRef } from 'react';
import type { Round } from './types';
import { computeStats, computePrediction } from './utils';
import HistoryChart from './components/HistoryChart';
import RoundTable from './components/RoundTable';
import PredictionCard from './components/PredictionCard';
import StatsPanel from './components/StatsPanel';
import PredictionSignal from './components/PredictionSignal';
import DeepAnalysis from './components/DeepAnalysis';
import './index.css';

type WsStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ApiResponse {
  status: WsStatus;
  error: string | null;
  rounds: Round[];
  current: Round | null;
  total: number;
}

export default function App() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [newRoundId, setNewRoundId] = useState<number | null>(null);
  const prevRoundCount = useRef(0);

  const stats = computeStats(rounds);
  const prediction = computePrediction(rounds);

  async function fetchRounds() {
    try {
      const res = await fetch('/api/luckyjet');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiResponse = await res.json();
      setWsStatus(data.status);
      setApiError(data.error);
      if (data.rounds && data.rounds.length > 0) {
        if (data.rounds.length > prevRoundCount.current) {
          setNewRoundId(data.rounds[0].id);
          setTimeout(() => setNewRoundId(null), 2000);
        }
        prevRoundCount.current = data.rounds.length;
        setRounds(data.rounds);
        setLastUpdate(new Date().toTimeString().slice(0, 8));
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur inconnue');
      setWsStatus('error');
    }
  }

  useEffect(() => {
    fetchRounds();
    const interval = setInterval(fetchRounds, 3000);
    return () => clearInterval(interval);
  }, []);

  function getStatusColor(): string {
    switch (wsStatus) {
      case 'connected': return '#4ade80';
      case 'connecting': return '#f5c842';
      case 'error': return '#e07030';
      default: return '#7888aa';
    }
  }

  function getStatusLabel(): string {
    switch (wsStatus) {
      case 'connected': return 'LIVE';
      case 'connecting': return 'CONNEXION...';
      case 'error': return 'ERREUR';
      default: return 'HORS LIGNE';
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      padding: '16px',
      maxWidth: '520px',
      margin: '0 auto',
    }}>
      {/* Header */}
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
            <div style={{ fontWeight: 800, fontSize: '16px', color: '#e2e8f0' }}>Lucky Jet Tracker</div>
            <div style={{ fontSize: '11px', color: '#7888aa', letterSpacing: '1px' }}>ANALYSE EN TEMPS RÉEL</div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: wsStatus === 'connected' ? '#1a2a1a' : '#1e1a14',
          border: `1.5px solid ${getStatusColor()}`,
          color: getStatusColor(),
          borderRadius: '20px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '1px',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getStatusColor(),
            animation: wsStatus === 'connected' ? 'pulse 1.5s infinite' : 'none',
            flexShrink: 0,
          }} />
          {getStatusLabel()}
        </div>
      </div>

      {/* Erreur de connexion */}
      {apiError && wsStatus === 'error' && (
        <div style={{
          background: '#1e1214',
          border: '1px solid #e07030',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ color: '#f87171', fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
              Connexion au serveur de jeu impossible
            </div>
            <div style={{ color: '#9aa5be', fontSize: '12px' }}>{apiError}</div>
          </div>
        </div>
      )}

      {/* Notification nouveau tour */}
      {newRoundId && (
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
            Nouveau tour #{newRoundId} reçu depuis le serveur !
          </span>
        </div>
      )}

      {/* Chargement initial */}
      {rounds.length === 0 && wsStatus === 'connecting' && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#7888aa',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔄</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#9aa5be' }}>
            Connexion au serveur Lucky Jet...
          </div>
          <div style={{ fontSize: '13px' }}>
            Récupération des données en cours
          </div>
        </div>
      )}

      {rounds.length > 0 && (
        <>
          <PredictionCard prediction={prediction} onRefresh={fetchRounds} />
          <PredictionSignal rounds={rounds} />
          <DeepAnalysis rounds={rounds} />
          <StatsPanel stats={stats} />
          <HistoryChart rounds={[...rounds].reverse()} />
          <RoundTable rounds={rounds} />
        </>
      )}

      {lastUpdate && (
        <div style={{
          textAlign: 'center',
          color: '#3a4560',
          fontSize: '12px',
          paddingTop: '8px',
          paddingBottom: '20px',
        }}>
          Dernière mise à jour : {lastUpdate} · Actualisation toutes les 3s
        </div>
      )}

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

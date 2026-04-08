import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const B_TOKEN = '43902aeaf456d9783e548073407c9966192027c9c638b1ca4ad3d8714b08e868b91283398cea8e4a6e09dbc2a72bb456e13703bf68c71e7a3ccc278fc1cfa343184c7ff1cf0929af9cfce9ea32b527c6ec5d1bed8fba0ad368dd8f1bdeed2c767d03c6a9a802e54eb844d895c622a90e67ffebf01d3b94b23e4ceb675d51f8f5f84f01de038b84d58dae795121f0545ffd73b083fb9ba3209e6085db.d3bd3e087e2b9dfc46f3e9c9769003e2.077dee8d-c923-4c02-9bee-757573662e69';
const GATEWAY_HTTP = 'https://crash-gateway-grm-cr.gamedev-tech.cc';
const GATEWAY_WS   = 'wss://crash-gateway-grm-cr.gamedev-tech.cc/websocket/lifecycle';
const MAX_HISTORY = 100;

// State
const history = [];
let currentCoeff = null;
let currentRoundId = null;
let currentRoundStart = null;
let wsStatus = 'disconnected';
let wsError = null;
let mainToken = null;
let msgId = 1;
let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let roundCounter = 1000;

// ── Prediction Scheduler ──────────────────────────────────────────────────────
const predictions = [];          // last 50 predictions
const MAX_PREDICTIONS = 50;
const PRED_DELAY_MS   = 3 * 60 * 1000;  // window opens 3 min after generation
const PRED_WINDOW_MS  = 2 * 60 * 1000;  // window lasts 2 min (T+3 → T+5)

function analyzeForPrediction() {
  if (history.length < 3) return null;

  const now = Date.now();
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);

  // Accumulation since last >5x
  const lastBig5  = sorted.find(r => r.multiplier >= 5);
  const lastBig10 = sorted.find(r => r.multiplier >= 10);
  const lastBig50 = sorted.find(r => r.multiplier >= 50);
  const accStartTs = lastBig5 ? lastBig5.timestamp : (sorted[sorted.length - 1]?.timestamp ?? now);
  const accDurMin  = (now - accStartTs) / 60000;
  const accRounds  = sorted.filter(r => r.timestamp > accStartTs);
  const onesInAcc  = accRounds.filter(r => r.multiplier <= 1.01).length;

  // Recent stats
  const last10 = sorted.slice(0, 10);
  const avg10  = last10.reduce((s, r) => s + r.multiplier, 0) / (last10.length || 1);
  const last1h = sorted.filter(r => (now - r.timestamp) < 3600000);
  const freq10x = last1h.filter(r => r.multiplier >= 10).length;
  const freq50x = last1h.filter(r => r.multiplier >= 50).length;

  // Signal & target determination
  let target, level, signal, timer, confidence;

  const latencyBlocked = lastBig50 && (now - lastBig50.timestamp) < 32 * 60000;

  if (latencyBlocked) {
    const remMin = Math.ceil((32 * 60000 - (now - lastBig50.timestamp)) / 60000);
    target = 2; level = 'PRUDENCE'; signal = 'FAIBLE';
    timer = '11s45'; confidence = 35;
    return { target, level, signal, timer, confidence, accDurMin, onesInAcc, avg10, note: `Latence post-${lastBig50.multiplier}x : ${remMin} min restantes` };
  }

  if (accDurMin < 2 && onesInAcc >= 1) {
    target = 10; level = 'MAXIMUM'; signal = 'TRÈS FORT'; timer = '1m03s'; confidence = 78;
  } else if (accDurMin < 2) {
    target = 10; level = 'FORT'; signal = 'FORT'; timer = '1m03s'; confidence = 65;
  } else if (accDurMin < 3 && onesInAcc >= 1) {
    target = 10; level = 'FORT'; signal = 'FORT'; timer = '1m03s'; confidence = 60;
  } else if (accDurMin < 3) {
    target = 5; level = 'MODÉRÉ'; signal = 'MODÉRÉ'; timer = '27s'; confidence = 52;
  } else if (accDurMin >= 4 && onesInAcc >= 2) {
    target = 10; level = 'FORT'; signal = 'FORT'; timer = '1m03s'; confidence = 63;
  } else if (freq10x >= 3) {
    target = 10; level = 'CHAUD'; signal = 'FORT'; timer = '1m03s'; confidence = 58;
  } else if (freq50x >= 1 && (now - lastBig50.timestamp) > 35 * 60000) {
    target = 50; level = 'AGRESSIF'; signal = 'FORT'; timer = '2m20s'; confidence = 45;
  } else {
    target = 2; level = 'PRUDENCE'; signal = 'FAIBLE'; timer = '11s45'; confidence = 55;
  }

  return { target, level, signal, timer, confidence, accDurMin, onesInAcc, avg10, note: null };
}

function generatePrediction() {
  const now = Date.now();
  const analysis = analyzeForPrediction();
  if (!analysis) return;

  const windowStart = now + PRED_DELAY_MS;
  const windowEnd   = now + PRED_DELAY_MS + PRED_WINDOW_MS;

  const pred = {
    id: Date.now(),
    generatedAt: now,
    generatedAtFmt: formatTime(new Date(now)),
    windowStart,
    windowEnd,
    windowStartFmt: formatTime(new Date(windowStart)),
    windowEndFmt:   formatTime(new Date(windowEnd)),
    target:      analysis.target,
    level:       analysis.level,
    signal:      analysis.signal,
    timer:       analysis.timer,
    confidence:  analysis.confidence,
    accDurMin:   Math.round(analysis.accDurMin * 10) / 10,
    onesInAcc:   analysis.onesInAcc,
    avg10:       Math.round(analysis.avg10 * 100) / 100,
    note:        analysis.note,
    status:      'pending',       // pending | success | fail
    bestMultiplier: null,
    roundsInWindow: 0,
    resolvedAt: null,
  };

  predictions.unshift(pred);
  if (predictions.length > MAX_PREDICTIONS) predictions.pop();
  console.log(`[PRED] Prédiction générée — Cible ≥${pred.target}x | Fenêtre ${pred.windowStartFmt}→${pred.windowEndFmt} | Signal ${pred.signal}`);
}

function validatePredictions(round) {
  const now = round.timestamp;
  for (const pred of predictions) {
    if (pred.status !== 'pending') continue;

    // Round falls inside the prediction window
    if (now >= pred.windowStart && now <= pred.windowEnd) {
      pred.roundsInWindow++;
      if (pred.bestMultiplier === null || round.multiplier > pred.bestMultiplier) {
        pred.bestMultiplier = round.multiplier;
      }
      if (round.multiplier >= pred.target) {
        pred.status = 'success';
        pred.resolvedAt = now;
        console.log(`[PRED] ✅ VALIDÉE — Cible ≥${pred.target}x atteinte avec ${round.multiplier}x`);
      }
    }

    // Window has closed — resolve as fail if still pending
    if (pred.status === 'pending' && now > pred.windowEnd) {
      pred.status = 'fail';
      pred.resolvedAt = now;
      console.log(`[PRED] ❌ ÉCHOUÉE — Cible ≥${pred.target}x non atteinte (meilleur: ${pred.bestMultiplier ?? 0}x)`);
    }
  }
}

function scheduleNextPrediction() {
  const now = Date.now();
  const SLOT_MS = 5 * 60 * 1000;
  const msIntoSlot = now % SLOT_MS;
  const msUntilNext = SLOT_MS - msIntoSlot;
  setTimeout(() => {
    generatePrediction();
    scheduleNextPrediction(); // chain
  }, msUntilNext);
  console.log(`[PRED] Prochaine prédiction dans ${Math.round(msUntilNext / 1000)}s`);
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function formatTime(d) { return d.toTimeString().slice(0, 8); }

function decodeJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch { return null; }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function httpPost(url, headers = {}, body = null) {
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) options.body = JSON.stringify(body);
  const r = await fetch(url, options);
  const text = await r.text();
  try { return { ok: r.ok, data: JSON.parse(text) }; }
  catch { return { ok: r.ok, data: text }; }
}

// ── Auth flow: 3 étapes ───────────────────────────────────────────────────────

async function authenticate() {
  console.log('[AUTH] Étape 1 — user/auth avec le token b');
  const step1 = await httpPost(`${GATEWAY_HTTP}/user/auth`, { 'Auth-Token': B_TOKEN });
  if (!step1.ok) throw new Error(`user/auth échoué: ${JSON.stringify(step1.data)}`);
  const { sessionId, customerId } = step1.data;
  if (!sessionId) throw new Error(`Pas de sessionId dans la réponse: ${JSON.stringify(step1.data)}`);
  console.log(`[AUTH] sessionId=${sessionId}, customerId=${customerId}`);

  console.log('[AUTH] Étape 2 — user/token');
  const step2 = await httpPost(
    `${GATEWAY_HTTP}/user/token`,
    { 'Session-Id': sessionId, 'Customer-Id': customerId }
  );
  if (!step2.ok || !step2.data.centrifugo) throw new Error(`user/token échoué: ${JSON.stringify(step2.data)}`);
  const { mainToken: mToken, secondaryToken } = step2.data.centrifugo;
  console.log('[AUTH] Tokens Centrifugo obtenus ✓');

  const payload = decodeJwtPayload(mToken);
  const channels = payload?.channels || [];
  console.log(`[AUTH] Canaux JWT: ${channels.join(', ')}`);

  return { mainToken: mToken, secondaryToken, channels };
}

// ── Traitement des messages WebSocket ─────────────────────────────────────────

function processMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  // Répondre aux pings du serveur Centrifugo (message vide = ping)
  if (Object.keys(msg).length === 0) {
    if (ws?.readyState === WebSocket.OPEN) ws.send('{}');
    return;
  }

  const push = msg.push;
  if (!push) return;

  const data = push.pub?.data;
  if (!data) return;

  const eventType = data.eventType;

  // Log tous les événements importants (sauf changeCoefficient qui est trop fréquent)
  if (eventType && eventType !== 'changeCoefficient') {
    console.log(`[EVENT] ${eventType} — ${JSON.stringify(data).slice(0, 200)}`);
  }

  switch (eventType) {
    case 'startGame': {
      currentRoundId = data.roundInfo?.id || null;
      currentRoundStart = new Date();
      currentCoeff = 1.0;
      console.log(`[GAME] Nouveau round: ${currentRoundId}`);
      break;
    }
    case 'changeCoefficient': {
      const val = data.current?.[0] ?? data.next?.[0];
      if (val != null) currentCoeff = val;
      break;
    }
    case 'stopCoefficient': {
      // Événement de crash Lucky Jet — finalValue = multiplicateur final
      const finalVal = data.finalValue ?? data.value ?? data.coefficient ?? currentCoeff ?? 1.0;
      addRound(parseFloat(finalVal));
      break;
    }
    case 'changeState': {
      // Garder pour compatibilité mais stopCoefficient est l'event principal
      const crashStates = ['crashed', 'bust', 'finish', 'finished'];
      if (crashStates.includes(data.state?.toLowerCase())) {
        if (currentCoeff) addRound(currentCoeff);
      }
      break;
    }
  }
}

function addRound(multiplier) {
  const round = {
    id: ++roundCounter,
    roundId: currentRoundId,
    time: formatTime(new Date()),
    multiplier: Math.round(multiplier * 100) / 100,
    source: 'LIVE',
    timestamp: Date.now(),
  };
  history.unshift(round);
  if (history.length > MAX_HISTORY) history.pop();
  currentCoeff = null;
  currentRoundId = null;
  console.log(`[ROUND] #${round.id} — ${round.multiplier}x`);
  validatePredictions(round);
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

function sendMsg(obj) {
  if (ws?.readyState === WebSocket.OPEN) {
    obj.id = msgId++;
    ws.send(JSON.stringify(obj));
  }
}

function startPing() {
  // Ne rien faire ici — on répond aux pings du serveur dans processMessage
  // Le serveur Centrifugo envoie {} et attend {} en retour
}

function stopPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

function connectWebSocket(token, channels) {
  if (ws) { try { ws.terminate(); } catch (_) {} }

  console.log('[WS] Connexion à', GATEWAY_WS);
  wsStatus = 'connecting';

  ws = new WebSocket(GATEWAY_WS, {
    headers: { 'Origin': 'https://1play.gamedev-tech.cc' },
    rejectUnauthorized: false,
  });

  ws.on('open', () => {
    console.log('[WS] Connecté ✓');
    wsStatus = 'connected';
    wsError = null;
    sendMsg({ connect: { token, name: 'js', version: '0.15.0' } });
    startPing();
  });

  ws.on('message', (data) => {
    const raw = data.toString();
    try {
      const msg = JSON.parse(raw);
      if (msg.connect?.client) {
        console.log(`[WS] Client Centrifugo: ${msg.connect.client} (canaux auto-souscrits: ${Object.keys(msg.connect.subs || {}).join(', ')})`);
        // NE PAS forcer de subscription — les canaux JWT sont auto-souscrits par le serveur
      }
    } catch (_) {}
    processMessage(raw);
  });

  ws.on('error', (err) => {
    console.error('[WS] Erreur:', err.message);
    wsStatus = 'error';
    wsError = err.message;
    stopPing();
    scheduleReconnect();
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Fermé (${code}): ${reason}. Reconnexion dans 5s...`);
    wsStatus = 'disconnected';
    stopPing();
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(startConnection, 5000);
}

async function startConnection() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try {
    const { mainToken: token, channels } = await authenticate();
    mainToken = token;
    connectWebSocket(token, channels);
  } catch (err) {
    console.error('[AUTH] Erreur:', err.message);
    wsStatus = 'error';
    wsError = err.message;
    scheduleReconnect();
  }
}

// ── Endpoints REST ────────────────────────────────────────────────────────────

app.get('/api/luckyjet', (req, res) => {
  res.json({
    status: wsStatus,
    error: wsError,
    rounds: history,
    current: currentCoeff != null ? { multiplier: currentCoeff } : null,
    total: history.length,
  });
});

app.get('/api/luckyjet/current', (req, res) => {
  res.json({ status: wsStatus, current: currentCoeff, roundId: currentRoundId });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, wsStatus, historySize: history.length });
});

app.get('/api/predictions', (req, res) => {
  // Auto-close expired pending predictions
  const now = Date.now();
  for (const pred of predictions) {
    if (pred.status === 'pending' && now > pred.windowEnd) {
      pred.status = 'fail';
      pred.resolvedAt = now;
      console.log(`[PRED] ❌ ÉCHOUÉE (expired) — Cible ≥${pred.target}x | meilleur: ${pred.bestMultiplier ?? 0}x`);
    }
  }

  const total   = predictions.filter(p => p.status !== 'pending').length;
  const success = predictions.filter(p => p.status === 'success').length;
  const fail    = predictions.filter(p => p.status === 'fail').length;

  // Countdown to next slot
  const SLOT_MS = 5 * 60 * 1000;
  const msUntilNext = SLOT_MS - (now % SLOT_MS);

  res.json({
    predictions: predictions.slice(0, 20),
    score: { total, success, fail, rate: total > 0 ? Math.round((success / total) * 100) : 0 },
    nextPredictionIn: msUntilNext,
    nextPredictionAt: new Date(now + msUntilNext).toTimeString().slice(0, 8),
  });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Serveur Express lancé sur le port ${PORT}`);
  startConnection();
  scheduleNextPrediction();
});

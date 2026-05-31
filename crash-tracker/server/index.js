import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const GATEWAY_HTTP = 'https://crash-gateway-grm-cr.gamedev-tech.cc';
const GATEWAY_WS   = 'wss://crash-gateway-grm-cr.gamedev-tech.cc/websocket/lifecycle';
const MAX_HISTORY  = 100;

// Game token — chargé depuis fichier, env, ou valeur par défaut
const TOKEN_FILE = path.join(__dirname, 'game-token.json');
const TOKEN_DEFAULT = process.env.GAME_TOKEN || '43902aeaf456d9783e548073407c9966192027c9c638b1ca4ad3d8714b08e868b91283398cea8e4a6e09dbc2a72bb456e13703bf68c71e7a3ccc278fc1cfa343184c7ff1cf0929af9cfce9ea32b527c6ec5d1bed8fba0ad368dd8f1bdeed2c767d03c6a9a802e54eb844d895c622a90e67ffebf01d3b94b23e4ceb675d51f8f5f84f01de038b84d58dae795121f0545ffd73b083fb9ba3209e6085db.d3bd3e087e2b9dfc46f3e9c9769003e2.077dee8d-c923-4c02-9bee-757573662e69';

function loadGameToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (token) { console.log('[AUTH] Token chargé depuis le fichier'); return token; }
    }
  } catch {}
  return TOKEN_DEFAULT;
}

function saveGameToken(token) {
  try { fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, updatedAt: new Date().toISOString() })); }
  catch (e) { console.error('[AUTH] Erreur sauvegarde token:', e.message); }
}

let B_TOKEN = loadGameToken();

// Telegram
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TG_ENABLED = !!TG_TOKEN;
const APP_URL    = process.env.APP_URL || 'https://python-1--tvjqjzp7bw.replit.app';

// Subscriber list (persisted to disk)
const SUBS_FILE = path.join(__dirname, 'subscribers.json');
const subscribers = new Map(); // chatId -> { firstName, username, subscribedAt }

function loadSubscribers() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
      for (const s of data) subscribers.set(s.chatId, s);
      console.log(`[TG] ${subscribers.size} abonné(s) chargé(s) depuis le disque`);
    }
  } catch (e) {
    console.error('[TG] Erreur chargement abonnés:', e.message);
  }
  // Always include the owner chat ID
  if (TG_CHAT_ID && !subscribers.has(Number(TG_CHAT_ID))) {
    subscribers.set(Number(TG_CHAT_ID), { chatId: Number(TG_CHAT_ID), firstName: 'Owner', subscribedAt: Date.now() });
    saveSubscribers();
  }
}

function saveSubscribers() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify([...subscribers.values()], null, 2));
  } catch (e) {
    console.error('[TG] Erreur sauvegarde abonnés:', e.message);
  }
}

async function tgApi(method, body) {
  if (!TG_TOKEN) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) {
    console.error(`[TG] Exception ${method}:`, e.message);
    return { ok: false };
  }
}

async function sendTelegramTo(chatId, text, extra = {}) {
  if (!TG_ENABLED) return;
  const r = await tgApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
  if (!r.ok) {
    console.error(`[TG] Échec envoi à ${chatId}: ${r.description || 'inconnu'}`);
    // Auto-remove if user blocked the bot
    if (r.description && (r.description.includes('blocked') || r.description.includes('not found') || r.description.includes('deactivated'))) {
      subscribers.delete(chatId);
      saveSubscribers();
      console.log(`[TG] Abonné ${chatId} retiré (${r.description})`);
    }
  }
}

async function broadcastTelegram(text) {
  if (!TG_ENABLED || subscribers.size === 0) return;
  const ids = [...subscribers.keys()];
  await Promise.all(ids.map(id => sendTelegramTo(id, text)));
}

// Backwards-compatible alias used elsewhere in the file
const sendTelegram = broadcastTelegram;

// ── /start command handler + long-polling ─────────────────────────────────────
let tgUpdateOffset = 0;

async function handleTelegramUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat) return;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  if (text === '/start' || text === '/start@' + (msg.via_bot?.username || '')) {
    const isNew = !subscribers.has(chatId);
    subscribers.set(chatId, {
      chatId,
      firstName: msg.chat.first_name || '',
      username: msg.chat.username || '',
      subscribedAt: Date.now(),
    });
    saveSubscribers();
    console.log(`[TG] ${isNew ? 'Nouvel abonné' : 'Abonné existant'}: ${chatId} (@${msg.chat.username || '?'}) — total: ${subscribers.size}`);

    const welcome = isNew
      ? `🎉 <b>Bienvenue sur Lucky Jet Tracker !</b>\n\n` +
        `Vous êtes maintenant abonné aux signaux automatiques :\n` +
        `🚀 Une nouvelle prédiction toutes les 5 minutes\n` +
        `✅ Résultat ❌ ou ✅ dès la fin de la fenêtre\n\n` +
        `Touchez le bouton ci-dessous pour ouvrir l'application complète.`
      : `🚀 <b>Lucky Jet Tracker</b>\n\nVous êtes déjà abonné. Touchez le bouton ci-dessous pour ouvrir l'application.`;

    await sendTelegramTo(chatId, welcome, {
      reply_markup: {
        inline_keyboard: [[{ text: '🚀 Ouvrir l\'application', web_app: { url: APP_URL } }]],
      },
    });

    // Set the persistent menu button for this user
    await tgApi('setChatMenuButton', {
      chat_id: chatId,
      menu_button: { type: 'web_app', text: '🚀 Lucky Jet', web_app: { url: APP_URL } },
    });
  } else if (text === '/stop') {
    if (subscribers.delete(chatId)) {
      saveSubscribers();
      console.log(`[TG] Abonné ${chatId} désinscrit — total: ${subscribers.size}`);
      await sendTelegramTo(chatId, '👋 Vous ne recevrez plus de prédictions. Tapez /start à tout moment pour vous réabonner.');
    }
  } else if (text === '/stats') {
    await sendTelegramTo(chatId, `📊 <b>Stats du bot</b>\n\nAbonnés actifs : ${subscribers.size}\nTours en historique : ${history.length}\nPrédictions enregistrées : ${predictions.length}\nStatut connexion : ${wsStatus}`);

  } else if (text.startsWith('/settoken')) {
    // Owner only
    if (chatId !== Number(TG_CHAT_ID)) {
      await sendTelegramTo(chatId, '⛔ Commande réservée à l\'administrateur.');
      return;
    }
    const newToken = text.replace('/settoken', '').trim();
    if (!newToken) {
      await sendTelegramTo(chatId,
        '🔑 <b>Mise à jour du token de connexion</b>\n\n' +
        'Envoyez la commande suivie de votre token :\n' +
        '<code>/settoken VOTRE_TOKEN_ICI</code>\n\n' +
        '<b>Comment trouver votre token sur iPhone :</b>\n' +
        '1. Ouvrez Safari → allez sur 1win.com\n' +
        '2. Connectez-vous et ouvrez Lucky Jet\n' +
        '3. Dans la barre d\'URL, tapez exactement :\n' +
        '<code>javascript:void(fetch("/user/auth").then(r=>r.text()).then(t=>alert(t.slice(0,100))))</code>\n\n' +
        'Ou utilisez l\'app Replit → Secrets → GAME_TOKEN pour le coller directement.'
      );
      return;
    }
    B_TOKEN = newToken;
    saveGameToken(newToken);
    console.log('[AUTH] Token mis à jour via Telegram — reconnexion...');
    await sendTelegramTo(chatId, '✅ Token mis à jour ! Reconnexion au serveur de jeu en cours...');
    wsStatus = 'reconnecting';
    wsError = null;
    if (ws) try { ws.terminate(); } catch {}
    if (reconnectTimer) clearTimeout(reconnectTimer);
    startConnection();
  }
}

async function pollTelegramUpdates() {
  if (!TG_TOKEN) return;
  try {
    const r = await tgApi('getUpdates', {
      offset: tgUpdateOffset,
      timeout: 25,
      allowed_updates: ['message'],
    });
    if (r.ok && Array.isArray(r.result)) {
      for (const u of r.result) {
        tgUpdateOffset = u.update_id + 1;
        try { await handleTelegramUpdate(u); } catch (e) { console.error('[TG] handler error:', e.message); }
      }
    }
  } catch (e) {
    console.error('[TG] poll error:', e.message);
  }
  setImmediate(pollTelegramUpdates);
}

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

  // Telegram notification
  const levelEmoji = pred.level === 'PRUDENCE' ? '🟡' : pred.level === 'MAX' ? '🟢' : '🔵';
  const msg =
    `🚀 <b>NOUVELLE PRÉDICTION LUCKY JET</b>\n\n` +
    `${levelEmoji} <b>Cible :</b> ≥ ${pred.target}x\n` +
    `📊 <b>Niveau :</b> ${pred.level}\n` +
    `📡 <b>Signal :</b> ${pred.signal}\n` +
    `🎯 <b>Confiance :</b> ${pred.confidence}%\n` +
    `⏱ <b>Fenêtre de jeu :</b> ${pred.windowStartFmt} → ${pred.windowEndFmt}\n` +
    `\n` +
    `📈 Accumulation : ${pred.accDurMin} min | Crashes ×1 : ${pred.onesInAcc} | Moy 10 : ${pred.avg10}x\n` +
    (pred.note ? `\nℹ️ ${pred.note}` : '');
  sendTelegram(msg);
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
        sendTelegram(
          `✅ <b>PRÉDICTION RÉUSSIE</b>\n\n` +
          `🎯 Cible : ≥ ${pred.target}x\n` +
          `🚀 Atteinte avec : <b>${round.multiplier}x</b>\n` +
          `⏱ Fenêtre : ${pred.windowStartFmt} → ${pred.windowEndFmt}\n` +
          `📡 Signal initial : ${pred.signal} (${pred.confidence}%)`
        );
      }
    }

    // Window has closed — resolve as fail if still pending
    if (pred.status === 'pending' && now > pred.windowEnd) {
      pred.status = 'fail';
      pred.resolvedAt = now;
      console.log(`[PRED] ❌ ÉCHOUÉE — Cible ≥${pred.target}x non atteinte (meilleur: ${pred.bestMultiplier ?? 0}x)`);
      sendTelegram(
        `❌ <b>PRÉDICTION ÉCHOUÉE</b>\n\n` +
        `🎯 Cible : ≥ ${pred.target}x\n` +
        `📉 Meilleur résultat : ${pred.bestMultiplier ?? 0}x\n` +
        `⏱ Fenêtre : ${pred.windowStartFmt} → ${pred.windowEndFmt}\n` +
        `📡 Signal initial : ${pred.signal} (${pred.confidence}%)`
      );
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

let reconnectDelay = 5000;

function scheduleReconnect(delay = reconnectDelay) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  // Backoff: 5s → 15s → 30s → 60s max when auth keeps failing
  reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  console.log(`[AUTH] Nouvelle tentative dans ${Math.round(delay / 1000)}s`);
  reconnectTimer = setTimeout(startConnection, delay);
}

async function startConnection() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectDelay = 5000; // reset on each manual call
  try {
    const { mainToken: token, channels } = await authenticate();
    mainToken = token;
    wsError = null;
    reconnectDelay = 5000;
    connectWebSocket(token, channels);
  } catch (err) {
    console.error('[AUTH] Erreur:', err.message);
    wsStatus = 'error';
    wsError = err.message;
    // If token is bad (1010), wait longer before retry
    const isBadToken = err.message.includes('1010') || err.message.includes('Something went wrong');
    scheduleReconnect(isBadToken ? 60000 : reconnectDelay);
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

// Serve built frontend in production
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).end();
  });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API] Serveur Express lancé sur le port ${PORT}`);
  if (TG_ENABLED) {
    loadSubscribers();
    console.log(`[TG] Bot Telegram activé — ${subscribers.size} abonné(s)`);
    pollTelegramUpdates();
    // Set the bot's command list (autocomplete in Telegram)
    tgApi('setMyCommands', {
      commands: [
        { command: 'start',    description: "S'abonner et ouvrir l'application" },
        { command: 'stop',     description: 'Se désabonner des prédictions' },
        { command: 'stats',    description: 'Voir les stats du bot' },
        { command: 'settoken', description: '(Admin) Mettre à jour le token de connexion' },
      ],
    });
    sendTelegram(
      `🤖 <b>Lucky Jet Tracker reconnecté</b>\n\n` +
      `Le bot est prêt à envoyer les prochaines prédictions.\n` +
      `Bonne chance ! 🚀`
    );
  } else {
    console.log(`[TG] Bot Telegram désactivé (TELEGRAM_BOT_TOKEN manquant)`);
  }
  startConnection();
  scheduleNextPrediction();
});

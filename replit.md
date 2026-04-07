# CrashTracker

Un tracker de jeu Crash en temps réel avec prédictions et statistiques.

## Architecture

- **Frontend**: React + TypeScript + Vite (port 5000)
- **Répertoire**: `crash-tracker/`

## Fonctionnalités

- **Prédiction prochain tour**: Plage de multiplicateurs prédite avec indice de confiance, stratégie (REBOND / PRUDENCE), et moyenne récente
- **Statistiques**: Moyenne, meilleur, plus bas, nombre de tours, barres de progression pour ≥ 2x, ≥ 5x, ≥ 10x
- **Historique des tours**: Graphique à barres colorées selon le multiplicateur (orange < 2x, bleu 2–5x, vert 5–10x, violet > 10x)
- **Tableau des tours**: Affichage des 10 derniers tours avec numéro, heure, multiplicateur et source (LIVE / HIST)
- **Mode LIVE/PAUSE**: Nouveaux tours générés toutes les 5 secondes automatiquement

## Structure des fichiers

```
crash-tracker/src/
├── App.tsx              # Composant principal
├── index.css            # Styles globaux (thème sombre)
├── types.ts             # Interfaces TypeScript
├── utils.ts             # Génération de données, calculs de stats et prédictions
└── components/
    ├── PredictionCard.tsx   # Carte de prédiction
    ├── StatsPanel.tsx       # Panneau de statistiques
    ├── HistoryChart.tsx     # Graphique historique
    └── RoundTable.tsx       # Tableau des tours
```

## Démarrage

```bash
cd crash-tracker && npm run dev
```

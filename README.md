# KnotQuite

A NYT Connections clone built with Electron and React. Group 16 words into 4 categories of 4 — watch out for red herrings!

## Features

- **Daily Puzzle** — a new puzzle every day, same for all players
- **Random Mode** — infinite random puzzles from the pool
- **Stats Tracking** — games played, win %, streaks, mistake distribution
- **Share Results** — copy an emoji grid to your clipboard
- **Responsive** — works on both desktop and mobile-sized windows

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite dev server and launches Electron. Hot-reload is enabled for the renderer.

### Build

```bash
npm run build
```

Compiles the React renderer (via Vite) and the Electron main process (via TypeScript).

### Package

```bash
npm run package
```

Produces a distributable Electron binary via electron-builder.

## How to Play

1. Look at the 16 words on the board
2. Select 4 words you think belong to the same category
3. Press **Submit** to check your guess
4. Correct guesses reveal the category as a colored row
5. You get 4 mistakes — after that, the game is over
6. Find all 4 groups to win!

**Difficulty colors:** 🟨 Yellow (easiest) → 🟩 Green → 🟦 Blue → 🟪 Purple (hardest)

## Project Structure

```
src/
  main/
    main.ts              # Electron main process
    preload.ts           # Context bridge
  renderer/
    index.html           # HTML entry point
    main.tsx             # React entry point
    App.tsx              # Root component
    types/
      puzzle.ts          # TypeScript types & constants
    hooks/
      usePuzzle.ts       # Puzzle loading, daily/random modes
      useGameState.ts    # Core game state machine
      useStats.ts        # Stats persistence
    components/
      WordGrid.tsx       # 4×4 grid layout
      WordTile.tsx       # Individual word tile
      SolvedGroup.tsx    # Revealed category row
      Controls.tsx       # Shuffle / Deselect / Submit
      MistakeTracker.tsx # Remaining mistakes dots
      GameOverModal.tsx  # Win/lose screen with share
      HelpModal.tsx      # How to play
      StatsModal.tsx     # Statistics display
      Toast.tsx          # "One away..." notification
    styles/
      global.css         # All styles
  data/
    puzzles.json         # Bundled puzzle data
```

## Adding Puzzles

See [GAMESPROMPT.md](GAMESPROMPT.md) for the puzzle JSON schema and instructions. You can add puzzles by appending to `src/data/puzzles.json`.

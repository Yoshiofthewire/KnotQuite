# KnotQuite - A Clone of NYT Connections for Desktop and Mobile

## Original Requirements

1. A NYT Connections Clone electron app
2. 4 sets of 4 words connected by meaning, use, purpose, or task
3. All 4 sets should have an overarching theme
4. There should be a red herring with a set of 3 words made across sets
5. The word sets of 4 words should be precomputed and then added together at random

## Implemented Features

### Core Game
- Electron app with React frontend (Vite bundler, TypeScript)
- 4×4 word grid — select 4 words and submit to guess a group
- 4 color-coded difficulty levels: yellow (easy) → green → blue → purple (hard)
- "One away" toast when 3 of 4 selected words belong to the same group
- Maximum 4 mistakes before losing
- Shuffle remaining tiles, deselect all, submit controls
- Win/lose modals with emoji share grid (copies to clipboard)
- Solved groups animate into colored rows sorted by difficulty

### Daily Puzzle Mode
- Deterministic date-seeded puzzle selection — same puzzle for all players each day
- Tracks daily completion in localStorage — prevents replaying today's puzzle
- "Come back tomorrow" screen when daily is already completed
- Toggle between Daily and Random modes

### Random Mode
- Random puzzle selection from the pool, avoiding recently played puzzles
- Replay avoidance via localStorage tracking
- New game button for infinite play

### Stats Persistence
- Games played, games won, current streak, max streak
- Mistake distribution chart (0–4 mistakes)
- All stats persisted to localStorage
- Stats modal accessible from the header

### Puzzle Data
- 20 hand-crafted seed puzzles bundled as JSON
- Each puzzle has: overarching theme, 4 groups of 4 words, 1 red herring (3 words across groups suggesting a false category)
- See `GAMESPROMPT.md` for the schema and instructions on adding more puzzles

### UI/UX
- NYT Connections-style design (off-white background, rounded tiles, colored group rows)
- Animations: tile bounce on select, shake on wrong guess, slide-down on correct group
- Responsive layout: works from 360px to desktop widths
- Help modal explaining the rules

## Tech Stack
- **Runtime:** Electron
- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Vanilla CSS with CSS custom properties
- **Data:** Static JSON bundled with the app
- **Persistence:** localStorage (stats, daily state, played puzzles)


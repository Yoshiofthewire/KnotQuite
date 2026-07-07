import React, { useState, useCallback, useEffect, useRef } from 'react';
import { usePuzzle, isDailyCompleted, markDailyCompleted, GameMode } from './hooks/usePuzzle';
import { useGameState } from './hooks/useGameState';
import { useStats } from './hooks/useStats';
import { WordGrid } from './components/WordGrid';
import { SolvedGroup } from './components/SolvedGroup';
import { Controls } from './components/Controls';
import { MistakeTracker } from './components/MistakeTracker';
import { GameOverModal } from './components/GameOverModal';
import { HelpModal } from './components/HelpModal';
import { StatsModal } from './components/StatsModal';
import { Toast } from './components/Toast';
import './styles/global.css';

const App: React.FC = () => {
  const { puzzle, shuffledWords, mode, newGame, shuffleWords, switchMode } = usePuzzle('daily');
  const [state, actions] = useGameState(puzzle, shuffledWords);
  const { stats, recordGame } = useStats();

  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [dailyDone, setDailyDone] = useState(() => isDailyCompleted());
  const gameRecorded = useRef(false);

  // Sync game state when puzzle changes
  useEffect(() => {
    actions.resetGame(puzzle, shuffledWords);
    gameRecorded.current = false;
    setShowGameOver(false);
    if (mode === 'daily') {
      setDailyDone(isDailyCompleted());
    }
  }, [puzzle, shuffledWords]);

  // Show game over modal when game ends & record stats
  useEffect(() => {
    if (state.status === 'won' || state.status === 'lost') {
      if (!gameRecorded.current) {
        gameRecorded.current = true;
        const mistakesUsed = 4 - state.mistakesRemaining;
        recordGame(state.status === 'won', mistakesUsed);
        if (mode === 'daily') {
          markDailyCompleted(state.status === 'won');
          setDailyDone(true);
        }
      }
      const timer = setTimeout(() => setShowGameOver(true), 600);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const handleWordClick = useCallback(
    (word: string) => {
      if (state.selectedWords.includes(word)) {
        actions.deselectWord(word);
      } else {
        actions.selectWord(word);
      }
    },
    [state.selectedWords, actions]
  );

  const handleSubmit = useCallback(() => {
    const result = actions.submitGuess();
    console.log('Submit result:', result);

    if (result.status === 'wrong') {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);

      if (result.distance !== undefined) {
        if (result.distance === 1) {
          showToast('One away...');
        } else {
          showToast('Not quite...');
        }
      }
    } else if (result.status === 'correct') {
      console.log('Correct guess!');
    }
  }, [actions, showToast]);

  const handleShuffle = useCallback(() => {
    const solvedWords = state.solvedGroups.flatMap((g) => g.words);
    shuffleWords(solvedWords);
  }, [state.solvedGroups, shuffleWords]);

  const handleNewGame = useCallback(() => {
    setShowGameOver(false);
    if (mode === 'random') {
      newGame();
    } else {
      switchMode('random');
    }
  }, [mode, newGame, switchMode]);

  const handleModeSwitch = useCallback(
    (newMode: GameMode) => {
      if (newMode === mode) return;
      setShowGameOver(false);
      switchMode(newMode);
    },
    [mode, switchMode]
  );

  return (
    <>
      <header className="header">
        <h1 className="header__title">KnotQuite</h1>
        <div className="header__actions">
          <button className="header__btn" onClick={() => setShowStats(true)} title="Statistics">
            &#x1F4CA;
          </button>
          <button className="header__btn" onClick={() => setShowHelp(true)} title="How to play">
            ?
          </button>
          {mode === 'random' && (
            <button className="header__btn" onClick={handleNewGame} title="New game">
              +
            </button>
          )}
        </div>
      </header>

      <div className="mode-toggle">
        <button
          className={`mode-toggle__btn ${mode === 'daily' ? 'mode-toggle__btn--active' : ''}`}
          onClick={() => handleModeSwitch('daily')}
        >
          Daily
        </button>
        <button
          className={`mode-toggle__btn ${mode === 'random' ? 'mode-toggle__btn--active' : ''}`}
          onClick={() => handleModeSwitch('random')}
        >
          Random
        </button>
      </div>

      {mode === 'daily' && dailyDone && state.status === 'playing' ? (
        <div className="daily-done">
          <p className="daily-done__text">You've already completed today's puzzle!</p>
          <p className="daily-done__sub">Come back tomorrow for a new daily, or try a random game.</p>
          <button
            className="controls__btn controls__btn--submit"
            onClick={() => handleModeSwitch('random')}
          >
            Play Random
          </button>
        </div>
      ) : (
        <main className="game-board">
          {state.solvedGroups
            .sort((a, b) => a.difficulty - b.difficulty)
            .map((group) => (
              <SolvedGroup key={group.name} group={group} />
            ))}

          <div className={shaking ? 'shake' : ''}>
            <WordGrid
              words={shuffledWords}
              selectedWords={state.selectedWords}
              solvedGroups={state.solvedGroups}
              onWordClick={handleWordClick}
            />
          </div>

          <MistakeTracker mistakesRemaining={state.mistakesRemaining} maxMistakes={4} />

          <Controls
            selectedCount={state.selectedWords.length}
            canSubmit={state.selectedWords.length === 4}
            isPlaying={state.status === 'playing'}
            onShuffle={handleShuffle}
            onDeselectAll={actions.deselectAll}
            onSubmit={handleSubmit}
          />
        </main>
      )}

      <Toast message={toast ?? ''} visible={toast !== null} />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showStats && <StatsModal stats={stats} onClose={() => setShowStats(false)} />}

      {showGameOver && (state.status === 'won' || state.status === 'lost') && (
        <GameOverModal
          status={state.status}
          groups={[...puzzle.groups]}
          solvedGroups={state.solvedGroups}
          guessHistory={state.guessHistory}
          onNewGame={handleNewGame}
        />
      )}
    </>
  );
};

export default App;

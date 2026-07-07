export type DifficultyColor = 'yellow' | 'green' | 'blue' | 'purple';

export interface Group {
  name: string;
  words: [string, string, string, string];
  difficulty: 1 | 2 | 3 | 4;
  color: DifficultyColor;
}

export interface RedHerring {
  falseCategoryName: string;
  words: [string, string, string];
}

export interface Puzzle {
  id: number;
  theme: string;
  groups: [Group, Group, Group, Group];
  redHerring: RedHerring;
  type?: 'daily' | 'random';
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  puzzle: Puzzle;
  shuffledWords: string[];
  selectedWords: string[];
  solvedGroups: Group[];
  mistakesRemaining: number;
  status: GameStatus;
  guessHistory: string[][];
}

export const DIFFICULTY_COLORS: Record<number, DifficultyColor> = {
  1: 'yellow',
  2: 'green',
  3: 'blue',
  4: 'purple',
};

export const COLOR_HEX: Record<DifficultyColor, string> = {
  yellow: '#f9df6d',
  green: '#a0c35a',
  blue: '#b0c4ef',
  purple: '#ba81c5',
};

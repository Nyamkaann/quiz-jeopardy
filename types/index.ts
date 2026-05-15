export interface Question {
  id: string;
  value: number;
  clue: string;
  answer: string;
  isDailyDouble: boolean;
  answered: boolean;
  clueImage?: string;      // legacy single – kept for backward compat
  clueImages?: string[];   // multi-image support
  clueAudio?: string;
  answerImage?: string;    // legacy single
  answerImages?: string[]; // multi-image support
  answerAudio?: string;
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface Game {
  id: string;
  title: string;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameSession {
  gameId: string;
  players: Player[];
  currentQuestion: Question | null;
  currentCategory: string | null;
  answeredQuestions: string[];
}

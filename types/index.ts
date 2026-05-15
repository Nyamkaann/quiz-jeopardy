export interface Question {
  id: string;
  value: number;
  clue: string;
  answer: string;
  isDailyDouble: boolean;
  answered: boolean;
  clueImage?: string;
  clueAudio?: string;
  answerImage?: string;
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

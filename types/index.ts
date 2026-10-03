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
  explanation?: string;   // «Яагаад?» — shown under the revealed answer
  connect?: ConnectData;   // only used when the category type is "connect"
}

export type CategoryType = "normal" | "connect";

export interface Category {
  id: string;
  name: string;
  type?: CategoryType;     // undefined = "normal"
  questions: Question[];
}

/* ── Connect round ── */
export interface ConnectClue {
  id: string;
  text?: string;
  image?: string;
  audio?: string;
  note?: string; // shown on the card once the round is over: how this clue links to the answer
}

/** Payload of a tile that lives in a "connect" category */
export interface ConnectData {
  clues: ConnectClue[]; // up to 5, revealed one by one (1000 → 200)
  answer: string;
  answerImage?: string;
  explanation?: string;  // how the clues link to the answer
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = root
  createdAt: string;
}

export interface Game {
  id: string;
  title: string;
  folderId?: string | null; // null / undefined = root
  timerSeconds?: number;     // clue countdown length (default 60)
  timerMusic?: string;       // uploaded countdown track; empty = built-in loop
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

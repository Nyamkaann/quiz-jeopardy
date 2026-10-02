import type { ConnectState } from "@/components/ConnectRound";
import type { Game, Player, Question } from "@/types";

/**
 * Host ⇄ audience-screen sync.
 * Both windows run in the same browser on the host's laptop, so a
 * BroadcastChannel is enough — no server, no network, no lag.
 */
export const displayChannelName = (gameId: string) => `astro-display-${gameId}`;

export type Phase = "setup" | "board" | "clue" | "connect" | "final";

/** Everything the audience screen needs to draw itself. */
export interface DisplaySnapshot {
  game: Game;
  players: Player[];
  phase: Phase;
  activeQ: { catId: string; q: Question } | null;
  showAnswer: boolean;
  buzzed: string | null;
  wrongPlayers: string[];
  finalClue: string;
  finalAnswer: string;
  finalPhase: "wager" | "clue" | "answer" | "results";
  connectState: ConnectState;
  timeLeft: number;
  timerTotal: number;
  timerState: "idle" | "running" | "paused" | "done";
  fx: { kind: "good" | "bad"; k: number } | null;
}

export type DisplayMessage =
  | { type: "state"; snapshot: DisplaySnapshot } // host → display
  | { type: "hello" } // display → host ("I'm here, send state")
  | { type: "bye" } // display closed
  | { type: "off" }; // host switched to single-screen mode

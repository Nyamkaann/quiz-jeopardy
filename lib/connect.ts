import { Category, ConnectClue, ConnectData } from "@/types";

/** Points available after revealing clue 1, 2, 3, 4, 5 */
export const CONNECT_POINTS = [1000, 800, 600, 400, 200] as const;
/** Deducted for a wrong guess */
export const CONNECT_PENALTY = 250;
export const CONNECT_CLUES = CONNECT_POINTS.length;

export function isConnectCategory(c?: Category | null): boolean {
  return c?.type === "connect";
}

export function emptyClue(): ConnectClue {
  return { id: crypto.randomUUID(), text: "" };
}

export function newConnectData(): ConnectData {
  return {
    clues: Array.from({ length: CONNECT_CLUES }, emptyClue),
    answer: "",
  };
}

export function clueIsEmpty(c?: ConnectClue): boolean {
  return !c || (!c.text?.trim() && !c.image && !c.audio);
}

/** Clues that actually have content, in order */
export function playableClues(d?: ConnectData): ConnectClue[] {
  return (d?.clues ?? []).filter((c) => !clueIsEmpty(c)).slice(0, CONNECT_CLUES);
}

export function connectIsEmpty(d?: ConnectData): boolean {
  return playableClues(d).length === 0;
}

import { Question } from "@/types";

export function getClueImages(q: Question): string[] {
  const legacy = q.clueImage ? [q.clueImage] : [];
  return [...legacy, ...(q.clueImages ?? [])];
}

export function getAnswerImages(q: Question): string[] {
  const legacy = q.answerImage ? [q.answerImage] : [];
  return [...legacy, ...(q.answerImages ?? [])];
}

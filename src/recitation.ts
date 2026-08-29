import type { RecitationPhase, Stage } from "./types";

export const SPEEDS = [
  { value: 1, label: "Very slow", ms: 650 },
  { value: 2, label: "Slow", ms: 550 },
  { value: 3, label: "Medium", ms: 450 },
  { value: 4, label: "Brisk", ms: 370 },
  { value: 5, label: "Fast", ms: 300 },
] as const;

export interface AnswerToken {
  text: string;
  word: boolean;
  delay: number;
}

const CONNECTORS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "he", "her", "him", "his",
  "i", "in", "is", "it", "its", "of", "on", "or", "our", "she", "that", "the", "their", "them",
  "they", "this", "to", "us", "we", "what", "who", "with", "you", "your",
]);

export function wordShapeMultiplier(word: string) {
  const letters = word.toLocaleLowerCase().replace(/[^a-z]/g, "");
  if (CONNECTORS.has(letters)) return 0.78;
  if (letters.length <= 3) return 0.9;
  if (letters.length <= 7) return 1;
  if (letters.length <= 11) return 1.12;
  return 1.2;
}

export type RecitationRegion = "question" | "answer";
export type TimelineStep =
  | { kind: "word"; region: RecitationRegion; tokenIndex: number; delay: number }
  | { kind: "boundary"; delay: number };

export function clampSpeed(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(5, Math.max(1, Math.round(parsed))) : 3;
}

export function tokenizeAnswer(answer: string, speed = 3): AnswerToken[] {
  const base = SPEEDS[clampSpeed(speed) - 1].ms;
  const pieces = answer.match(/\s+|\S+/g) ?? [];
  return pieces.map((text, index) => {
    if (/^\s+$/.test(text)) return { text, word: false, delay: 0 };
    let pause = 0;
    if (/[.!?][”’"']?$/.test(text)) pause = 420;
    else if (/[:;][”’"']?$/.test(text)) pause = 260;
    else if (/,[”’"']?$/.test(text)) pause = 180;
    const following = pieces[index + 1] ?? "";
    if (/\n/.test(following)) pause = Math.max(pause, 250);
    const spoken = Math.min(base * 1.25, Math.round(base * wordShapeMultiplier(text)));
    return { text, word: true, delay: spoken + pause };
  });
}

export function wordTokenIndexes(tokens: readonly AnswerToken[]) {
  return tokens.flatMap((token, index) => (token.word ? [index] : []));
}

export function revealStagger(answer: string) {
  const count = wordTokenIndexes(tokenizeAnswer(answer)).length;
  return count <= 1 ? 0 : Math.round(Math.min(90, Math.max(60, 2500 / (count - 1))));
}

export function buildRecitationTimeline(question: string, answer: string, speed = 3): TimelineStep[] {
  const questionTokens = tokenizeAnswer(question, speed);
  const answerTokens = tokenizeAnswer(answer, speed);
  const words = (tokens: readonly AnswerToken[], region: RecitationRegion): TimelineStep[] =>
    wordTokenIndexes(tokens).map((tokenIndex) => ({ kind: "word", region, tokenIndex, delay: tokens[tokenIndex].delay }));
  return [...words(questionTokens, "question"), { kind: "boundary", delay: 500 }, ...words(answerTokens, "answer")];
}

export function nextCountdownStep(step: number): number | "recite" {
  return step >= 3 ? "recite" : step + 1;
}

export function isRecitable(stage: Stage) {
  return ["review", "say", "challenge"].includes(stage.kind);
}

export function initialPhase(stage: Stage): RecitationPhase {
  if (stage.kind === "meet") return "hidden";
  if (!isRecitable(stage)) return "ready";
  return stage.kind === "say" ? "ready" : "hidden";
}

export function phaseAction(
  phase: RecitationPhase,
  action: "advance" | "back" | "countdown-done" | "words-done",
): RecitationPhase {
  if (action === "back") return phase === "hidden" || phase === "ready" ? phase : "ready";
  if (action === "countdown-done") return phase === "countdown" ? "reciting" : phase;
  if (action === "words-done") return phase === "reciting" ? "complete" : phase;
  if (phase === "hidden") return "ready";
  if (phase === "ready") return "countdown";
  if (phase === "countdown" || phase === "reciting") return "paused";
  if (phase === "paused") return "reciting";
  return phase;
}

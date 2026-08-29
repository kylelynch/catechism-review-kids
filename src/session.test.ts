import { describe, expect, it } from "vitest";
import {
  buildStages,
  olderReview,
  paginateScripture,
  selectReviews,
  selectVariations,
} from "./session";
import { questions } from "./data/catechism.generated";
import type { Question } from "./types";
import { buildRecitationTimeline, clampSpeed, initialPhase, isRecitable, nextCountdownStep, phaseAction, revealStagger, SPEEDS, tokenizeAnswer, wordShapeMultiplier, wordTokenIndexes } from "./recitation";
const data = questions as unknown as Question[];
describe("session planning", () => {
  it("selects deterministic distinct review and variations", () => {
    expect(olderReview(12, data)).toEqual(olderReview(12, data));
    const v = selectVariations(8);
    expect(v).toEqual(selectVariations(8));
    expect(v).toHaveLength(2);
    expect(new Set(v.map((x) => x.id)).size).toBe(2);
  });
  it("does not duplicate review when history is insufficient", () => {
    expect(
      buildStages(1, data).filter((s) => s.kind === "review"),
    ).toHaveLength(0);
    const q2 = buildStages(2, data).filter((s) => s.kind === "review");
    expect(q2).toHaveLength(1);
    expect(q2[0].question?.number).toBe(1);
    for (const n of [1, 2, 3]) {
      const stages = buildStages(n, data),
        current = data[n - 1];
      const reviews = stages
        .filter((s) => s.kind === "review")
        .map((s) => s.question!.id);
      expect(reviews).not.toContain(current.id);
      expect(new Set(reviews).size).toBe(reviews.length);
    }
  });
  it("supports optional bounded review with strict stage order", () => {
    expect(selectReviews(10, 0, data)).toEqual([]);
    expect(selectReviews(10, 1, data)).toHaveLength(1);
    const five = selectReviews(10, 5, data);
    expect(five).toHaveLength(5);
    expect(new Set(five.map((q) => q.id)).size).toBe(5);
    expect(five.every((q) => q.number < 10)).toBe(true);
    expect(selectReviews(3, 5, data)).toHaveLength(2);
    expect(selectReviews(10, 5, data)).toEqual(selectReviews(10, 5, data));
    for (const count of [0, 1, 5]) {
      const kinds = buildStages(10, data, count).map((s) => s.kind);
      expect(kinds).not.toContain("ready");
      expect(kinds.slice(0, count).every((k) => k === "review")).toBe(true);
      expect(kinds[count]).toBe("meet");
      const ritual = kinds.slice(count);
      expect(ritual.slice(0, 3)).toEqual(["meet", "say", "say"]);
      expect(ritual.slice(-2)).toEqual(["challenge", "close"]);
    }
  });
  it("preserves full answers and current question across all say stages", () => {
    for (let n = 1; n <= 62; n++) {
      const stages = buildStages(n, data);
      for (const s of stages.filter((s) => s.question))
        expect(s.question?.answer).toBe(data[s.question!.number - 1].answer);
      const sayStages = stages.filter((s) => s.kind === "say");
      expect(sayStages).toHaveLength(2);
      expect(new Set(sayStages.map((s) => s.variation?.id)).size).toBe(2);
      for (const s of sayStages)
        expect(s.question?.question).toBe(data[n - 1].question);
      expect(stages.filter((s) => s.kind === "close")).toHaveLength(1);
      expect(stages.at(-1)?.kind).toBe("close");
    }
  });
  it("does not display candidate text for unresolved references", () => {
    const stages = buildStages(14, data);
    expect(stages.some((s) => s.kind === "scripture-pending")).toBe(true);
    expect(stages.some((s) => s.scriptureText)).toBe(false);
  });
  it("paginates long verified Scripture at verse boundaries", () => {
    const q = data[20];
    const pages = paginateScripture(q.scripture.text);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((p) => /^\[\d+\]/.test(p))).toBe(true);
    expect(pages.join("\n\n").replace(/\s/g, "")).toBe(
      q.scripture.text.replace(/\s/g, ""),
    );
  });
  it("flows Scripture directly into the final memory challenge", () => {
    for (const n of [14, 21]) {
      const stages = buildStages(n, data, 0);
      expect(stages.some((s) => s.kind === "discuss")).toBe(false);
      const scriptureIndexes = stages
        .map((s, i) => (s.kind.startsWith("scripture") ? i : -1))
        .filter((i) => i >= 0);
      expect(stages[Math.max(...scriptureIndexes) + 1].kind).toBe("challenge");
      expect(stages[Math.max(...scriptureIndexes) + 2].kind).toBe("close");
    }
  });
});

describe("guided recitation", () => {
  it("reconstructs every canonical answer byte for byte", () => {
    for (const question of data) {
      expect(tokenizeAnswer(question.question).map((token) => token.text).join("")).toBe(question.question);
      expect(tokenizeAnswer(question.answer).map((token) => token.text).join("")).toBe(question.answer);
      const timeline = buildRecitationTimeline(question.question, question.answer);
      expect(timeline.filter((step) => step.kind === "boundary")).toEqual([{ kind: "boundary", delay: 500 }]);
      expect(timeline.find((step) => step.kind === "word")?.region).toBe("question");
      const last = timeline.at(-1);
      expect(last?.kind === "word" && last.region).toBe("answer");
    }
  });
  it("uses the five specified speed timings and deterministic largest pauses", () => {
    expect(SPEEDS.map((speed) => speed.ms)).toEqual([650, 550, 450, 370, 300]);
    expect(tokenizeAnswer("one, two; three.\nfour", 3).filter((t) => t.word).map((t) => t.delay)).toEqual([585, 665, 870, 450]);
    expect(tokenizeAnswer("one,\ntwo", 3)[0].delay).toBe(655);
    expect(wordShapeMultiplier("the")).toBeLessThan(wordShapeMultiplier("grace"));
    expect(wordShapeMultiplier("grace")).toBeLessThan(wordShapeMultiplier("sanctification"));
    expect(tokenizeAnswer("the grace sanctification", 3).filter((t) => t.word).map((t) => t.delay)).toEqual([351, 450, 540]);
    expect(tokenizeAnswer("extraordinarily", 3)[0].delay).toBeLessThanOrEqual(563);
    for (const word of ["the", "grace", "sanctification."])
      expect([1,2,3,4].every((speed) => tokenizeAnswer(word, speed)[0].delay > tokenizeAnswer(word, speed + 1)[0].delay)).toBe(true);
    expect(tokenizeAnswer("the grace sanctification", 3)).toEqual(tokenizeAnswer("the grace sanctification", 3));
    expect(clampSpeed(0)).toBe(1);
    expect(clampSpeed(99)).toBe(5);
    expect(clampSpeed("bad")).toBe(3);
  });
  it("identifies recitable stages and models clicker phase actions", () => {
    const stages = buildStages(10, data, 0);
    expect(stages.filter(isRecitable).map((s) => s.kind)).toEqual(["say", "say", "challenge"]);
    expect(initialPhase(stages[0])).toBe("hidden");
    expect(initialPhase(stages[1])).toBe("ready");
    expect(phaseAction("hidden", "advance")).toBe("ready");
    expect(phaseAction("ready", "advance")).toBe("countdown");
    expect(phaseAction("countdown", "advance")).toBe("paused");
    expect(phaseAction("paused", "advance")).toBe("reciting");
    expect(phaseAction("reciting", "words-done")).toBe("complete");
    expect(phaseAction("complete", "back")).toBe("ready");
    expect([0, 1, 2, 3].map(nextCountdownStep)).toEqual([1, 2, 3, "recite"]);
  });
  it("keeps Medium human cadence within fourth-grade group guardrails", () => {
    const wpms = data.map((item) => {
      const timeline = buildRecitationTimeline(item.question, item.answer, 3);
      const words = timeline.filter((step) => step.kind === "word").length;
      const milliseconds = timeline.reduce((sum, step) => sum + step.delay, 0);
      return words * 60_000 / milliseconds;
    });
    expect(Math.min(...wpms)).toBeGreaterThan(75);
    expect(Math.max(...wpms)).toBeLessThan(145);
  });
  it("uses a deterministic, bounded reveal cadence without changing tokens", () => {
    expect(revealStagger("one")).toBe(0);
    expect(revealStagger("one two three")).toBe(90);
    for (const item of data) {
      const tokens = tokenizeAnswer(item.answer);
      expect(tokens.map((token) => token.text).join("")).toBe(item.answer);
      const count = wordTokenIndexes(tokens).length;
      const stagger = revealStagger(item.answer);
      expect(stagger).toBe(revealStagger(item.answer));
      if (count > 1) {
        expect(stagger).toBeGreaterThanOrEqual(60);
        expect(stagger).toBeLessThanOrEqual(90);
        expect(stagger * (count - 1)).toBeLessThanOrEqual(2520);
      }
    }
  });
});

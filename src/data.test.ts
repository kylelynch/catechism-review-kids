import { describe, expect, it } from "vitest";
import { questions, sourceSha256 } from "./data/catechism.generated";
describe("canonical data", () => {
  it("has 62 complete unique questions", () => {
    expect(questions).toHaveLength(62);
    expect(new Set(questions.map((q) => q.id)).size).toBe(62);
    for (const q of questions) {
      expect(q.question.trim()).not.toBe("");
      expect(q.answer.trim()).not.toBe("");
      expect(q.scripture.text.trim()).not.toBe("");
    }
  });
  it("preserves six unresolved references", () =>
    expect(
      questions
        .filter(
          (q) => q.scripture.referenceReviewStatus === "Needs Human Decision",
        )
        .map((q) => q.id),
    ).toEqual(["Q-005", "Q-014", "Q-018", "Q-049", "Q-056", "Q-062"]));
  it("records provenance", () =>
    expect(sourceSha256).toMatch(/^[a-f0-9]{64}$/));
  it("preserves workbook review states without claiming approval", () => {
    for (const q of questions) {
      expect(q.questionSourceStatus).toBe("Source Checked");
      expect(q.questionApprovalStatus).toBe("Needs Human Approval");
      expect([
        "API Verified - Human Approval Pending",
        "Needs Human Reference Decision",
      ]).toContain(q.scripture.verificationStatus);
      expect(q.teaching.status).toBe("Not Started");
    }
  });
});

import type { Question, Stage, Variation } from "./types";
export const variations: Variation[] = [
  {
    id: "whole",
    title: "Together",
    instruction: "",
    mode: "normal",
  },
  {
    id: "sides",
    title: "Left / Right",
    instruction: "",
    mode: "split",
  },
  {
    id: "echo",
    title: "Echo",
    instruction: "",
    mode: "echo",
  },
  {
    id: "whisper",
    title: "Whisper",
    instruction: "",
    mode: "normal",
  },
  {
    id: "backwall",
    title: "Strong voice",
    instruction: "",
    mode: "normal",
  },
  {
    id: "fade",
    title: "Missing words",
    instruction: "",
    mode: "hidden",
  },
  {
    id: "ages",
    title: "Younger / Older",
    instruction: "",
    mode: "split",
  },
  {
    id: "slow",
    title: "Slow then clear",
    instruction: "",
    mode: "normal",
  },
];
export function seededIndex(seed: number, length: number) {
  return (((seed * 37 + 11) % length) + length) % length;
}
export function olderReview(current: number, qs: readonly Question[]) {
  return selectReviews(current, 2, qs)[1];
}
export function selectReviews(
  current: number,
  count: number,
  qs: readonly Question[],
) {
  const wanted = Math.min(Math.max(0, count), 5, current - 1);
  if (!wanted) return [];
  const selected: Question[] = [qs[current - 2]];
  const pool = qs.slice(0, current - 2);
  while (selected.length < wanted && pool.length) {
    const i = seededIndex(current + selected.length * 7, pool.length);
    selected.push(pool.splice(i, 1)[0]);
  }
  return selected;
}
export function paginateScripture(text: string, maxCharacters = 360) {
  const starts = [...text.matchAll(/\[\d+\]/g)].map(
    (match) => match.index ?? 0,
  );
  if (!starts.length || text.length <= maxCharacters) return [text];
  const verses = starts.map((start, index) =>
    text.slice(start, starts[index + 1] ?? text.length).trim(),
  );
  const pages: string[] = [];
  for (const verse of verses) {
    const current = pages.at(-1);
    if (current && current.length + verse.length + 2 <= maxCharacters)
      pages[pages.length - 1] = `${current}\n\n${verse}`;
    else pages.push(verse);
  }
  return pages;
}
export function selectVariations(current: number) {
  const a = seededIndex(current, variations.length);
  return [
    variations[a],
    variations[(a + 3) % variations.length],
  ];
}
export function buildStages(
  current: number,
  qs: readonly Question[],
  reviewCount = 2,
): Stage[] {
  const q = qs[current - 1],
    v = selectVariations(current),
    chosenReviews = selectReviews(current, reviewCount, qs);
  const reviews: Stage[] = chosenReviews.map((review, index) => ({
    kind: "review",
    eyebrow: `Review · ${index + 1} of ${chosenReviews.length}`,
    title: review.question,
    question: review,
    answerVisible: false,
  }));
  const pending = q.scripture.referenceReviewStatus === "Needs Human Decision";
  const scripturePages = pending ? [] : paginateScripture(q.scripture.text);
  const scriptureStages: Stage[] = pending
    ? [
        {
          kind: "scripture-pending",
          eyebrow: "Scripture pending",
          title: q.scripture.reference,
          question: q,
        },
      ]
    : scripturePages.map((text, index) => ({
        kind: "scripture",
        eyebrow: `Scripture${scripturePages.length > 1 ? ` · ${index + 1} of ${scripturePages.length}` : ""}`,
        title: q.scripture.reference,
        question: q,
        scriptureText: text,
        scripturePage: index + 1,
        scripturePages: scripturePages.length,
      }));
  return [
    ...reviews,
    {
      kind: "meet",
      eyebrow: "Listen",
      title: q.question,
      question: q,
      answerVisible: false,
    },
    ...v.map((variation, i) => ({
      kind: "say",
      eyebrow: `${variation.title} · ${i + 1} of 2`,
      title: variation.title,
      question: q,
      variation,
      answerVisible: true,
    })),
    ...scriptureStages,
    {
      kind: "challenge",
      eyebrow: "From memory",
      title: q.question,
      question: q,
      answerVisible: false,
    },
    {
      kind: "close",
      eyebrow: "",
      title: "",
    },
  ];
}
export function hideWords(answer: string, seed: number) {
  return answer
    .split(/(\s+)/)
    .map((w, i) => (/\w/.test(w) && (i + seed) % 7 === 0 ? "_____" : w))
    .join("");
}

export const PREFERENCES_KEY = "catechism-presentation-settings";

export type PresentationPreferences = { version: 1; question: number; reviewCount: number; speed: number };

const integerInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function parsePreferences(value: string | null): PresentationPreferences | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== 1 || !integerInRange(candidate.question, 1, 62) || !integerInRange(candidate.reviewCount, 0, 5) || !integerInRange(candidate.speed, 1, 5)) return null;
    return candidate as PresentationPreferences;
  } catch {
    return null;
  }
}

export function loadPreferences(storage: Storage): PresentationPreferences | null {
  const current = parsePreferences(storage.getItem(PREFERENCES_KEY));
  if (current) return current;
  const question = Number(storage.getItem("catechism-question"));
  const reviewCount = Number(storage.getItem("catechism-review-count"));
  const speed = Number(storage.getItem("catechism-speed"));
  if (!integerInRange(question, 1, 62) || !integerInRange(reviewCount, 0, 5) || !integerInRange(speed, 1, 5)) return null;
  return { version: 1, question, reviewCount, speed };
}

export function savePreferences(storage: Storage, preferences: Omit<PresentationPreferences, "version">) {
  storage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, ...preferences }));
  storage.removeItem("catechism-question");
  storage.removeItem("catechism-review-count");
  storage.removeItem("catechism-speed");
}

export function clearPreferences(storage: Storage) {
  storage.removeItem(PREFERENCES_KEY);
  storage.removeItem("catechism-question");
  storage.removeItem("catechism-review-count");
  storage.removeItem("catechism-speed");
}

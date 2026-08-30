import { describe, expect, it } from "vitest";
import { loadPreferences, parsePreferences, PREFERENCES_KEY, savePreferences } from "./preferences";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("presentation preferences", () => {
  it("round trips the versioned settings record", () => {
    const storage = new MemoryStorage();
    savePreferences(storage, { question: 12, reviewCount: 3, speed: 4 });
    expect(loadPreferences(storage)).toEqual({ version: 1, question: 12, reviewCount: 3, speed: 4 });
    expect(JSON.parse(storage.getItem(PREFERENCES_KEY)!)).toEqual({ version: 1, question: 12, reviewCount: 3, speed: 4 });
  });

  it.each([null, "not json", "{}", JSON.stringify({ version: 2, question: 12, reviewCount: 3, speed: 4 }), JSON.stringify({ version: 1, question: 0, reviewCount: 3, speed: 4 }), JSON.stringify({ version: 1, question: 12, reviewCount: 8, speed: 4 }), JSON.stringify({ version: 1, question: 12, reviewCount: 3, speed: "fast" })])("rejects malformed or stale data: %s", (value) => {
    expect(parsePreferences(value)).toBeNull();
  });

  it("loads a valid legacy selection for existing users", () => {
    const storage = new MemoryStorage();
    storage.setItem("catechism-question", "8");
    storage.setItem("catechism-review-count", "2");
    storage.setItem("catechism-speed", "5");
    expect(loadPreferences(storage)).toEqual({ version: 1, question: 8, reviewCount: 2, speed: 5 });
  });
});

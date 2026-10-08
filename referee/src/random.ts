// Seeded random numbers (mulberry32). The same seed always gives the same sequence on every machine.
// Used for AI choices, map layout and, by the one exception [Proposed], the Evasion test's pair-off dice (src/referee/dice.ts).

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

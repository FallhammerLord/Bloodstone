// Pair-off dice for the Evasion test [Proposed]: a Bite or Claw against a moving or dodging target rolls its attack
// stat ÷ 3 in d6 against the target's Evasion ÷ 3. Both pools sort high to low and pair off; the first pair that
// differs decides, the higher die winning. An unbroken chain that runs through the defender's whole pool, with attacker
// dice left, is a hit; one that runs through the attacker's whole pool is the defender's, as a near miss.
//
// A real bout rolls from its own seeded stream. A brain imagining a bout can't see that stream, so it imagines at a
// luck quantile instead: the attack lands when its chance beats the quantile, and spreading quantiles across guesses
// averages to the true odds.

import { seededRandom } from '../random.ts';

export type Dice = { mode: 'roll'; seed: number; n: number } | { mode: 'quantile'; u: number };

export type DiceResult = 'hit' | 'evaded' | 'nearMiss';

export interface Roll {
  result: DiceResult;
  attack: number[];
  evasion: number[];
}

/** A pool's size: one die per 3 points, never below none. */
export const poolOf = (stat: number, unit: number) => Math.max(0, Math.floor(stat / unit));

/** The next roll from a bout's stream: each draw reseeds from (seed, draw count), so a cloned bout replays it. */
function draw(d: Extract<Dice, { mode: 'roll' }>, count: number): number[] {
  const rng = seededRandom((d.seed * 2654435761 + d.n * 40503 + 1) >>> 0);
  d.n++;
  return Array.from({ length: count }, () => 1 + Math.floor(rng() * 6)).sort((x, y) => y - x);
}

/** Pairs two sorted pools off, high to low. */
export function pairOff(attack: number[], evasion: number[]): DiceResult {
  for (let i = 0; i < Math.min(attack.length, evasion.length); i++) {
    if (attack[i] !== evasion[i]) return attack[i] > evasion[i] ? 'hit' : 'evaded';
  }
  return attack.length > evasion.length ? 'hit' : 'nearMiss';
}

const choose = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};

const memo = new Map<string, { hit: number; nearMiss: number }>();

/**
 * The exact odds of a pair-off. Sorted pools compare face by face from 6 down: the side with more of the highest
 * face that differs wins. Given every remaining die shows at most f, each shows f with chance 1/f.
 */
export function odds(a: number, e: number): { hit: number; nearMiss: number } {
  const key = `${a},${e}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const go = (ra: number, re: number, f: number): [number, number] => {
    if (ra === 0) return [0, 1]; // the attacker's whole pool matched: a near miss, the defender's
    if (re === 0) return [1, 0]; // the defender's whole pool matched, attacker dice left: a hit
    if (f === 1) return ra > re ? [1, 0] : [0, 1]; // every remaining die is a 1: the chain runs out on the smaller pool
    let h = 0, n = 0;
    const p = 1 / f;
    for (let i = 0; i <= ra; i++) {
      const pi = choose(ra, i) * p ** i * (1 - p) ** (ra - i);
      for (let j = 0; j <= re; j++) {
        const pj = choose(re, j) * p ** j * (1 - p) ** (re - j);
        if (i > j) h += pi * pj;
        else if (i === j) {
          const [hh, nn] = go(ra - i, re - j, f - 1);
          h += pi * pj * hh;
          n += pi * pj * nn;
        }
      }
    }
    return [h, n];
  };
  const [h, n] = go(a, e, 6);
  const r = { hit: h, nearMiss: n };
  memo.set(key, r);
  return r;
}

/** Rolls (or imagines) one Evasion test. */
export function rollEvasion(d: Dice, attackDice: number, evasionDice: number): Roll {
  if (d.mode === 'quantile') {
    const o = odds(attackDice, evasionDice);
    const result: DiceResult = d.u < o.hit ? 'hit' : d.u < o.hit + o.nearMiss ? 'nearMiss' : 'evaded';
    return { result, attack: [], evasion: [] };
  }
  const attack = draw(d, attackDice);
  const evasion = draw(d, evasionDice);
  return { result: pairOff(attack, evasion), attack, evasion };
}

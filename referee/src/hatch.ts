// The Hatching Engine: egg + stone → stat sheet. Order [Doc]: baselines, swing, then derive tertiaries.

import { ACUMEN_START } from './rules.ts';

export type Morph = 'true-dragon' | 'wyvern' | 'wyrm';
export type Element = 'water' | 'salt' | 'earth' | 'magma' | 'fire' | 'lightning' | 'air' | 'storm';
export type CoreStone = 'water' | 'earth' | 'fire' | 'air';
export type Age = 'wyrmling' | 'adult' | 'venerable';
export type Preference = 'preferred' | 'disliked' | 'neutral';

export interface StatSheet {
  morph: Morph;
  stone: CoreStone;
  age: Age;
  preference: Preference;
  /** winged morphs fly; the Wyrm is serpentine and grounded [Doc] */
  flies: boolean;
  /** the rule this morph bends [Doc] §2: True Dragon has none */
  aspect: 'none' | 'talons' | 'serpentine';
  wounds: number;
  evasion: number;
  hardness: number;
  claw: number;
  bite: number;
  breath: number;
  accuracy: number;
  affinity: number;
  acumen: number;
}

// [Proposed] §2 Starting Attributes
const MORPHS: Record<Morph, { wounds: number; evasion: number; hardness: number; accuracyMod: number; peak: 'wounds' | 'evasion' | 'hardness' }> = {
  'true-dragon': { wounds: 36, evasion: 3, hardness: 3, accuracyMod: 3, peak: 'wounds' },
  wyvern: { wounds: 24, evasion: 9, hardness: 3, accuracyMod: -3, peak: 'evasion' }, // valley on Wounds, so Evasion isn't its only defense
  wyrm: { wounds: 30, evasion: 6, hardness: 6, accuracyMod: -3, peak: 'hardness' },
};

const STONES: Record<CoreStone, { claw: number; bite: number; breath: number; affinityMod: number; peak: 'claw' | 'bite' | 'breath' | 'affinityMod' }> = {
  water: { claw: 3, bite: 9, breath: 9, affinityMod: -3, peak: 'affinityMod' },
  earth: { claw: 6, bite: 12, breath: 9, affinityMod: -9, peak: 'bite' },
  fire: { claw: 6, bite: 6, breath: 12, affinityMod: -9, peak: 'breath' },
  air: { claw: 9, bite: 9, breath: 6, affinityMod: -3, peak: 'claw' },
};

const ASPECTS: Record<Morph, StatSheet['aspect']> = { 'true-dragon': 'none', wyvern: 'talons', wyrm: 'serpentine' };

// [Doc] §2 Elemental Preference
const PREFERS: Record<Morph, CoreStone> = { 'true-dragon': 'fire', wyvern: 'air', wyrm: 'water' };
const DISLIKES: Record<Morph, CoreStone> = { 'true-dragon': 'earth', wyvern: 'fire', wyrm: 'air' };

export function preference(morph: Morph, stone: CoreStone): Preference {
  if (PREFERS[morph] === stone) return 'preferred';
  if (DISLIKES[morph] === stone) return 'disliked';
  return 'neutral';
}

export function hatch(morph: Morph, stone: CoreStone, age: Age = 'wyrmling'): StatSheet {
  if (!(morph in MORPHS)) throw new Error(`Unknown morph "${morph}". Core morphs: ${Object.keys(MORPHS).join(', ')}.`);
  if (!(stone in STONES)) throw new Error(`Unknown stone "${stone}". Core stones: ${Object.keys(STONES).join(', ')}.`);
  const m = { ...MORPHS[morph] };
  const s = { ...STONES[stone] };
  const pref = preference(morph, stone);

  // The swing: preferred leans into the stone, disliked into the body. Wounds moves in 6s.
  const sign = pref === 'preferred' ? 1 : pref === 'disliked' ? -1 : 0;
  s[s.peak] += 3 * sign;
  m[m.peak] -= (m.peak === 'wounds' ? 6 : 3) * sign;

  return {
    morph, stone, age, preference: pref, flies: morph !== 'wyrm', aspect: ASPECTS[morph],
    wounds: m.wounds, evasion: m.evasion, hardness: m.hardness,
    claw: s.claw, bite: s.bite, breath: s.breath,
    accuracy: m.evasion + m.accuracyMod,
    affinity: s.breath + s.affinityMod,
    acumen: ACUMEN_START,
  };
}

// [Doc] §3: on the wheel, each element beats the three clockwise of it.
const WHEEL: Element[] = ['water', 'salt', 'earth', 'magma', 'fire', 'lightning', 'air', 'storm'];

/** +1 if the attacker's element beats the defender's, −1 if the reverse, 0 if neutral. */
export function matchup(attacker: Element, defender: Element): number {
  const step = (WHEEL.indexOf(defender) - WHEEL.indexOf(attacker) + 8) % 8;
  if (step >= 1 && step <= 3) return 1;
  if (step >= 5) return -1;
  return 0;
}

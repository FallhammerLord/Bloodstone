// The Hatching Engine: egg + stone → stat sheet. Order [Doc]: base adds, then derive tertiaries.


export type Morph = 'true-dragon' | 'wyvern' | 'wyrm' | 'drake';
/** The core morphs, in table order. */
export const CORE_MORPHS: Morph[] = ['true-dragon', 'wyvern', 'wyrm', 'drake'];
export type Element = 'water' | 'salt' | 'earth' | 'magma' | 'fire' | 'lightning' | 'air' | 'storm';
export type CoreStone = 'water' | 'earth' | 'fire' | 'air';
export type Age = 'wyrmling' | 'adult' | 'venerable';
export type Preference = 'preferred' | 'disliked' | 'neutral';

export interface StatSheet {
  morph: Morph;
  stone: CoreStone;
  age: Age;
  preference: Preference;
  /** winged morphs fly; the Wyrm is serpentine and the Drake four-legged, both grounded [Doc] */
  flies: boolean;
  /** the rule this morph bends [Doc] §2 */
  aspect: 'stalwart' | 'talons' | 'serpentine' | 'ravener';
  wounds: number;
  evasion: number;
  scales: number;
  claw: number;
  bite: number;
  breath: number;
  accuracy: number;
  affinity: number;
  acumen: number;
  /** added to every Surge trigger: a preferred Air stone's +3 */
  surgeFill: number;
}

// [Proposed] §2 Starting Attributes (the wyrmling regrid). Baseline Wounds 60, Evasion 6, Scales 6; each morph takes
// one peak and one valley off it (Wounds ±6, flat).
const MORPHS: Record<Morph, { wounds: number; evasion: number; scales: number }> = {
  'true-dragon': { wounds: 66, evasion: 3, scales: 6 }, // peak Wounds, valley Evasion
  wyvern: { wounds: 60, evasion: 9, scales: 3 }, // peak Evasion, valley Scales
  wyrm: { wounds: 54, evasion: 6, scales: 9 }, // peak Scales, valley Wounds
  drake: { wounds: 54, evasion: 9, scales: 6 }, // peak Evasion, valley Wounds: wingless, four-legged
};

type Derived = 'accuracy' | 'affinity' | 'acumen' | 'surge';
// Baseline Claw 9, Bite 12, Breath 15; each stone takes one peak and one valley. A preferred stone adds +3 to its
// derived stat ("perk").
const STONES: Record<CoreStone, { claw: number; bite: number; breath: number; perk: Derived }> = {
  water: { claw: 9, bite: 9, breath: 18, perk: 'acumen' }, // peak Breath, valley Bite
  earth: { claw: 9, bite: 15, breath: 12, perk: 'accuracy' }, // peak Bite, valley Breath
  fire: { claw: 6, bite: 12, breath: 18, perk: 'affinity' }, // peak Breath, valley Claw
  air: { claw: 12, bite: 12, breath: 12, perk: 'surge' }, // peak Claw, valley Breath
};

/** The age categories, of five: wyrmling 1, juvenile 2, adult 3, elder 4, venerable 5. */
const AGE_CATEGORY: Record<Age, number> = { wyrmling: 1, adult: 3, venerable: 5 };
/** Derived stats never fall below this. */
const DERIVED_FLOOR = 3;
/** A disliked stone costs this many Wounds. */
const DISLIKED_WOUNDS = 6;

const ASPECTS: Record<Morph, StatSheet['aspect']> = { 'true-dragon': 'stalwart', wyvern: 'talons', wyrm: 'serpentine', drake: 'ravener' };
const FLIERS: Morph[] = ['true-dragon', 'wyvern'];

// [Doc] §2 Elemental Preference: each morph dislikes the element that beats the one it prefers.
const PREFERS: Record<Morph, CoreStone> = { 'true-dragon': 'fire', wyvern: 'air', wyrm: 'water', drake: 'earth' };
const DISLIKES: Record<Morph, CoreStone> = { 'true-dragon': 'earth', wyvern: 'fire', wyrm: 'air', drake: 'water' };

export function preference(morph: Morph, stone: CoreStone): Preference {
  if (PREFERS[morph] === stone) return 'preferred';
  if (DISLIKES[morph] === stone) return 'disliked';
  return 'neutral';
}

/**
 * Egg + stone → stat sheet. The base adds come first (morph, stone, and a disliked stone's −6 Wounds); then the
 * tertiaries derive from them: Accuracy = Claw − Evasion, Affinity = Breath − Scales (each at least 3), Acumen = 10 ×
 * age category; a preferred stone adds +3 to its own derived stat (Air's goes to every Surge trigger).
 */
export function hatch(morph: Morph, stone: CoreStone, age: Age = 'wyrmling'): StatSheet {
  if (!(morph in MORPHS)) throw new Error(`Unknown morph "${morph}". Core morphs: ${Object.keys(MORPHS).join(', ')}.`);
  if (!(stone in STONES)) throw new Error(`Unknown stone "${stone}". Core stones: ${Object.keys(STONES).join(', ')}.`);
  const m = MORPHS[morph];
  const s = STONES[stone];
  const pref = preference(morph, stone);
  const perk = (d: Derived) => (pref === 'preferred' && s.perk === d ? 3 : 0);
  return {
    morph, stone, age, preference: pref, flies: FLIERS.includes(morph), aspect: ASPECTS[morph],
    wounds: m.wounds - (pref === 'disliked' ? DISLIKED_WOUNDS : 0), evasion: m.evasion, scales: m.scales,
    claw: s.claw, bite: s.bite, breath: s.breath,
    accuracy: Math.max(DERIVED_FLOOR, s.claw - m.evasion) + perk('accuracy'),
    affinity: Math.max(DERIVED_FLOOR, s.breath - m.scales) + perk('affinity'),
    acumen: 10 * AGE_CATEGORY[age] + perk('acumen'),
    surgeFill: perk('surge'),
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

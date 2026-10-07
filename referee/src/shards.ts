// Dragonshards: the catalog, the array they seat into, and the stat sheet they compile to.
// Body and Bloodstone suites in full; Techniques are data here and take effect in the Referee.

import type { StatSheet } from './hatch.ts';
import { DEFAULT_RULES, type Rules } from './rules.ts';

export type Grade = 'wyrmling' | 'juvenile' | 'adult' | 'elder' | 'venerable';
export const GRADES: readonly Grade[] = ['wyrmling', 'juvenile', 'adult', 'elder', 'venerable'];
export const gradeRank = (g: Grade) => GRADES.indexOf(g);

export type Attr = 'wounds' | 'evasion' | 'scales' | 'accuracy' | 'claw' | 'bite' | 'breath' | 'affinity';

/** When a conditional rider applies. The Referee checks these at the moment the attribute is used. */
export type Condition =
  | 'halfWounds' // at half Wounds or below
  | 'aloft' // while aloft
  | 'guard' // while Guarding
  | 'altitudeDiff' // against a target at a different altitude
  | 'chainFinal' // on a chain's final link
  | 'crunchedDifferent' // when crunched with a different action (crunch isn't built yet: never true)
  | 'targetFar' // against targets at Far
  | 'beatsMyStone'; // against elements that beat your stone

export interface Rider {
  condition: Condition;
  attr: Attr;
  points: number;
}

// ---- Body and Bloodstone suites (dragonshards-body.md, dragonshards-bloodstone.md) ----

interface AttrLine {
  family: 'body' | 'bloodstone';
  attr: Attr;
  names: Record<Grade, string>;
  rider: { condition: Condition; attr: Attr };
  related: Attr;
}

const ATTR_LINES: AttrLine[] = [
  { family: 'body', attr: 'wounds', rider: { condition: 'halfWounds', attr: 'scales' }, related: 'scales',
    names: { wyrmling: 'Heartgrit', juvenile: 'Thickblood', adult: 'Deep Keel', elder: 'Ironheart', venerable: 'Second Heart' } },
  { family: 'body', attr: 'evasion', rider: { condition: 'aloft', attr: 'evasion' }, related: 'accuracy',
    names: { wyrmling: 'Coiled Sinew', juvenile: 'Spring Haunch', adult: 'Swept Pinions', elder: 'Galewing', venerable: 'Skyvane' } },
  { family: 'body', attr: 'scales', rider: { condition: 'guard', attr: 'scales' }, related: 'wounds',
    names: { wyrmling: 'Pebblescale', juvenile: 'Hornhide', adult: 'Shalecoat', elder: 'Bastion Plates', venerable: 'Mountainback' } },
  { family: 'body', attr: 'accuracy', rider: { condition: 'altitudeDiff', attr: 'accuracy' }, related: 'evasion',
    names: { wyrmling: 'Slit Pupil', juvenile: "Hunter's Eye", adult: 'Nictitating Lens', elder: 'Ranging Eyes', venerable: 'Farseer Eyes' } },
  { family: 'bloodstone', attr: 'claw', rider: { condition: 'chainFinal', attr: 'claw' }, related: 'affinity',
    names: { wyrmling: 'Whetted Nail', juvenile: 'Hooked Talon', adult: 'Razor Talons', elder: 'Reaver Hooks', venerable: 'Sundering Claws' } },
  { family: 'bloodstone', attr: 'bite', rider: { condition: 'crunchedDifferent', attr: 'bite' }, related: 'affinity',
    names: { wyrmling: 'Milk Fang', juvenile: 'Set Jaw', adult: 'Crushing Molars', elder: 'Vise Jaw', venerable: 'Sovereign Jaw' } },
  { family: 'bloodstone', attr: 'breath', rider: { condition: 'targetFar', attr: 'breath' }, related: 'affinity',
    names: { wyrmling: 'Smolder Sac', juvenile: 'Bellows Lung', adult: 'Furnace Gland', elder: 'Cauldron Gullet', venerable: 'Crucible Gland' } },
  { family: 'bloodstone', attr: 'affinity', rider: { condition: 'beatsMyStone', attr: 'affinity' }, related: 'breath',
    names: { wyrmling: 'Weathered Hide', juvenile: 'Tempered Hide', adult: 'Mantled Hide', elder: 'Wardskin', venerable: 'Allward Mantle' } },
];

// [Doc] grades: Wyrmling +1, Juvenile +2, Adult +3 (chips, 1 pip); Elder +3 and a +3 rider; Venerable adds 1 related point (2 pips).
// Suite v0.4 adds ATTR_SHARD_BONUS to every grade's base points when a sheet compiles (Wyrmling +2 ... Adult and up +4).
const GRADE_POINTS: Record<Grade, number> = { wyrmling: 1, juvenile: 2, adult: 3, elder: 3, venerable: 3 };
const RIDER_POINTS = 3;
const RELATED_POINTS = 1;

// ---- Technique suite (dragonshards-technique.md) ----

export type TechniqueId =
  | 'snapping-jaw' | 'lockjaw' | 'gnashing-teeth'
  | 'hamstring-hooks' | 'scything-forelimbs' | 'ratchet-claws' | 'raking-talons'
  | 'lance-throat' | 'smoldering-maw' | 'bellows-chest' | 'ash-gland'
  | 'stooping-pinions' | 'sidewinder-spine' | 'bounding-haunches'
  | 'thornscale' | 'riposte-talons' | 'mantle-wings'
  | 'sapping-bellow' | 'baleful-eye' | 'goading-roar'
  | 'elemental-jaws';

interface TechniqueDef {
  id: TechniqueId;
  name: string;
  /** base pips, Wyrmling through Adult; Elder and Venerable add one for the rider [Doc] */
  pips: number;
  /** false where the mechanic it needs (crunch, charge) isn't built yet */
  built: boolean;
  /** out of the shard pool for redesign: still seatable by hand, never drafted, dropped or dealt */
  pulled?: boolean;
}

const TECHNIQUES: TechniqueDef[] = [
  { id: 'snapping-jaw', name: 'Snapping Jaw', pips: 1, built: true },
  { id: 'lockjaw', name: 'Lockjaw', pips: 1, built: true },
  { id: 'gnashing-teeth', name: 'Gnashing Teeth', pips: 1, built: true },
  { id: 'hamstring-hooks', name: 'Hamstring Hooks', pips: 1, built: true },
  { id: 'scything-forelimbs', name: 'Scything Forelimbs', pips: 1, built: true },
  { id: 'ratchet-claws', name: 'Ratchet Claws', pips: 1, built: true },
  { id: 'raking-talons', name: 'Raking Talons', pips: 1, built: true },
  { id: 'lance-throat', name: 'Lance Throat', pips: 2, built: true },
  { id: 'smoldering-maw', name: 'Smoldering Maw', pips: 1, built: true },
  { id: 'bellows-chest', name: 'Bellows Chest', pips: 2, built: true },
  { id: 'ash-gland', name: 'Ashbreath', pips: 1, built: true, pulled: true }, // was Ash Gland; in the pool under cloud or ashbreath
  { id: 'stooping-pinions', name: 'Stooping Pinions', pips: 1, built: true },
  { id: 'sidewinder-spine', name: 'Sidewinder Spine', pips: 1, built: true },
  { id: 'bounding-haunches', name: 'Bounding Haunches', pips: 1, built: true },
  { id: 'thornscale', name: 'Thornscale', pips: 1, built: true },
  { id: 'riposte-talons', name: 'Riposte Talons', pips: 1, built: true },
  { id: 'mantle-wings', name: 'Elemental Mantle', pips: 1, built: true }, // was Mantle Wings
  { id: 'sapping-bellow', name: 'Sapping Bellow', pips: 1, built: true },
  { id: 'baleful-eye', name: 'Baleful Eye', pips: 1, built: true, pulled: true }, // cut in parity pass 1; back under TECH_BALEFUL_EYE=back
  { id: 'goading-roar', name: 'Goading Roar', pips: 1, built: true },
  { id: 'elemental-jaws', name: 'Elemental Jaws', pips: 1, built: true, pulled: true }, // new in v0.4; in the pool under TECH_ELEMENTAL_JAWS=on
];

// ---- Shards ----

export type ShardKind =
  | { family: 'body' | 'bloodstone'; attr: Attr; points: number; rider: Rider | null; related: { attr: Attr; points: number } | null }
  | { family: 'technique'; technique: TechniqueId };

export interface Shard {
  name: string;
  grade: Grade;
  pips: number;
  kind: ShardKind;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Looks a shard up by name. Body and Bloodstone names carry their grade ("Razor Talons" is Adult).
 * Techniques keep one name across grades, so they need a grade ("Snapping Jaw", "adult").
 */
/** Old names that saved seasons and cards still carry. */
const LEGACY_NAMES: Record<string, string> = { hollowbones: 'Coiled Sinew', ashgland: 'Ashbreath', mantlewings: 'Elemental Mantle' };

export function findShard(name: string, grade?: Grade): Shard {
  const n = norm(LEGACY_NAMES[norm(name)] ?? name);
  for (const line of ATTR_LINES) {
    for (const g of GRADES) {
      if (norm(line.names[g]) !== n) continue;
      const top = gradeRank(g) >= gradeRank('elder');
      return {
        name: line.names[g], grade: g, pips: top ? 2 : 1,
        kind: {
          family: line.family, attr: line.attr, points: GRADE_POINTS[g],
          rider: top ? { ...line.rider, points: RIDER_POINTS } : null,
          related: g === 'venerable' ? { attr: line.related, points: RELATED_POINTS } : null,
        },
      };
    }
  }
  const t = TECHNIQUES.find((x) => norm(x.name) === n || x.id === name);
  if (t) {
    if (!t.built) throw new Error(`${t.name} needs crunch or charge, which aren't built yet.`);
    if (!grade || !GRADES.includes(grade)) throw new Error(`${t.name} is a Technique: give it a grade (${GRADES.join(', ')}).`);
    return { name: t.name, grade, pips: t.pips + (gradeRank(grade) >= gradeRank('elder') ? 1 : 0), kind: { family: 'technique', technique: t.id } };
  }
  throw new Error(`Unknown shard "${name}".`);
}

export const allAttrShards = (): Shard[] => ATTR_LINES.flatMap((l) => GRADES.map((g) => findShard(l.names[g])));
export const builtTechniques = (): TechniqueDef[] => TECHNIQUES.filter((t) => t.built);

// ---- The array ----

/**
 * A wyrmling's array: one valence of three pips around the bloodstone. It is a ring, so any two of its
 * pips are adjacent and a 2-pip splinter fits anywhere [Assumed]. Spikes need a second valence.
 */
export const WYRMLING_PIPS = 3;

export interface Seated {
  shard: Shard;
  /** pips this shard still holds */
  pips: number[];
  /** pips lost to overlap; each strips the rider first, then the value [Doc] */
  covered: number;
}

export interface DragonArray {
  pips: number;
  seated: Seated[];
}

export const emptyArray = (): DragonArray => ({ pips: WYRMLING_PIPS, seated: [] });

/**
 * Seats a shard. Seating locks; the only way to replace a shard is to seat over it [Doc]. A covered
 * pip strips the covered shard's perks first, then its values; a shard with no pips left is destroyed.
 * Returns what was damaged or destroyed, for the report.
 */
export function seat(array: DragonArray, shard: Shard, pips: number[]): string[] {
  if (pips.length !== shard.pips) throw new Error(`${shard.name} takes ${shard.pips} pip${shard.pips > 1 ? 's' : ''}; got ${pips.length}.`);
  if (new Set(pips).size !== pips.length) throw new Error(`${shard.name}: the same pip twice.`);
  for (const p of pips) if (!Number.isInteger(p) || p < 0 || p >= array.pips) throw new Error(`${shard.name}: pip ${p} doesn't exist; a wyrmling has pips 0 to ${array.pips - 1}.`);
  const notes: string[] = [];
  for (const s of array.seated) {
    const lost = s.pips.filter((p) => pips.includes(p));
    if (lost.length === 0) continue;
    s.pips = s.pips.filter((p) => !pips.includes(p));
    s.covered += lost.length;
    notes.push(s.pips.length === 0 ? `${s.shard.name} is destroyed.` : `${s.shard.name} loses ${lost.length} pip and its rider.`);
  }
  array.seated = array.seated.filter((s) => s.pips.length > 0);
  array.seated.push({ shard, pips: [...pips], covered: 0 });
  return notes;
}

// ---- Compiling ----

export interface TechniqueSlot {
  id: TechniqueId;
  name: string;
  /** the terms it plays at: an Elder or Venerable that lost its rider pip plays as Adult */
  grade: Grade;
}

/** The sheet the Referee reads: flat points added, riders listed, techniques listed. */
export interface Loadout {
  riders: Rider[];
  techniques: TechniqueSlot[];
  /** shard names, for the report */
  names: string[];
  /** what seating damaged or destroyed, for the report */
  seating: string[];
}

/**
 * Adds seated shards to a hatched sheet. Affinity and Accuracy were derived at hatching and don't re-derive [Doc].
 * `bonus` adds to each attribute shard's base points (suite v0.4's ATTR_SHARD_BONUS); riders and related points keep theirs.
 */
export function compile(base: StatSheet, array: DragonArray, bonus = DEFAULT_RULES.ATTR_SHARD_BONUS): { sheet: StatSheet; loadout: Loadout } {
  const sheet = { ...base };
  const loadout: Loadout = { riders: [], techniques: [], names: [], seating: [] };
  for (const s of array.seated) {
    const k = s.shard.kind;
    loadout.names.push(`${s.shard.name}${k.family === 'technique' ? ` (${s.shard.grade})` : ''}${s.covered ? ' (damaged)' : ''}`);
    if (k.family === 'technique') {
      const grade = s.covered > 0 && gradeRank(s.shard.grade) > gradeRank('adult') ? 'adult' : s.shard.grade;
      loadout.techniques.push({ id: k.technique, name: s.shard.name, grade });
      continue;
    }
    // Overlap strips perks first: one covered pip takes the rider (and a Venerable's related point with it).
    sheet[k.attr] += k.points + bonus;
    if (s.covered === 0) {
      if (k.rider) loadout.riders.push(k.rider);
      if (k.related) sheet[k.related.attr] += k.related.points;
    }
  }
  return { sheet, loadout };
}

/** Every built shard a dragon could seat: attribute chips and Techniques, at one grade or (null) all of them. */
/** The rules the shard pool follows (pulled shards come back under their variants). Run entry points set it. */
let poolRules: Rules = DEFAULT_RULES;
export function setPoolRules(rules: Rules) {
  poolRules = rules;
}

export function shardPool(grade: Grade | null = 'wyrmling'): Shard[] {
  // Pulled Techniques come back when the run's rules say so: Ashbreath (cloud or ashbreath), Baleful Eye, Elemental Jaws.
  const back: Partial<Record<TechniqueId, boolean>> = {
    'ash-gland': poolRules.TECH_ASH_GLAND !== 'pulled',
    'baleful-eye': poolRules.TECH_BALEFUL_EYE === 'back',
    'elemental-jaws': poolRules.TECH_ELEMENTAL_JAWS === 'on',
  };
  const inPool = (t: TechniqueDef) => !t.pulled || back[t.id] === true;
  const all = [...allAttrShards(), ...builtTechniques().filter(inPool).flatMap((t) => GRADES.map((g) => findShard(t.name, g)))];
  return grade ? all.filter((s) => s.grade === grade) : all;
}

/**
 * A random, legal loadout for a tournament: the array's pips filled with attribute chips and built Techniques, a
 * shard at a time until no pip is free. Grades track the defeated dragon's age [Doc], so a wyrmling's shards are
 * wyrmling grade unless asked otherwise. Seeded, so a run replays.
 */
export function randomLoadout(rng: () => number, pips = WYRMLING_PIPS, grade: Grade | null = 'wyrmling'): { shard: string; grade: Grade; pips: number[] }[] {
  const pool = shardPool(grade);
  const out: { shard: string; grade: Grade; pips: number[] }[] = [];
  let free = Array.from({ length: pips }, (_, i) => i);
  while (free.length > 0) {
    const options = pool.filter((s) => s.pips <= free.length);
    const s = options[Math.floor(rng() * options.length)];
    out.push({ shard: s.name, grade: s.grade, pips: free.slice(0, s.pips) });
    free = free.slice(s.pips);
  }
  return out;
}

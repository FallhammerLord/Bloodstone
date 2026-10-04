// Dragonshards: the catalog, the array they seat into, and the stat sheet they compile to.
// Body and Bloodstone suites in full; Techniques are data here and take effect in the Referee.

import type { StatSheet } from './hatch.ts';

export type Grade = 'wyrmling' | 'juvenile' | 'adult' | 'elder' | 'venerable';
export const GRADES: readonly Grade[] = ['wyrmling', 'juvenile', 'adult', 'elder', 'venerable'];
export const gradeRank = (g: Grade) => GRADES.indexOf(g);

export type Attr = 'wounds' | 'evasion' | 'hardness' | 'accuracy' | 'claw' | 'bite' | 'breath' | 'affinity';

/** When a conditional rider applies. The Referee checks these at the moment the attribute is used. */
export type Condition =
  | 'halfWounds' // at half Wounds or below
  | 'aloft' // while aloft
  | 'scales' // while guarding with Scales
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
  { family: 'body', attr: 'wounds', rider: { condition: 'halfWounds', attr: 'hardness' }, related: 'hardness',
    names: { wyrmling: 'Heartgrit', juvenile: 'Thickblood', adult: 'Deep Keel', elder: 'Ironheart', venerable: 'Second Heart' } },
  { family: 'body', attr: 'evasion', rider: { condition: 'aloft', attr: 'evasion' }, related: 'accuracy',
    names: { wyrmling: 'Hollow Bones', juvenile: 'Spring Haunch', adult: 'Swept Pinions', elder: 'Galewing', venerable: 'Skyvane' } },
  { family: 'body', attr: 'hardness', rider: { condition: 'scales', attr: 'hardness' }, related: 'wounds',
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
  | 'sapping-bellow' | 'baleful-eye' | 'goading-roar';

interface TechniqueDef {
  id: TechniqueId;
  name: string;
  /** base pips, Wyrmling through Adult; Elder and Venerable add one for the rider [Doc] */
  pips: number;
  /** false where the mechanic it needs (crunch, charge) isn't built yet */
  built: boolean;
}

const TECHNIQUES: TechniqueDef[] = [
  { id: 'snapping-jaw', name: 'Snapping Jaw', pips: 1, built: true },
  { id: 'lockjaw', name: 'Lockjaw', pips: 1, built: true },
  { id: 'gnashing-teeth', name: 'Gnashing Teeth', pips: 1, built: false },
  { id: 'hamstring-hooks', name: 'Hamstring Hooks', pips: 1, built: true },
  { id: 'scything-forelimbs', name: 'Scything Forelimbs', pips: 1, built: true },
  { id: 'ratchet-claws', name: 'Ratchet Claws', pips: 1, built: true },
  { id: 'raking-talons', name: 'Raking Talons', pips: 1, built: false },
  { id: 'lance-throat', name: 'Lance Throat', pips: 2, built: true },
  { id: 'smoldering-maw', name: 'Smoldering Maw', pips: 1, built: true },
  { id: 'bellows-chest', name: 'Bellows Chest', pips: 2, built: false },
  { id: 'ash-gland', name: 'Ash Gland', pips: 1, built: true },
  { id: 'stooping-pinions', name: 'Stooping Pinions', pips: 1, built: true },
  { id: 'sidewinder-spine', name: 'Sidewinder Spine', pips: 1, built: true },
  { id: 'bounding-haunches', name: 'Bounding Haunches', pips: 1, built: true },
  { id: 'thornscale', name: 'Thornscale', pips: 1, built: true },
  { id: 'riposte-talons', name: 'Riposte Talons', pips: 1, built: true },
  { id: 'mantle-wings', name: 'Mantle Wings', pips: 1, built: true },
  { id: 'sapping-bellow', name: 'Sapping Bellow', pips: 1, built: true },
  { id: 'baleful-eye', name: 'Baleful Eye', pips: 1, built: true },
  { id: 'goading-roar', name: 'Goading Roar', pips: 1, built: true },
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
export function findShard(name: string, grade?: Grade): Shard {
  const n = norm(name);
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

/** Adds seated shards to a hatched sheet. Affinity and Accuracy were derived at hatching and don't re-derive [Doc]. */
export function compile(base: StatSheet, array: DragonArray): { sheet: StatSheet; loadout: Loadout } {
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
    sheet[k.attr] += k.points;
    if (s.covered === 0) {
      if (k.rider) loadout.riders.push(k.rider);
      if (k.related) sheet[k.related.attr] += k.related.points;
    }
  }
  return { sheet, loadout };
}

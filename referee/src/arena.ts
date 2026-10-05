// The arena floor: unbreakable rim pillars, breakable boulders, and lingering breath zones.
// Layout is seeded, so a replay reproduces the map [Proposed] §5.

import { dist, flat, flatLen, isqrt, sub, vec, type Vec } from './geometry.ts';
import { seededRandom } from './random.ts';
import * as R from './rules.ts';
import { DEFAULT_RULES, type Rules } from './rules.ts';

export type BoulderSize = 'small' | 'medium' | 'large';

export interface Obstacle {
  id: number;
  kind: 'pillar' | 'boulder';
  size: BoulderSize | null;
  /** center on the floor (z = 0) */
  pos: Vec;
  radius: number;
  height: number;
  /** null: unbreakable */
  wounds: number | null;
}

export interface Zone {
  /** burning (Fire) and corrosive (Earth) lie on the floor; smolder is Smoldering Maw's lingering breath */
  kind: 'burning' | 'corrosive' | 'smolder';
  /** smolder only: the breath's element, whose verb it carries */
  element?: 'water' | 'earth' | 'fire' | 'air';
  /** smolder only: Venerable Smoldering Maw lets overlapping areas stack */
  stacks?: boolean;
  /** center on the floor (z = 0); for a lane, where it starts */
  center: Vec;
  /** a lane (Fire): where it ends; the zone is everything within radius of the segment */
  end?: Vec;
  radius: number;
  /** a burning zone: what it deals at slot's end */
  damage?: number;
  /** the zone lingers through this global slot, then fades */
  lastSlot: number;
  owner: 'A' | 'B';
}

export interface Arena {
  obstacles: Obstacle[];
  zones: Zone[];
}

export interface ObstacleSetup {
  size: BoulderSize;
  /** paces from the arena center */
  x: number;
  y: number;
}

export interface ArenaSetup {
  /** how many random boulders to scatter (default 0) */
  boulders?: number;
  seed?: number;
  /** boulders at fixed spots, in paces */
  obstacles?: ObstacleSetup[];
}

const boulder = (rules: Rules, id: number, size: BoulderSize, pos: Vec): Obstacle => ({
  id, kind: 'boulder', size, pos, wounds: rules.BOULDERS[size].wounds, radius: rules.BOULDERS[size].radius, height: rules.BOULDERS[size].height,
});

/** A standard arena's boulder count, 1d4+2 [Proposed]: a seeded throw, never an open floor. */
export function standardBoulders(seed: number, rules: Rules = DEFAULT_RULES): number {
  return rules.BOULDERS_PER_ARENA.plus + 1 + Math.floor(seededRandom(seed * 7 + 3)() * rules.BOULDERS_PER_ARENA.dice);
}

/** Four unbreakable pillars at the quadrants [Doc], plus boulders. Boulders never land on a dragon's starting spot. */
export function makeArena(setup: ArenaSetup = {}, keepClear: Vec[] = [], rules: Rules = DEFAULT_RULES): Arena {
  const obstacles: Obstacle[] = [];
  const ring = rules.ARENA_RADIUS - rules.PILLAR_INSET;
  const d = isqrt(Math.floor((ring * ring) / 2));
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    obstacles.push({ id: obstacles.length + 1, kind: 'pillar', size: null, pos: vec(sx * d, sy * d), radius: rules.PILLAR_RADIUS, height: R.PILLAR_HEIGHT, wounds: null });
  }
  for (const o of setup.obstacles ?? []) {
    if (!(o.size in rules.BOULDERS)) throw new Error(`Unknown boulder size "${o.size}". Sizes: small, medium, large.`);
    obstacles.push(boulder(rules, obstacles.length + 1, o.size, vec(Math.round(o.x * R.PACE), Math.round(o.y * R.PACE))));
  }

  const rng = seededRandom(setup.seed ?? 1);
  const sizes: BoulderSize[] = ['small', 'medium', 'large'];
  const limit = rules.ARENA_RADIUS - rules.RIM_DEPTH;
  for (let n = 0; n < (setup.boulders ?? 0); n++) {
    const size = sizes[Math.floor(rng() * 3)];
    const r = rules.BOULDERS[size].radius;
    for (let tries = 0; tries < 60; tries++) {
      const p = vec(Math.floor((rng() * 2 - 1) * limit), Math.floor((rng() * 2 - 1) * limit));
      if (flatLen(p) > limit) continue;
      if (keepClear.some((c) => dist(flat(c), p) < r + rules.BOULDER_CLEARANCE)) continue;
      if (obstacles.some((o) => dist(o.pos, p) < o.radius + r + R.PACE)) continue;
      obstacles.push(boulder(rules, obstacles.length + 1, size, p));
      break;
    }
  }
  return { obstacles, zones: [] };
}

/** The obstacle a dragon's body would overlap at pos, if any. A dragon above an obstacle's top flies over it. */
export function obstacleAt(arena: Arena, pos: Vec, rules: Rules): Obstacle | null {
  for (const o of arena.obstacles) {
    if (pos.z < o.height && flatLen(sub(pos, o.pos)) < o.radius + rules.BODY_RADIUS) return o;
  }
  return null;
}

/**
 * The first obstacle on the straight line from one point to another, if any. Samples every ⅓ pace,
 * which is finer than the smallest boulder. Returns the obstacle and how far along the line it sits.
 */
export function obstacleOnLine(arena: Arena, from: Vec, to: Vec, skip = 0): Obstacle | null {
  let passed: Obstacle | null = null;
  let skipped = 0;
  const d = sub(to, from);
  const length = dist(from, to);
  const steps = Math.max(1, Math.floor(length / R.NOTCH));
  for (let i = 1; i < steps; i++) {
    const p = vec(from.x + Math.trunc((d.x * i) / steps), from.y + Math.trunc((d.y * i) / steps), from.z + Math.trunc((d.z * i) / steps));
    for (const o of arena.obstacles) {
      if (o === passed || p.z > o.height || flatLen(sub(p, o.pos)) > o.radius) continue;
      if (skipped < skip) {
        // Lance Throat punches through one obstacle.
        skipped++;
        passed = o;
        continue;
      }
      return o;
    }
  }
  return null;
}

export function inZone(zone: Zone, pos: Vec): boolean {
  // A lingering breath hangs where it was breathed; floor zones touch only grounded dragons.
  if (zone.kind === 'smolder') return dist(pos, zone.center) <= zone.radius;
  if (pos.z !== 0) return false;
  if (!zone.end) return flatLen(sub(pos, zone.center)) <= zone.radius;
  // A lane: distance from the segment, measured on the floor.
  const seg = sub(zone.end, zone.center);
  const rel = sub({ ...pos, z: 0 }, zone.center);
  const L2 = seg.x * seg.x + seg.y * seg.y;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, (rel.x * seg.x + rel.y * seg.y) / L2));
  return Math.hypot(rel.x - seg.x * t, rel.y - seg.y * t) <= zone.radius;
}

export function describeObstacle(o: Obstacle): string {
  return o.kind === 'pillar' ? `pillar ${o.id}` : `${o.size} boulder ${o.id}`;
}

// The arena floor: unbreakable rim pillars, breakable boulders, and lingering breath zones.
// Layout is seeded, so a replay reproduces the map [Proposed] §5.

import { dist, flat, flatLen, isqrt, sub, vec, type Vec } from './geometry.ts';
import { seededRandom } from './random.ts';
import * as R from './rules.ts';

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
  kind: 'burning' | 'corrosive';
  /** center on the floor (z = 0) */
  center: Vec;
  radius: number;
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

const boulder = (id: number, size: BoulderSize, pos: Vec): Obstacle => ({
  id, kind: 'boulder', size, pos, wounds: R.BOULDERS[size].wounds, radius: R.BOULDERS[size].radius, height: R.BOULDERS[size].height,
});

/** Four unbreakable pillars at the quadrants [Doc], plus boulders. Boulders never land on a dragon's starting spot. */
export function makeArena(setup: ArenaSetup = {}, keepClear: Vec[] = []): Arena {
  const obstacles: Obstacle[] = [];
  const d = isqrt(Math.floor((R.PILLAR_RING * R.PILLAR_RING) / 2));
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    obstacles.push({ id: obstacles.length + 1, kind: 'pillar', size: null, pos: vec(sx * d, sy * d), radius: R.PILLAR_RADIUS, height: R.PILLAR_HEIGHT, wounds: null });
  }
  for (const o of setup.obstacles ?? []) {
    if (!(o.size in R.BOULDERS)) throw new Error(`Unknown boulder size "${o.size}". Sizes: small, medium, large.`);
    obstacles.push(boulder(obstacles.length + 1, o.size, vec(Math.round(o.x * R.PACE), Math.round(o.y * R.PACE))));
  }

  const rng = seededRandom(setup.seed ?? 1);
  const sizes: BoulderSize[] = ['small', 'medium', 'large'];
  const limit = R.ARENA_RADIUS - R.RIM_DEPTH;
  for (let n = 0; n < (setup.boulders ?? 0); n++) {
    const size = sizes[Math.floor(rng() * 3)];
    const r = R.BOULDERS[size].radius;
    for (let tries = 0; tries < 60; tries++) {
      const p = vec(Math.floor((rng() * 2 - 1) * limit), Math.floor((rng() * 2 - 1) * limit));
      if (flatLen(p) > limit) continue;
      if (keepClear.some((c) => dist(flat(c), p) < r + R.BOULDER_CLEARANCE)) continue;
      if (obstacles.some((o) => dist(o.pos, p) < o.radius + r + R.PACE)) continue;
      obstacles.push(boulder(obstacles.length + 1, size, p));
      break;
    }
  }
  return { obstacles, zones: [] };
}

/** The obstacle a dragon's body would overlap at pos, if any. A dragon above an obstacle's top flies over it. */
export function obstacleAt(arena: Arena, pos: Vec): Obstacle | null {
  for (const o of arena.obstacles) {
    if (pos.z < o.height && flatLen(sub(pos, o.pos)) < o.radius + R.BODY_RADIUS) return o;
  }
  return null;
}

/**
 * The first obstacle on the straight line from one point to another, if any. Samples every ⅓ pace,
 * which is finer than the smallest boulder. Returns the obstacle and how far along the line it sits.
 */
export function obstacleOnLine(arena: Arena, from: Vec, to: Vec): Obstacle | null {
  const d = sub(to, from);
  const length = dist(from, to);
  const steps = Math.max(1, Math.floor(length / R.NOTCH));
  for (let i = 1; i < steps; i++) {
    const p = vec(from.x + Math.trunc((d.x * i) / steps), from.y + Math.trunc((d.y * i) / steps), from.z + Math.trunc((d.z * i) / steps));
    for (const o of arena.obstacles) {
      if (p.z <= o.height && flatLen(sub(p, o.pos)) <= o.radius) return o;
    }
  }
  return null;
}

export function inZone(zone: Zone, pos: Vec): boolean {
  return pos.z === 0 && flatLen(sub(pos, zone.center)) <= zone.radius;
}

export function describeObstacle(o: Obstacle): string {
  return o.kind === 'pillar' ? `pillar ${o.id}` : `${o.size} boulder ${o.id}`;
}

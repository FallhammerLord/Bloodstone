// Integer vector math in three dimensions. x and y lie across the arena floor; z is altitude.
// Every result is a whole number, computed the same way on every machine.

export interface Vec {
  x: number;
  y: number;
  z: number;
}

export const vec = (x: number, y: number, z = 0): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** The same vector laid flat on the floor. */
export const flat = (v: Vec): Vec => ({ x: v.x, y: v.y, z: 0 });

export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export const len = (v: Vec): number => isqrt(v.x * v.x + v.y * v.y + v.z * v.z);
export const dist = (a: Vec, b: Vec): number => len(sub(a, b));
/** Distance across the floor, ignoring altitude. */
export const flatLen = (v: Vec): number => isqrt(v.x * v.x + v.y * v.y);

/** Rounds half away from zero, identically on every machine. */
const roundDiv = (n: number, d: number): number => Math.sign(n) * Math.round(Math.abs(n) / d);

/** The same direction as v, at the given length. */
export function scaleTo(v: Vec, length: number): Vec {
  const l = len(v);
  if (l === 0) return { x: 0, y: 0, z: 0 };
  return { x: roundDiv(v.x * length, l), y: roundDiv(v.y * length, l), z: roundDiv(v.z * length, l) };
}

/**
 * Where p sits relative to an attacker at origin aiming along aim:
 * forward along the aim, and off-axis (straight-line distance from the aim line, any direction).
 */
export function frame(origin: Vec, aim: Vec, p: Vec): { forward: number; offAxis: number } {
  const d = sub(p, origin);
  const l = len(aim);
  if (l === 0) return { forward: 0, offAxis: len(d) };
  const cx = aim.y * d.z - aim.z * d.y;
  const cy = aim.z * d.x - aim.x * d.z;
  const cz = aim.x * d.y - aim.y * d.x;
  return {
    forward: Math.trunc((d.x * aim.x + d.y * aim.y + d.z * aim.z) / l),
    offAxis: Math.trunc(isqrt(cx * cx + cy * cy + cz * cz) / l),
  };
}

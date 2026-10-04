// Integer vector math. Every result is a whole number, computed the same way on every machine.

export interface Vec {
  x: number;
  y: number;
}

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export const len = (v: Vec): number => isqrt(v.x * v.x + v.y * v.y);
export const dist = (a: Vec, b: Vec): number => len(sub(a, b));

/** Rounds half away from zero, identically on every machine. */
const roundDiv = (n: number, d: number): number => Math.sign(n) * Math.round(Math.abs(n) / d);

/** The same direction as v, at the given length. */
export function scaleTo(v: Vec, length: number): Vec {
  const l = len(v);
  if (l === 0) return { x: 0, y: 0 };
  return { x: roundDiv(v.x * length, l), y: roundDiv(v.y * length, l) };
}

/** Where p sits relative to an attacker at origin aiming along aim: forward and lateral distance. */
export function frame(origin: Vec, aim: Vec, p: Vec): { forward: number; lateral: number } {
  const d = sub(p, origin);
  const l = len(aim);
  if (l === 0) return { forward: 0, lateral: 0 };
  return {
    forward: Math.trunc((d.x * aim.x + d.y * aim.y) / l),
    lateral: Math.trunc((aim.x * d.y - aim.y * d.x) / l),
  };
}

// Shared plumbing for the tournament, the diagnostics and the goldens: rule overrides from the command line,
// work spread over worker threads, and how sure a win rate is.

import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { DEFAULT_RULES, PACE, rulesWith, type Rules } from './rules.ts';

/**
 * Rule overrides from repeated `--rule KEY=VALUE` flags. KEY is a DEFAULT_RULES path (BREATH.blast.radius);
 * VALUE is a number in the rule's own units, or paces with a `p` suffix (0.75p). Returns the rules and a label.
 */
export function rulesFromArgs(argv: string[]): { rules: Rules; overrides: Record<string, unknown>; label: string } {
  const overrides: Record<string, unknown> = {};
  const labels: string[] = [];
  argv.forEach((a, i) => {
    if (a !== '--rule') return;
    const spec = argv[i + 1] ?? '';
    const m = /^([A-Za-z_][\w.]*)=(-?[\d.]+)(p?)$/.exec(spec);
    if (!m) throw new Error(`--rule takes KEY=VALUE, like BREATH.blast.radius=0.75p; got "${spec}".`);
    const [, path, num, paces] = m;
    const keys = path.split('.');
    let probe: unknown = DEFAULT_RULES;
    for (const k of keys) {
      if (!probe || typeof probe !== 'object' || !(k in probe)) throw new Error(`No rule named ${path}.`);
      probe = (probe as Record<string, unknown>)[k];
    }
    if (typeof probe !== 'number') throw new Error(`${path} isn't a number; name one of its fields.`);
    const value = paces ? Math.floor(Number(num) * PACE) : Number(num);
    let node = overrides;
    keys.slice(0, -1).forEach((k) => (node = (node[k] ??= {}) as Record<string, unknown>));
    node[keys.at(-1)!] = value;
    labels.push(`${path}=${num}${paces}`);
  });
  return { rules: rulesWith(overrides), overrides, label: labels.join(', ') || 'default rules' };
}

/** The value after a flag, or a default. */
export function flag(argv: string[], name: string, fallback: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
}

export const WORKERS = Math.max(1, Math.min(availableParallelism(), 8));

/**
 * Runs a module in `parts` worker threads, each handed { part, parts, ...data }, and returns what each posts back,
 * in part order. The module checks `isMainThread` and posts one message when done.
 */
export function inWorkers<T>(module: URL, data: Record<string, unknown> = {}, parts = WORKERS): Promise<T[]> {
  return Promise.all(Array.from({ length: parts }, (_, part) => new Promise<T>((resolve, reject) => {
    const w = new Worker(module, { workerData: { ...data, part, parts }, execArgv: process.execArgv });
    w.once('message', resolve);
    w.once('error', reject);
  })));
}

/** A 95% margin on a win rate, in percentage points (Wilson interval, half-width). */
export function margin(wins: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  return (100 * z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
}

/** "54% ±4", padded for tables. */
export function rateWithMargin(wins: number, n: number): string {
  const p = ((100 * wins) / Math.max(1, n)).toFixed(0).padStart(3);
  return `${p}% ±${margin(wins, n).toFixed(0).padEnd(2)}`;
}

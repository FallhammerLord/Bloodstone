// 1. The read: the opponent's habits from the public slot record, and guesses at its next script.

import type { ActionName, ActionSpec } from '../actions.ts';
import type { View } from '../bout.ts';
import { type Band, bandOf } from './styles.ts';

/**
 * The opponent's habits: how often it used each action, by range band, slot, and whether its Breath was
 * ready. Old habits fade. Guesses start from an informed prior (what is available and sensible at that
 * range) and lean toward what the opponent has actually shown.
 */
export class Read {
  private counts = new Map<string, Map<ActionName, number>>();

  constructor(view: View, memory: number) {
    const them = view.opp.side;
    for (const r of view.record) {
      const weight = Math.pow(memory, Math.max(0, view.exchange - r.exchange));
      const band = bandOf(r.separation);
      const ready = r.breathReady?.[them] ?? false;
      // Context: whether they were aloft and whether their meter was full shape what they do next.
      const ctx = `ctx|${band}|${r.z[them] > 0}|${r.meterFull?.[them] ?? false}`;
      for (const key of [`${band}|${r.slot}|${ready}`, `${band}|${ready}`, band, ctx]) {
        const m = this.counts.get(key) ?? new Map<ActionName, number>();
        m.set(r.actions[them], (m.get(r.actions[them]) ?? 0) + weight);
        this.counts.set(key, m);
      }
    }
  }

  /** A likely opponent action here, from what it could do and what it has done. */
  guess(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[], rng: () => number, ctx = ''): ActionSpec {
    return pick(legal, this.weights(band, slot, breathReady, legal, ctx), rng);
  }

  /** The single likeliest action here. */
  likeliest(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[], ctx = ''): ActionSpec {
    const w = this.weights(band, slot, breathReady, legal, ctx);
    return legal[w.indexOf(Math.max(...w))];
  }

  private weights(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[], ctx: string): number[] {
    const exact = this.counts.get(`${band}|${slot}|${breathReady}`);
    const ready = this.counts.get(`${band}|${breathReady}`);
    const general = this.counts.get(band);
    const context = ctx ? this.counts.get(`ctx|${band}|${ctx}`) : undefined;
    return legal.map((a) => prior(band, a) + 3 * (exact?.get(a.name) ?? 0) + 2 * (ready?.get(a.name) ?? 0) + (general?.get(a.name) ?? 0) + 2 * (context?.get(a.name) ?? 0));
  }
}

/** An educated guess before any habits are known: what a sensible dragon does at this range. */
export function prior(band: Band, a: ActionSpec): number {
  const table: Record<Band, Partial<Record<ActionName, number>>> = {
    melee: { claw: 3, bite: 2, stomp: 1.5, scales: 1.5, dodge: 1, retreat: 1, breath: 1 },
    close: { bite: 3, breath: 2.5, claw: 1, approach: 1.5, strafe: 1.5, scales: 1, retreat: 1 },
    far: { breath: 4, approach: 2, strafe: 2, retreat: 1, intimidate: 1, leap: 1 },
    veryFar: { approach: 3, strafe: 1, leap: 1, intimidate: 0.5 },
  };
  const base = table[band][a.name] ?? 0.4;
  return a.charge ? base * 0.5 : a.crunch ? base * 1.5 : base;
}

export function pick<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

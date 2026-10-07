// Reading the opponent: what it could do from here, weighted by what its own attacks are worth from here (asked of the
// Referee) and by what it has actually done at this range before. Only the public record is read.

import { ACTIONS, type ActionName, type ActionSpec } from '../actions.ts';
import type { View } from '../bout.ts';
import { bandOf, type Band, type Worth } from './probe.ts';

export class Read {
  /** how often the opponent has done each action at each band, older exchanges fading */
  private counts = new Map<Band, Map<ActionName, number>>();
  private theirs: Worth;

  constructor(view: View, memory: number, theirs: Worth) {
    this.theirs = theirs;
    const them = view.opp.side;
    for (const r of view.record) {
      const band = bandOf(r.separation);
      const w = memory ** Math.max(0, view.exchange - r.exchange);
      const m = this.counts.get(band) ?? new Map<ActionName, number>();
      m.set(r.actions[them], (m.get(r.actions[them]) ?? 0) + w);
      this.counts.set(band, m);
    }
  }

  /** How likely each legal action is: its worth to the opponent from here, plus its habit here. */
  weights(band: Band, legal: ActionSpec[]): number[] {
    const seen = this.counts.get(band);
    return legal.map((a) => {
      const cat = ACTIONS[a.name].category;
      const worth = cat === 'attack' ? 10 * (this.theirs.attack[band][a.name] ?? 0) : 0;
      const base = cat === 'attack' ? 0.3 + worth : 0.6;
      return (a.charge || a.setup ? 0.5 : 1) * base + 2 * (seen?.get(a.name) ?? 0);
    });
  }

  likeliest(band: Band, legal: ActionSpec[]): ActionSpec {
    const w = this.weights(band, legal);
    return legal[w.indexOf(Math.max(...w))];
  }

  guess(band: Band, legal: ActionSpec[], rng: () => number): ActionSpec {
    return pick(legal, this.weights(band, legal), rng);
  }
}

export function pick<T>(items: T[], weights: number[], rng: () => number): T {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

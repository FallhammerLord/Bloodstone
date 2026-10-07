// The crude brain: the floor every archetype must beat. No imagining, no reading, no look-ahead. Each slot it swings
// its best attack if one reaches (the Referee's numbers say which), guards now and then when the opponent hits harder
// from here, and otherwise walks toward its best band.

import type { ActionSpec } from '../actions.ts';
import type { Controller, View } from '../bout.ts';
import { seededRandom } from '../random.ts';
import * as R from '../rules.ts';
import { boutFromView } from './controller.ts';
import { legalActions, place, situation } from './options.ts';
import { nextSep } from './priors.ts';
import { bandOf, worth, type Band } from './probe.ts';

export function crudeController(seed = 1): Controller {
  const rng = seededRandom(seed);
  return {
    name: 'crude brain',
    script(view: View): ActionSpec[] {
      const base = boutFromView(view);
      const mine = worth(base, view.side);
      const theirs = worth(base, view.opp.side);
      const bands: Band[] = ['melee', 'close', 'far'];
      const home = bands.reduce((a, b) => (mine.best[b] > mine.best[a] ? b : a), 'far' as Band);
      let s = situation(view.me, view.globalSlot, view.rules);
      let sep = view.separation;
      const out: ActionSpec[] = [];
      while (out.length < R.SLOTS_PER_EXCHANGE) {
        const band = bandOf(sep);
        const legal = legalActions(s, rng).filter((a) => !a.charge && !a.setup && !a.crunch);
        const attacks = legal.filter((a) => (mine.attack[band][a.name] ?? 0) > 0);
        const best = attacks.sort((a, b) => (mine.attack[band][b.name] ?? 0) - (mine.attack[band][a.name] ?? 0))[0];
        let a: ActionSpec;
        if (theirs.best[band] > mine.best[band] && rng() < 0.3) a = { name: 'guard' };
        else if (best && rng() < 0.85) a = best;
        else if (band !== home) a = { name: sep > (home === 'melee' ? R.MELEE_EDGE : home === 'close' ? R.CLOSE_EDGE : R.FAR_EDGE) ? 'approach' : 'retreat' };
        else a = legal[Math.floor(rng() * legal.length)];
        sep = nextSep(sep, a, s);
        s = place(out, s, a);
      }
      return out.slice(0, R.SLOTS_PER_EXCHANGE);
    },
  };
}

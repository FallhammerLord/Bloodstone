// The bout: exchanges until a KO or the exchange limit, with late pressure and the timeout rule.

import type { ActionSpec } from './actions.ts';
import { len } from './geometry.ts';
import { SIDES, checkKO, other, runExchange, type Bout, type Event, type Fighter, type Moment, type Side } from './referee.ts';
import * as R from './rules.ts';

export interface Ruleset {
  exchangeLimit: number;
  /** campaign and ranked: the challenger forfeits; open lobbies may pick most Wounds [Doc] §9 */
  timeout: 'challengerForfeits' | 'mostWounds';
  /** rim pulses in the final three exchanges and a timeout verdict at the limit */
  lateGame: boolean;
}

export const DEFAULT_RULES: Ruleset = { exchangeLimit: R.EXCHANGE_LIMIT, timeout: 'challengerForfeits', lateGame: true };

/** What one side can see. Everything on the board is visible [Doc]; only the opponent's script is not. */
export interface View {
  side: Side;
  exchange: number;
  globalSlot: number;
  me: Fighter;
  opp: Fighter;
  separation: number;
  /** Wounds at the start of this exchange, to tell who was hit during it */
  startWounds: Record<Side, number>;
  history: Record<Side, string[]>;
}

export function viewOf(bout: Bout, side: Side): View {
  const copy = (f: Fighter): Fighter => structuredClone(f);
  const me = bout.fighters[side];
  const opp = bout.fighters[other(side)];
  return {
    side,
    exchange: bout.exchange,
    globalSlot: bout.globalSlot,
    me: copy(me),
    opp: copy(opp),
    separation: len({ x: me.pos.x - opp.pos.x, y: me.pos.y - opp.pos.y }),
    startWounds: { ...bout.startWounds },
    history: { A: [...bout.history.A], B: [...bout.history.B] },
  };
}

/** Anything that plays a side: a scenario file, an AI, later a person at the Scripter. */
export interface Controller {
  name: string;
  script(view: View): ActionSpec[];
  revise?(view: View, moment: Moment, opponentRevised: boolean): ActionSpec | null;
}

export function runBout(bout: Bout, controllers: Record<Side, Controller>, rules: Ruleset = DEFAULT_RULES, opts: { trace?: boolean } = {}): Event[] {
  const ev: Event[] = [];
  while (!bout.over && bout.exchange < rules.exchangeLimit) {
    const scripts = { A: controllers.A.script(viewOf(bout, 'A')), B: controllers.B.script(viewOf(bout, 'B')) };
    const revise = Object.fromEntries(
      SIDES.map((s) => [s, (b: Bout, side: Side, m: Moment, opp: boolean) => controllers[s].revise?.(viewOf(b, side), m, opp) ?? null]),
    );
    ev.push(...runExchange(bout, scripts, { trace: opts.trace, revise }));
    if (!bout.over && rules.lateGame) ev.push(...rimPulse(bout, rules));
  }
  if (!bout.over && rules.lateGame) ev.push(...timeout(bout, rules));
  return ev;
}

/**
 * Late pressure [Doc] §5: at the end of each of the final three exchanges, the rim pillars deal ⅓ of
 * maximum Wounds to dragons on the outer rim. Pulse 1 can't kill; pulse 2 kills only a dragon pulse 1
 * already hit; pulse 3 kills any dragon in range.
 */
export function rimPulse(bout: Bout, rules: Ruleset): Event[] {
  const ev: Event[] = [];
  const pulse = bout.exchange - (rules.exchangeLimit - 3);
  if (pulse < 1 || pulse > 3) return ev;
  for (const s of SIDES) {
    const f = bout.fighters[s];
    if (len(f.pos) < R.ARENA_RADIUS - R.RIM_DEPTH) continue;
    let damage = Math.floor(f.sheet.wounds / 3);
    const canKill = pulse === 3 || (pulse === 2 && f.pulsed);
    const capped = !canKill && damage >= f.wounds;
    if (capped) damage = f.wounds - 1;
    f.wounds -= damage;
    f.pulsed = true;
    ev.push({ kind: 'pulse', side: s, pulse, damage, woundsLeft: f.wounds, capped });
  }
  checkKO(bout, ev, R.TICKS_PER_SLOT - 1);
  return ev;
}

/** Timeouts are never lethal [Doc] §8. */
export function timeout(bout: Bout, rules: Ruleset): Event[] {
  const F = bout.fighters;
  let winner: Side;
  let reason: string;
  if (rules.timeout === 'challengerForfeits' || F.A.wounds === F.B.wounds) {
    winner = bout.challenged;
    reason = 'timeout: the challenger forfeits, non-lethally';
  } else {
    winner = F.A.wounds > F.B.wounds ? 'A' : 'B';
    reason = 'timeout: most Wounds remaining';
  }
  bout.over = true;
  bout.winner = winner;
  return [{ kind: 'boutEnd', winner, reason }];
}

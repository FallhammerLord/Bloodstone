// The bout: exchanges until a KO or the exchange limit, with late pressure and the timeout rule.

import type { ActionSpec } from './actions.ts';
import type { Arena } from './arena.ts';
import { flatLen, len, sub } from './geometry.ts';
import { SIDES, checkKO, other, runExchange, type Bout, type Event, type Fighter, type Moment, type Side, type SlotRecord } from './referee.ts';
import * as R from './rules.ts';
import type { Rules } from './rules.ts';

/** How a bout is played out, as opposed to the rules it plays by (bout.rules). */
export interface Format {
  /** defaults to the rules' EXCHANGE_LIMIT */
  exchangeLimit?: number;
  /** campaign and ranked: the challenger forfeits; open lobbies may pick most Wounds [Doc] §9 */
  timeout: 'challengerForfeits' | 'mostWounds';
  /** rim pulses in the final three exchanges and a timeout verdict at the limit */
  lateGame: boolean;
}

export const DEFAULT_FORMAT: Format = { timeout: 'challengerForfeits', lateGame: true };

const limitOf = (bout: Bout, format: Format) => format.exchangeLimit ?? bout.rules.EXCHANGE_LIMIT;

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
  /** obstacles and lingering zones: all visible */
  arena: Arena;
  /** what each dragon did in every slot so far, and from where */
  record: SlotRecord[];
  /** the rules this bout plays by: public, like the board */
  rules: Rules;
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
    separation: len(sub(me.pos, opp.pos)),
    startWounds: { ...bout.startWounds },
    history: { A: [...bout.history.A], B: [...bout.history.B] },
    arena: structuredClone(bout.arena),
    record: bout.record.map((r) => structuredClone(r)),
    rules: bout.rules,
  };
}

/** Anything that plays a side: a scenario file, an AI, later a person at the Scripter. */
export interface Controller {
  name: string;
  script(view: View): ActionSpec[];
  /** revealed: what Baleful Eye shows of the opponent's slot 3, or null */
  revise?(view: View, moment: Moment, opponentRevised: boolean, revealed: string | null): ActionSpec | null;
}

export function runBout(bout: Bout, controllers: Record<Side, Controller>, format: Format = DEFAULT_FORMAT, opts: { trace?: boolean } = {}): Event[] {
  const ev: Event[] = [];
  while (!bout.over && bout.exchange < limitOf(bout, format)) {
    const scripts = { A: controllers.A.script(viewOf(bout, 'A')), B: controllers.B.script(viewOf(bout, 'B')) };
    const revise = Object.fromEntries(
      SIDES.map((s) => [s, (b: Bout, side: Side, m: Moment, opp: boolean, seen: string | null) => controllers[s].revise?.(viewOf(b, side), m, opp, seen) ?? null]),
    );
    ev.push(...runExchange(bout, scripts, { trace: opts.trace, revise }));
    if (!bout.over && format.lateGame) ev.push(...rimPulse(bout, format));
  }
  if (!bout.over && format.lateGame) ev.push(...timeout(bout, format));
  return ev;
}

/**
 * Late pressure [Doc] §5: at the end of each of the final three exchanges, the rim pillars deal ⅓ of
 * maximum Wounds to dragons on the outer rim. Pulse 1 can't kill; pulse 2 kills only a dragon pulse 1
 * already hit; pulse 3 kills any dragon in range.
 */
export function rimPulse(bout: Bout, format: Format = DEFAULT_FORMAT): Event[] {
  const ev: Event[] = [];
  const pulse = bout.exchange - (limitOf(bout, format) - 3);
  if (pulse < 1 || pulse > 3) return ev;
  for (const s of SIDES) {
    const f = bout.fighters[s];
    if (flatLen(f.pos) < bout.rules.ARENA_RADIUS - bout.rules.RIM_DEPTH) continue;
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
export function timeout(bout: Bout, format: Format = DEFAULT_FORMAT): Event[] {
  const F = bout.fighters;
  let winner: Side;
  let reason: string;
  if (format.timeout === 'challengerForfeits' || F.A.wounds === F.B.wounds) {
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

// The bout: exchanges until a KO or the exchange limit, with late pressure and the timeout rule.

import type { ActionSpec } from './actions.ts';
import type { Arena } from './arena.ts';
import { flatLen, len, sub } from './geometry.ts';
import { SIDES, checkKO, other, runExchange, type Bout, type Event, type Fighter, type Moment, type Side, type SlotRecord } from './referee.ts';
import type { Lethal } from './referee/events.ts';
import * as R from './rules.ts';
import type { Rules } from './rules.ts';

/** How a bout is played out, as opposed to the rules it plays by (bout.rules). */
export interface Format {
  /** defaults to the rules' EXCHANGE_LIMIT */
  exchangeLimit?: number;
  /** campaign and ranked: the challenger forfeits; open lobbies may pick most Wounds [Doc] §9 */
  timeout: 'challengerForfeits' | 'mostWounds';
  /** the Barrier Pulse (PULSE_START on) and a timeout verdict at the limit */
  lateGame: boolean;
}

export const DEFAULT_FORMAT: Format = { timeout: 'challengerForfeits', lateGame: true };

const limitOf = (bout: Bout, format: Format) => format.exchangeLimit ?? bout.rules.EXCHANGE_LIMIT;

/**
 * The Barrier Pulse's schedule [Proposed]: it fires at the end of exchange PULSE_START, every other exchange through
 * PULSE_EVERY_OTHER_UNTIL, then every exchange to the limit. Public, like the rules.
 */
export function pulseAt(rules: Rules, exchange: number, limit = rules.EXCHANGE_LIMIT): boolean {
  if (exchange < rules.PULSE_START || exchange > limit) return false;
  return exchange > rules.PULSE_EVERY_OTHER_UNTIL || (exchange - rules.PULSE_START) % 2 === 0;
}
/** The next exchange, from `from` on, whose end brings a pulse; null if none comes before the limit. */
export function nextPulse(rules: Rules, from: number, limit = rules.EXCHANGE_LIMIT): number | null {
  for (let x = Math.max(from, rules.PULSE_START); x <= limit; x++) if (pulseAt(rules, x, limit)) return x;
  return null;
}
/** Whom the pulse at the end of `exchange` can kill: the first leaves 1; the every-other run kills only a dragon an
 *  earlier pulse hit; once it fires every exchange it kills anyone on the rim. */
export function pulseLethal(rules: Rules, exchange: number): Lethal {
  if (exchange === rules.PULSE_START) return 'never';
  return exchange > rules.PULSE_EVERY_OTHER_UNTIL ? 'all' : 'pulsed';
}

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
  /** who is challenged: public, and it decides a timeout */
  challenged: Side;
  /** the Barrier Pulse: the exchange whose end brings the next one (null: none left), and whom it can kill */
  pulse: { at: number | null; lethal: Lethal | null };
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
    challenged: bout.challenged,
    pulse: (() => {
      const at = nextPulse(bout.rules, bout.exchange + 1);
      return { at, lethal: at === null ? null : pulseLethal(bout.rules, at) };
    })(),
  };
}

/** Anything that plays a side: a scenario file, an AI, later a person at the Scripter. */
export interface Controller {
  name: string;
  script(view: View): ActionSpec[];
  /** revealed: what Baleful Eye shows of the opponent's slot 3, or null */
  revise?(view: View, moment: Moment, opponentRevised: boolean, revealed: string | null): ActionSpec | null;
  /** at an exchange boundary, during scripting: whether this side yields the bout to save its dragon [Proposed] */
  yields?(view: View): boolean;
}

export function runBout(bout: Bout, controllers: Record<Side, Controller>, format: Format = DEFAULT_FORMAT, opts: { trace?: boolean } = {}): Event[] {
  const ev: Event[] = [];
  while (!bout.over && bout.exchange < limitOf(bout, format)) {
    // The alert: as scripting begins, both sides learn the pulse ends this exchange or the next.
    const upcoming = format.lateGame ? nextPulse(bout.rules, bout.exchange + 1, limitOf(bout, format)) : null;
    if (upcoming !== null && upcoming <= bout.exchange + 2) ev.push({ kind: 'pulseWarning', exchange: bout.exchange + 1, at: upcoming, lethal: pulseLethal(bout.rules, upcoming) });
    const scripts = { A: controllers.A.script(viewOf(bout, 'A')), B: controllers.B.script(viewOf(bout, 'B')) };
    const revise = Object.fromEntries(
      SIDES.map((s) => [s, (b: Bout, side: Side, m: Moment, opp: boolean, seen: string | null) => controllers[s].revise?.(viewOf(b, side), m, opp, seen) ?? null]),
    );
    ev.push(...runExchange(bout, scripts, { trace: opts.trace, revise }));
    if (!bout.over && format.lateGame) ev.push(...rimPulse(bout, format));
    // A yield [Proposed]: at an exchange boundary a tamer may yield to save its dragon. Non-lethal; the victor is
    // paid in Ichor instead of spoils. If both would, the challenger yields.
    if (!bout.over && bout.exchange < limitOf(bout, format)) {
      const yielding = SIDES.filter((s) => controllers[s].yields?.(viewOf(bout, s)));
      if (yielding.length) {
        const s = yielding.length === 2 ? other(bout.challenged) : yielding[0];
        bout.over = true;
        bout.winner = other(s);
        ev.push({ kind: 'boutEnd', winner: bout.winner, reason: `yield: ${bout.fighters[s].name} yields to save its dragon` });
      }
    }
  }
  if (!bout.over && format.lateGame) ev.push(...timeout(bout, format));
  return ev;
}

/**
 * Late pressure [Doc] §5, the Barrier Pulse [Proposed]: at the end of each scheduled exchange (pulseAt) the rim pillars
 * deal ⅓ of maximum Wounds to dragons on the outer rim. The first pulse can't kill; through the every-other run a pulse
 * kills only a dragon an earlier pulse hit; once it fires every exchange it kills any dragon in range.
 */
export function rimPulse(bout: Bout, format: Format = DEFAULT_FORMAT): Event[] {
  const ev: Event[] = [];
  const limit = limitOf(bout, format);
  if (!pulseAt(bout.rules, bout.exchange, limit)) return ev;
  let pulse = 0;
  for (let x = bout.rules.PULSE_START; x <= bout.exchange; x++) if (pulseAt(bout.rules, x, limit)) pulse++;
  const lethal = pulseLethal(bout.rules, bout.exchange);
  for (const s of SIDES) {
    const f = bout.fighters[s];
    if (flatLen(f.pos) < bout.rules.ARENA_RADIUS - bout.rules.RIM_DEPTH) continue;
    let damage = Math.floor(f.sheet.wounds / 3);
    const canKill = lethal === 'all' || (lethal === 'pulsed' && f.pulsed);
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

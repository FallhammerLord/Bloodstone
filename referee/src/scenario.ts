// Scenario files: hand-written scripts, AI sides, and scripted revisions.

import { HOLD, parseAction, type ActionSpec } from './actions.ts';
import type { ArenaSetup } from './arena.ts';
import { aiController, STYLES, type Style } from './ai.ts';
import { DEFAULT_RULES, type Controller, type Ruleset, type View } from './bout.ts';
import type { FighterSetup, Moment, Side } from './referee.ts';
import * as R from './rules.ts';

/**
 * A scripted revision for slot 3.
 *   at:  1 or 2, the end of which slot to decide at (default 2)
 *   if:  "always", "opponent revised", "i was hit", "i landed", "separation <= N", "separation >= N" (paces)
 *   to:  the new slot-3 action
 */
export interface RevisionRule {
  at?: Moment;
  if?: string;
  to: string;
}

export type SideScript = string[] | { slots: string[]; revise?: RevisionRule };

export interface Scenario {
  title?: string;
  note?: string;
  separation?: number;
  challenged?: Side;
  /** play a full bout: exchange limit, rim pulses, timeout */
  bout?: boolean;
  exchangeLimit?: number;
  timeout?: Ruleset['timeout'];
  A: FighterSetup & { ai?: Style; seed?: number };
  B: FighterSetup & { ai?: Style; seed?: number };
  exchanges?: Partial<Record<Side, SideScript>>[];
  /** boulders: random ("boulders", "seed") or placed ("obstacles": [{ size, x, y }] in paces) */
  arena?: ArenaSetup;
}

export function rulesFor(sc: Scenario): Ruleset {
  if (sc.bout) {
    return {
      exchangeLimit: sc.exchangeLimit ?? DEFAULT_RULES.exchangeLimit,
      timeout: sc.timeout ?? DEFAULT_RULES.timeout,
      lateGame: true,
    };
  }
  // Without "bout", play only the listed exchanges: no pulses, no timeout verdict.
  return { ...DEFAULT_RULES, exchangeLimit: sc.exchanges?.length ?? 1, lateGame: false };
}

export function separationOf(sc: Scenario): number {
  return sc.separation ?? R.START_SEPARATION / R.PACE;
}

function conditionHolds(cond: string, view: View, opponentRevised: boolean): boolean {
  const c = cond.trim().toLowerCase();
  if (c === 'always') return true;
  if (c === 'opponent revised') return opponentRevised;
  if (c === 'i was hit') return view.me.wounds < view.startWounds[view.side];
  if (c === 'i landed') return view.opp.wounds < view.startWounds[view.opp.side];
  const m = c.match(/^separation\s*(<=|>=)\s*([\d.]+)$/);
  if (m) {
    const limit = Number(m[2]) * R.PACE;
    return m[1] === '<=' ? view.separation <= limit : view.separation >= limit;
  }
  throw new Error(`Unknown revision condition "${cond}".`);
}

export function scenarioController(sc: Scenario, side: Side): Controller {
  const setup = sc[side];
  if (setup.ai && !STYLES.includes(setup.ai)) throw new Error(`Unknown AI style "${setup.ai}". Styles: ${STYLES.join(', ')}.`);
  const ai = setup.ai ? aiController(setup.ai, setup.seed ?? 1) : null;
  let rule: RevisionRule | null = null;
  let usingAi = false;

  return {
    name: ai ? ai.name : 'script',
    script(view: View): ActionSpec[] {
      const entry = sc.exchanges?.[view.exchange]?.[side];
      if (entry) {
        usingAi = false;
        const slots = Array.isArray(entry) ? entry : entry.slots;
        rule = Array.isArray(entry) ? null : (entry.revise ?? null);
        if (rule) parseAction(rule.to); // fail early on a typo
        return slots.map(parseAction);
      }
      rule = null;
      if (ai) {
        usingAi = true;
        return ai.script(view);
      }
      return [HOLD, HOLD, HOLD];
    },
    revise(view: View, moment: Moment, opponentRevised: boolean): ActionSpec | null {
      if (usingAi && ai?.revise) return ai.revise(view, moment, opponentRevised);
      if (!rule || (rule.at ?? 2) !== moment) return null;
      return conditionHolds(rule.if ?? 'always', view, opponentRevised) ? parseAction(rule.to) : null;
    },
  };
}

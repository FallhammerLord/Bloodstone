// The Referee: two dragons, two scripts, an exact outcome. No drawing, no randomness, integers only.
//
// Per tick, in order [Proposed] §4 Resolution order:
//   1. movement for both dragons
//   2. attacks starting their wind-up lock their aim
//   3. hit detection, evasion tests, near-miss checks
//   4. damage and statuses, applied together
//   5. end-of-window checks (near misses, Intimidate)
//   6. KO checks
//
// The resolver lives in src/referee/, one concern per module; this file is its public face.
// Not modeled yet: compounds, hazards beyond boulders, claw sweep timing, Acumen-scaled punishes, extended morphs.

export { SIDES, other, buildSheet, newBout } from './referee/state.ts';
export type { Side, Statuses, Marks, Chain, Fighter, Bout, ShardSetup, SlotRecord, FighterSetup } from './referee/state.ts';
export type { Event, PlanInfo } from './referee/events.ts';
export { timing } from './referee/plan.ts';
export { runExchange, simulateSlot, checkKO } from './referee/exchange.ts';
export type { Moment, Reviser, ExchangeOptions } from './referee/exchange.ts';

// Everything the Referee reports. Text is for people; every event also says what happened in a form tools can count:
// notes carry a tag, hits carry tags for their modifiers, evades say how. Tools never match on text.

import type { ActionName } from '../actions.ts';
import type { Vec } from '../geometry.ts';
import type { Moment } from './exchange.ts';
import type { Side } from './state.ts';

export interface PlanInfo {
  label: string;
  windup: number;
  active: number;
  recovery: number;
  interruptedAt: number | null;
  /** a crunch: each half's wind-up, active and recovery, 15 ticks apiece */
  halves?: [number, number, number][];
}

/** What a note records. Every note has one, so a renamed note can't silently drop out of a statistic. */
export type NoteTag =
  // movement
  | 'blocked-move' | 'leash' | 'carry-cut' | 'gravity'
  // aspects and attack roles
  | 'stoop' | 'stoop-too-soon' | 'lunge' | 'pounce'
  // charges and crunches
  | 'charge-held' | 'charge-released' | 'charge-broken' | 'breath-broken' | 'reflected' | 'hard-landing' | 'crunch-capped' | 'crunch-refused'
  // a scripted action that can't happen this slot
  | 'held-instead'
  // the elements
  | 'push' | 'push-stopped' | 'pull' | 'pull-stopped' | 'verb-held' | 'zone-held' | 'push-pull-cancel' | 'slam'
  | 'boulder-shoved' | 'boulder-shattered' | 'corroded'
  // the Acumen meter
  | 'meter-fill' | 'meter-full' | 'meter-spent'
  // Intimidate
  | 'intimidate-lands' | 'intimidate-short' | 'demoralized'
  // chains and statuses
  | 'chain-held' | 'chain-lapsed' | 'staggered'
  // Techniques (dragonshards-technique.md)
  | 'technique';

/** What shaped a hit's damage, beyond its base. */
export type HitTag = 'true-damage' | 'charged' | 'pounce' | 'crunched' | 'intimidate' | 'demoralized' | 'chain' | 'punish' | 'corroded' | 'stoop' | 'reflected';

export type Event =
  | { kind: 'exchangeStart'; exchange: number }
  | { kind: 'slotStart'; exchange: number; slot: number }
  | { kind: 'note'; tick: number; side: Side; tag: NoteTag; text: string }
  | { kind: 'aim'; tick: number; side: Side; action: ActionName; distance: number }
  | { kind: 'hit'; tick: number; attacker: Side; action: ActionName; damage: number; parts: string[]; tags: HitTag[]; interrupt: boolean; trade: boolean; woundsLeft: number }
  | { kind: 'evade'; tick: number; attacker: Side; action: ActionName; how: 'moving' | 'dodging' | 'serpentine'; text: string }
  | { kind: 'nearMiss'; tick: number; attacker: Side; action: ActionName; meter: number }
  | { kind: 'whiff'; tick: number; attacker: Side; action: ActionName }
  | { kind: 'trace'; tick: number; positions: Record<Side, Vec> }
  | { kind: 'slotEnd'; exchange: number; slot: number; plans: Record<Side, PlanInfo>; positions: Record<Side, Vec>; separation: number; wounds: Record<Side, number>; meters: Record<Side, number> }
  | { kind: 'ko'; tick: number; side: Side }
  | { kind: 'revision'; side: Side; moment: Moment; from: string; to: string }
  | { kind: 'pulse'; side: Side; pulse: number; damage: number; woundsLeft: number; capped: boolean }
  | { kind: 'obstacle'; tick: number; attacker: Side; action: ActionName; obstacle: string; damage: number; destroyed: boolean; through: boolean }
  | { kind: 'zone'; tick: number; owner: Side; zone: 'burning' | 'corrosive' | 'smolder'; center: Vec; end?: Vec }
  | { kind: 'zoneEffect'; side: Side; zone: 'burning' | 'corrosive' | 'smolder'; damage: number; woundsLeft: number }
  | { kind: 'boutEnd'; winner: Side; reason: string };

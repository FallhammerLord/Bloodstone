// Everything the Referee reports. Notes are for people; the other kinds are for tools.

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

export type Event =
  | { kind: 'exchangeStart'; exchange: number }
  | { kind: 'slotStart'; exchange: number; slot: number }
  | { kind: 'note'; tick: number; side: Side; text: string }
  | { kind: 'aim'; tick: number; side: Side; action: ActionName; distance: number }
  | { kind: 'hit'; tick: number; attacker: Side; action: ActionName; damage: number; parts: string[]; interrupt: boolean; graze: boolean; trade: boolean; woundsLeft: number }
  | { kind: 'evade'; tick: number; attacker: Side; action: ActionName; text: string }
  | { kind: 'nearMiss'; tick: number; attacker: Side; action: ActionName; meter: number }
  | { kind: 'whiff'; tick: number; attacker: Side; action: ActionName }
  | { kind: 'trace'; tick: number; positions: Record<Side, Vec> }
  | { kind: 'slotEnd'; exchange: number; slot: number; plans: Record<Side, PlanInfo>; positions: Record<Side, Vec>; separation: number; wounds: Record<Side, number>; meters: Record<Side, number> }
  | { kind: 'ko'; tick: number; side: Side }
  | { kind: 'revision'; side: Side; moment: Moment; from: string; to: string }
  | { kind: 'pulse'; side: Side; pulse: number; damage: number; woundsLeft: number; capped: boolean }
  | { kind: 'obstacle'; tick: number; attacker: Side; action: ActionName; obstacle: string; damage: number; destroyed: boolean; through: boolean }
  | { kind: 'zone'; tick: number; owner: Side; zone: 'burning' | 'corrosive' | 'smolder'; center: Vec }
  | { kind: 'zoneEffect'; side: Side; zone: 'burning' | 'corrosive' | 'smolder'; damage: number; woundsLeft: number }
  | { kind: 'boutEnd'; winner: Side; reason: string };

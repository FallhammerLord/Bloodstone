// Turns the Referee's event log into readable text. Presentation only: it decides nothing.

import { ACTIONS } from './actions.ts';
import type { Controller } from './bout.ts';
import type { Bout, Event, PlanInfo, Side } from './referee.ts';
import { other } from './referee.ts';
import * as R from './rules.ts';

const MORPH_NAMES = { 'true-dragon': 'True Dragon', wyvern: 'Wyvern', wyrm: 'Wyrm' } as const;
const ASPECT_NAMES = { stalwart: 'Stalwart', talons: 'Talons', serpentine: 'Serpentine' } as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const paces = (units: number) => (units / R.PACE).toFixed(1);

export function bandOf(units: number): string {
  // A band's outer edge belongs to it: reach extends "to the band's outer edge" [Doc].
  if (units <= R.MELEE_EDGE) return 'Melee';
  if (units <= R.CLOSE_EDGE) return 'Close';
  if (units <= R.FAR_EDGE) return 'Far';
  return 'Very Far';
}

/** 30 characters: - wind-up, # active, = recovery, x cancelled by an interrupt. */
export function bar(p: PlanInfo): string {
  let out = '';
  for (let t = 0; t < R.TICKS_PER_SLOT; t++) {
    if (p.interruptedAt !== null && t >= p.interruptedAt) out += 'x';
    else if (p.halves) {
      const [w, a] = p.halves[t < R.HALF ? 0 : 1];
      const local = t % R.HALF;
      out += local < w ? '-' : local < w + a ? '#' : '=';
    } else if (t < p.windup) out += '-';
    else if (t < p.windup + p.active) out += '#';
    else out += '=';
  }
  return out;
}

export function rosterLines(bout: Bout, controllers?: Record<Side, Controller>): string[] {
  const lines: string[] = [];
  for (const s of ['A', 'B'] as Side[]) {
    const f = bout.fighters[s];
    const h = f.sheet;
    const who = controllers ? `, played by ${controllers[s].name}` : '';
    lines.push(`${s}  ${f.name}: ${MORPH_NAMES[h.morph]} + ${cap(h.stone)} stone (${h.preference}, ${h.flies ? 'flies' : 'grounded'}, Aspect: ${ASPECT_NAMES[h.aspect]})${who}`);
    lines.push(`   Wounds ${h.wounds}  Evasion ${h.evasion}  Hardness ${h.hardness}  Accuracy ${h.accuracy}`);
    lines.push(`   Claw ${h.claw}  Bite ${h.bite}  Breath ${h.breath}  Affinity ${h.affinity}  Acumen ${h.acumen}`);
    const L = f.loadout;
    if (L.names.length) lines.push(`   Shards: ${L.names.join(', ')}${L.seating.length ? `. Seating: ${L.seating.join(' ')}` : ''}`);
  }
  const sep = Math.abs(bout.fighters.B.pos.x - bout.fighters.A.pos.x);
  lines.push(`Starting separation: ${paces(sep)} paces (${bandOf(sep)})`);
  const boulders = bout.arena.obstacles.filter((o) => o.kind === 'boulder');
  lines.push(`Arena: 4 rim pillars${boulders.length ? `; ${boulders.map((o) => `${o.size} boulder ${o.id} at (${paces(o.pos.x)}, ${paces(o.pos.y)})`).join(', ')}` : '; open floor'}.`);
  return lines;
}

export function report(bout: Bout, events: Event[]): string[] {
  const out: string[] = [];
  const name = (s: Side) => `${s} ${bout.fighters[s].name}`;
  const label = (s: Side) => bout.fighters[s].name;
  let buffer: string[] = [];
  let ending: string[] = [];
  let inSlot = false;
  // Events between slots (revisions, pulses) print straight away; events inside a slot wait for its bars.
  const say = (line: string) => (inSlot ? buffer : out).push(line);
  const at = (t: number) => `  t${String(t).padStart(2, '0')}  `;

  for (const e of events) {
    switch (e.kind) {
      case 'exchangeStart':
        out.push('', `════ Exchange ${e.exchange} ════`);
        break;
      case 'slotStart':
        buffer = [];
        inSlot = true;
        break;
      case 'note':
        buffer.push(`${at(e.tick)}${label(e.side)}: ${e.text}`);
        break;
      case 'aim':
        buffer.push(`${at(e.tick)}${label(e.side)}'s ${ACTIONS[e.action].label} winds up, aimed at ${paces(e.distance)} paces (${bandOf(e.distance)}).`);
        break;
      case 'hit': {
        const verb = e.graze ? 'GRAZES' : 'HITS';
        const tags = [e.interrupt ? 'interrupts' : '', e.trade ? 'trade' : ''].filter(Boolean).join(', ');
        buffer.push(`${at(e.tick)}${label(e.attacker)}'s ${ACTIONS[e.action].label} ${verb} ${label(other(e.attacker))} for ${e.damage}${tags ? ` (${tags})` : ''}.`);
        buffer.push(`        ${e.parts.join(' ')}  →  ${label(other(e.attacker))} at ${Math.max(0, e.woundsLeft)}`);
        break;
      }
      case 'evade':
        buffer.push(`${at(e.tick)}${label(other(e.attacker))} evades ${label(e.attacker)}'s ${ACTIONS[e.action].label}: ${e.text}.`);
        break;
      case 'nearMiss':
        buffer.push(`${at(e.tick)}${label(e.attacker)}'s ${ACTIONS[e.action].label} near-misses. Acumen meter ${e.meter}/${R.METER_MAX}.`);
        break;
      case 'whiff':
        buffer.push(`${at(e.tick)}${label(e.attacker)}'s ${ACTIONS[e.action].label} whiffs.`);
        break;
      case 'trace':
        buffer.push(`${at(e.tick)}A (${paces(e.positions.A.x)}, ${paces(e.positions.A.y)}, up ${paces(e.positions.A.z)})  B (${paces(e.positions.B.x)}, ${paces(e.positions.B.y)}, up ${paces(e.positions.B.z)})`);
        break;
      case 'slotEnd': {
        out.push('', `── Slot ${e.slot} ──`);
        const width = Math.max(e.plans.A.label.length, e.plans.B.label.length);
        for (const s of ['A', 'B'] as Side[]) {
          out.push(`  ${s}  ${e.plans[s].label.padEnd(width)}  ${bar(e.plans[s])}`);
        }
        out.push(...buffer);
        if (buffer.length === 0) out.push('  (nothing lands)');
        out.push(
          `  End of slot: ${paces(e.separation)} paces apart (${bandOf(e.separation)}). ` +
            `Wounds ${name('A')} ${Math.max(0, e.wounds.A)}, ${name('B')} ${Math.max(0, e.wounds.B)}. ` +
            `Acumen meters ${e.meters.A} / ${e.meters.B}.`,
        );
        const aloft = (['A', 'B'] as Side[]).filter((s) => e.positions[s].z > 0);
        if (aloft.length) out.push(`  Aloft: ${aloft.map((s) => `${label(s)} ${paces(e.positions[s].z)} paces up`).join(', ')}.`);
        buffer = [];
        inSlot = false;
        break;
      }
      case 'obstacle': {
        const what = e.damage > 0 ? ` for ${e.damage}${e.destroyed ? ', destroying it' : ''}` : ' (unbreakable)';
        say(`${at(e.tick)}${label(e.attacker)}'s ${ACTIONS[e.action].label} strikes the ${e.obstacle} in the way${what}.${e.through ? ' The slurry eats through and carries on.' : ''}`);
        break;
      }
      case 'zone':
        say(`${at(e.tick)}${label(e.owner)}'s breath leaves ${e.zone === 'burning' ? 'a burning zone' : e.zone === 'corrosive' ? 'a corrosive pool' : 'a smoldering area (Smoldering Maw)'} at (${paces(e.center.x)}, ${paces(e.center.y)}).`);
        break;
      case 'zoneEffect':
        say(e.zone === 'burning'
          ? `  🔥 ${label(e.side)} ends the slot in a burning zone: ${e.damage} damage → ${Math.max(0, e.woundsLeft)}.`
          : e.zone === 'corrosive'
            ? `  ☣ ${label(e.side)} ends the slot in a corrosive pool: Hardness −${R.CORRODE_HARDNESS} next slot.`
            : `  ♨ ${label(e.side)} ends the slot in a smoldering area: ${e.damage} damage and the breath's verb → ${Math.max(0, e.woundsLeft)}.`);
        break;
      case 'revision':
        say(`  ⚡ ${label(e.side)} revises slot 3 at the end of slot ${e.moment}. The opponent sees only the flash. (Replay view: ${e.from} → ${e.to}.)`);
        break;
      case 'pulse':
        say(`  ◎ Rim pulse ${e.pulse} strikes ${label(e.side)} on the outer rim for ${e.damage}${e.capped ? ' (this pulse can\'t kill)' : ''} → ${Math.max(0, e.woundsLeft)}.`);
        break;
      case 'ko':
        say(`${inSlot ? at(e.tick) : '  '}${label(e.side)} falls.`);
        break;
      case 'boutEnd':
        ending = ['', `★ ${name(e.winner)} wins (${e.reason}).`];
        break;
    }
  }
  return [...out, ...ending];
}

export const LEGEND = 'Bars: - wind-up   # active   = recovery   x cancelled by interrupt   (1 character = 1 tick)';

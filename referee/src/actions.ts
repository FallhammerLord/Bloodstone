// The action menu: categories, timing profiles, cooldowns.

export type ActionName =
  | 'bite' | 'claw' | 'breath' | 'stomp'
  | 'approach' | 'retreat' | 'strafe' | 'leap' | 'dive'
  | 'dodge' | 'scales'
  | 'intimidate'
  | 'hold';

export type Category = 'attack' | 'move' | 'guard' | 'intimidate' | 'hold';

export interface ActionDef {
  category: Category;
  /** wind-up / active / recovery ticks */
  profile: readonly [number, number, number];
  cooldown: number;
  label: string;
}

export const ACTIONS: Record<ActionName, ActionDef> = {
  bite: { category: 'attack', profile: [12, 6, 12], cooldown: 0, label: 'Bite' }, // [Proposed]
  claw: { category: 'attack', profile: [6, 15, 9], cooldown: 0, label: 'Claw' }, // [Proposed]
  breath: { category: 'attack', profile: [12, 9, 9], cooldown: 2, label: 'Breath' }, // [Proposed]
  stomp: { category: 'attack', profile: [15, 6, 9], cooldown: 2, label: 'Stomp' }, // [Proposed]
  approach: { category: 'move', profile: [3, 24, 3], cooldown: 0, label: 'Approach' }, // [Assumed]
  retreat: { category: 'move', profile: [3, 24, 3], cooldown: 0, label: 'Retreat' }, // [Assumed]
  strafe: { category: 'move', profile: [3, 24, 3], cooldown: 0, label: 'Strafe' }, // [Assumed]
  leap: { category: 'move', profile: [3, 24, 3], cooldown: 0, label: 'Leap' }, // [Assumed]
  dive: { category: 'move', profile: [3, 24, 3], cooldown: 0, label: 'Dive' }, // [Assumed]
  dodge: { category: 'guard', profile: [6, 12, 12], cooldown: 1, label: 'Dodge' }, // [Assumed]: active 6-17 covers a Bite's window; cooldown [Proposed]
  scales: { category: 'guard', profile: [3, 24, 3], cooldown: 0, label: 'Scales' }, // [Assumed]
  intimidate: { category: 'intimidate', profile: [9, 12, 9], cooldown: 0, label: 'Intimidate' }, // [Assumed]
  hold: { category: 'hold', profile: [0, 30, 0], cooldown: 0, label: 'Hold' }, // the timeout default [Doc]
};

export interface ActionSpec {
  name: ActionName;
  /** strafe direction around the opponent */
  dir?: 'cw' | 'ccw';
  /** claw sweep (recorded; sweep timing is not modeled yet) */
  sweep?: 'left' | 'right';
  /** Sidewinder Spine: a strafe that also shifts along the line, toward (in) or away (out) */
  shift?: 'in' | 'out';
  /** set when this slot 3 was revised; a revised slot 3 gets no chain bonus [Proposed] */
  revised?: boolean;
}

export const HOLD: ActionSpec = { name: 'hold' };

/** Reads "bite", "strafe:cw", "claw:left", and so on. */
export function parseAction(text: string): ActionSpec {
  const [raw, detail, extra] = text.trim().toLowerCase().split(':');
  if (!(raw in ACTIONS)) throw new Error(`Unknown action "${text}".`);
  const name = raw as ActionName;
  if (name === 'strafe') {
    if (detail !== 'cw' && detail !== 'ccw') throw new Error(`Strafe needs a direction: "strafe:cw" or "strafe:ccw".`);
    if (extra !== undefined && extra !== 'in' && extra !== 'out') throw new Error(`A strafe shift is "in" or "out": "strafe:cw:in".`);
    return extra ? { name, dir: detail, shift: extra } : { name, dir: detail };
  }
  if (name === 'claw') {
    const sweep = detail ?? 'left';
    if (sweep !== 'left' && sweep !== 'right') throw new Error(`Claw sweep is "left" or "right".`);
    return { name, sweep };
  }
  if (detail !== undefined) throw new Error(`"${raw}" takes no detail.`);
  return { name };
}

export function describe(spec: ActionSpec): string {
  const label = ACTIONS[spec.name].label;
  if (spec.dir) return `${label} (${spec.dir === 'cw' ? 'clockwise' : 'counterclockwise'}${spec.shift ? `, shifting ${spec.shift}` : ''})`;
  if (spec.sweep) return `${label} (${spec.sweep})`;
  return label;
}

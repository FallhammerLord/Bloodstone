// Attack shapes, in three dimensions: "off-axis" is distance from the aim line in any direction.
// Each test takes a "grow" amount so the same shape also draws Accuracy's phantom band.

import type { ActionName } from './actions.ts';
import type { CoreStone, StatSheet } from './hatch.ts';
import { add, dist, frame, len, scaleTo, type Vec } from './geometry.ts';
import * as R from './rules.ts';

export type Shape = 'bite' | 'claw' | 'stomp' | 'line' | 'narrowCone' | 'wideCone' | 'blast';

// [Doc] §3 Breath shapes for the core quartet
const BREATH_SHAPE: Record<CoreStone, Shape> = { water: 'line', earth: 'narrowCone', fire: 'blast', air: 'wideCone' };

export function shapeOf(action: ActionName, sheet: StatSheet): Shape {
  if (action === 'breath') return BREATH_SHAPE[sheet.stone];
  if (action === 'bite' || action === 'claw' || action === 'stomp') return action;
  throw new Error(`${action} has no attack shape.`);
}

export function inShape(shape: Shape, sheet: StatSheet, origin: Vec, aim: Vec, target: Vec, grow: number): boolean {
  const { forward: f, offAxis: l } = frame(origin, aim, target);
  switch (shape) {
    case 'bite':
      return f > 0 && f <= R.BITE_REACH + grow && l <= R.BITE_HALF_WIDTH + grow;
    case 'claw':
      return dist(origin, target) <= R.CLAW_REACH + grow && f >= -R.CLAW_BACK - grow;
    case 'stomp':
      // A ground quake: it misses anything aloft [Doc].
      return target.z === 0 && dist(origin, target) <= R.STOMP_RADIUS[sheet.age] + grow;
    case 'line':
      return f > 0 && f <= R.BREATH.line.reach + grow && l <= R.BREATH.line.halfWidth + grow;
    case 'narrowCone':
      return f > 0 && f <= R.BREATH.narrowCone.reach + grow && 4 * l <= f + R.PACE + 4 * grow;
    case 'wideCone':
      return f > 0 && f <= R.BREATH.wideCone.reach + grow && l <= f + grow;
    case 'blast': {
      const center = add(origin, scaleTo(aim, Math.min(len(aim), R.BREATH.blast.maxCenter)));
      return dist(center, target) <= R.BREATH.blast.radius + grow;
    }
  }
}

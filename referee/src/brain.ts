// The brain: an AI tamer that reads its opponent, imagines the exchange in the Referee, and chooses
// among good scripts by its style's values. It sees only what a player sees.
//
//   1. Read      tally the opponent's habits from the public slot record          brain/read.ts
//   2. Imagine   play candidate scripts against predicted opponent scripts         brain/controller.ts
//   3. Value     score each imagined outcome by the style's priorities             brain/value.ts
//   4. Choose    pick among the best with weighted chance, so it can bluff         brain/controller.ts
//   5. Tell      each style keeps a readable habit; lower skill shows it more      brain/controller.ts
//
// Styles, tastes and skill levels live in brain/styles.ts; legal options in brain/options.ts.

export { BRAIN_STYLES, SKILLS, allowed } from './brain/styles.ts';
export type { BrainStyle, Skill } from './brain/styles.ts';
export { Read } from './brain/read.ts';
export { value } from './brain/value.ts';
export { brainController } from './brain/controller.ts';

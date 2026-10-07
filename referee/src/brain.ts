// The brains: AI tamers that see only what a player sees.
//
//   archetype brain  imagine scripts, guess the opponent, play both in the Referee, value the outcome by the
//                    archetype's goals, look ahead by skill, choose          brain/controller.ts
//   crude brain      no imagining: its best reaching attack, or a step toward its best band        brain/crude.ts
//
// Goals and skill levels live in brain/archetypes.ts; outcome features and value in brain/features.ts; attack worth,
// asked of the Referee, in brain/probe.ts; what gets imagined in brain/priors.ts; the opponent read in brain/read.ts;
// legal options in brain/options.ts; drafting in brain/hatchery.ts.

export { ARCHETYPES, SKILLS, GOALS, SKILL, skillOf } from './brain/archetypes.ts';
export type { Archetype, Skill } from './brain/archetypes.ts';
export { brainController, boutFromView } from './brain/controller.ts';
export { crudeController } from './brain/crude.ts';
export { features, value } from './brain/features.ts';
export { worth } from './brain/probe.ts';

// The tools' names for the archetypes.
export { ARCHETYPES as BRAIN_STYLES } from './brain/archetypes.ts';
export type { Archetype as BrainStyle } from './brain/archetypes.ts';

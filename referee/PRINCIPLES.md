# Rule-change checklist

Run this for every rule change, before the tournament. The first list is the design doc's principles (§1), each with the question to ask of the change. The second list is how the Referee keeps a change honest.

## The principles

| Principle | Ask of the change |
|---|---|
| Every safe option needs a punish. | Does it create a safe option (a move, guard or range nothing punishes)? Name the answer to it. |
| Visible state turns guesses into reads. No hidden information. | Is everything it depends on on the board, in the record, or in a `View`? |
| Information matters only when it persists to a decision point. | Does what it reveals last until slot 3 or the next script? |
| Power grows mostly in options, less in numbers. | Is it a new option, or only a bigger number? Prefer the option. |
| The arena is the market. | Can a player see it on a rival's dragon? |
| Each morph bends one rule. | Does it blur a morph's one bend, or give a morph a second? |
| Morph sets how you play; element sets who you're strong against; combat decides who wins. | Does it let a morph or a stone decide a fight before combat does? Check the pairing spread. |
| Players control anything that affects power. Randomness lives only in flavor. | Is it deterministic from the scripts? (The Referee rolls no dice.) |
| Turtling is legal and boring, and it loses for whoever needs to win. | Does it make turtling win? Check timeouts and the counterpuncher. |
| A steep learning cliff with a high plateau is acceptable. | Can a brain at master skill find the depth? Does a novice still play a fight? |

## Resolution order

Hits resolve in layers, and a change should respect them: **geometry** first (is the target in the shape?), then **Accuracy against Evasion** for a moving or dodging target, then **Acumen** on a tie. Evasion is distance and timing; Accuracy is the aim window and the counter to Evasion. A swift dragon that reaches safe geometry before the active window escapes.

Prefer rule-level fixes to special cases. A carve-out for one morph, stone or style is a sign the rule underneath needs the fix.

## Keeping a change honest

1. **Tag it.** A new dial goes in `DEFAULT_RULES` (`src/rules.ts`), marked [Proposed] or [Assumed], with a one-line reason. The design doc gets the same [Proposed] text.
2. **Test the rule, not just the number.** A test states what happens ("a push and a pull cancel"), reading values from `DEFAULT_RULES`.
3. **Update the brains.** Check the rule-to-brain table in the README ("When a rule changes, update the brains"). A brain playing by old patch notes can't play well.
4. **Re-record the goldens** in the same commit (`npm run golden -- --write`), and say in the message what changed and why.
5. **Run the tournament** (`npm run brains -- --skill master`), and log the round in `referee-findings.md`: what changed, the table against the last round, what it shows.
6. **Audit the dials** (`npm run dials`) when a [Proposed] rule settles: drop the tag in both places.

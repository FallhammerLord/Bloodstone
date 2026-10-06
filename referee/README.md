# The Referee

The Dragon Duel rules engine. It takes two dragons and their scripts and works out exactly what happens, tick by tick. It draws nothing and rolls no dice: the same scripts always produce the same fight.

Also here: `PRINCIPLES.md` (the checklist for every rule change), `DIALS.md` (every [Proposed] and [Assumed] number, from `npm run dials`), and `ROADMAP.md` (the cleanup plan).

## Running it

Needs [Node.js](https://nodejs.org) 22 or newer. From this folder:

```sh
npm install                                  # once, for the type checker
npm run duel -- scenarios/footsies-melee.json  # run a fight and print it
npm test                                     # check the Referee against the design doc
npm run brains -- --skill master             # the brain tournament (see "The brain tournament")
npm run check                                # type-check everything
```

Add `--trace` to a duel to print both dragons' positions every tick, or `--json` for the raw event log.

### Tools for balance work

```sh
npm run golden                                         # did a refactor change any fight? (--write records new goldens)
npm run brains -- --skill master --rule BREATH.blast.radius=1p --json out.json
npm run diag:pairing -- --morph true-dragon --stone fire --bouts 40   # one pairing against the field, and why
npm run diag:movement -- --bouts 4                     # how each morph moves, and what it costs
npm run ladder -- HEAD~2 HEAD~1 HEAD -- brains --skill novice         # one script at several commits
npm run dials > DIALS.md                               # the [Proposed]/[Assumed] audit
npm run brains -- --skill master --seed 2027 --json b.json  # an independent run; then:
npm run pool -- a.json b.json                          # pool runs for tighter margins
npm run brains -- --skill master --shards              # every dragon carries a random 3-pip wyrmling-grade loadout; ranks the shards
npm run draft -- --skill master                       # the hatch tournament: each brain drafts egg, stone and shards by its style
npm run gauntlet -- --cards cards.md                  # the living ladder: tamers raise wyrmlings rung by rung on spoils
```

- `--rule KEY=VALUE` changes one dial for a whole run, without editing `DEFAULT_RULES`. KEY is a path into the rules (`BURN_DAMAGE`, `BREATH.blast.radius`); VALUE is in the rule's own units, or paces with a `p` suffix. Repeat it for several dials. The brains tournament and both diagnostics take it.
- Win rates print with a 95% margin (`54% ±4`). Two rates whose margins overlap may not differ.
- **Goldens** are 144 fixed-seed brain bouts and every scenario, hashed. A refactor must keep them identical; a rule change re-records them in the same commit. `npm test` checks the scenario half.
- **Ladder** runs each commit in its own temporary git worktree and saves each run to `ladder/<ref>.txt`.

## Writing a scenario

A scenario is a small text file in `scenarios/`. Copy one and edit it.

```json
{
  "title": "Footsies at Melee",
  "separation": 2,
  "A": { "name": "Ash", "morph": "true-dragon", "stone": "air" },
  "B": { "name": "Brine", "morph": "true-dragon", "stone": "water" },
  "exchanges": [
    { "A": ["claw:left", "hold", "hold"], "B": ["bite", "hold", "hold"] }
  ]
}
```

- **separation:** starting distance in paces. Melee is up to 3, Close up to 6, Far up to 9, Very Far up to 12.
- **morph:** `true-dragon`, `wyvern`, `wyrm`. **stone:** `water`, `earth`, `fire`, `air`.
- **exchanges:** three actions per side per exchange. Add more exchanges to fight on toward a KO.
- **Actions:** `bite`, `claw:left`, `claw:right`, `breath`, `stomp`, `approach`, `retreat`, `strafe:cw`, `strafe:ccw`, `leap`, `dive`, `dodge`, `scales`, `intimidate`, `hold`.
- **Charges:** `charge:bite` or `charge:breath` takes this slot and the next. The charging slot guards like Scales; a landed hit breaks the charge; the release hits for +3 and can't be revised. No charging in slot 3.
- **Crunches:** `crunch:claw` or `crunch:bite` puts two attacks in one slot, 15 ticks each, with no modifiers and no chain. Needs Raking Talons (Claw) or Gnashing Teeth (Bite); a Wyrmling-grade one only after a landed hit of that attack in the slot before.
- **separation** is optional; it defaults to 6.5 paces (Far, just outside Bite range).

**Full bouts.** Add `"bout": true` to play until a KO or the exchange limit (8), with rim pulses in the final three exchanges and the timeout rule at the end. `"exchangeLimit"` changes the limit. `"timeout": "mostWounds"` gives an open-lobby timeout to the dragon with more Wounds; the default is that the challenger forfeits. `"challenged"` is `"A"` or `"B"` (default B). Exchanges you don't script are played by the side's AI, or held.

**AI sides.** Add `"ai": "brawler"` (and optionally `"seed": 7`) to a side. Brain styles are below, under Brains. The crude styles, kept for comparison:
- **brawler:** closes in and hits. Claw up close, Bite at Close, Breath at Far.
- **skirmisher:** keeps range. Breathes at Far, backs off when crowded.
- **guardian:** waits for you to commit. Guards, dodges, counters up close.
- **mixed:** picks a different habit each slot.

**Revisions.** Write a side's exchange as an object to give slot 3 a revision rule:

```json
"A": { "slots": ["bite", "bite", "bite"], "revise": { "at": 1, "if": "separation <= 3", "to": "claw:left" } }
```

`at` is 1 or 2: decide at the end of that slot (default 2). `if` is one of `always`, `opponent revised`, `i was hit`, `i landed`, `separation <= N`, `separation >= N`.

## Reading the output

Each slot shows both actions as 30-character bars, one character per tick:

```
A  Claw (left)  ------###############=========
B  Bite         ------xxxxxxxxxxxxxxxxxxxxxxxx
```

`-` wind-up, `#` active, `=` recovery, `x` cancelled by an interrupt. Below the bars, every hit shows its arithmetic. ⚡ marks a revision. In play the opponent sees only the flash; the report is a replay seen from above, so it also shows the new action. ◎ marks a rim pulse. "Aloft" lines show altitude.

## Movement

Bands are the range game; paces are hit geometry [Proposed]. Approach, Retreat, Leap and Dive carry one band (3 paces) for every dragon; a script may land `short` or `long` (`retreat:long`), by up to Evasion ÷ 6 paces. Strafe carries Evasion × ⅓ pace. A move's wind-up is followed by an evasive active window of 2 × Evasion ticks, then recovery; travel takes 72 ÷ Evasion ticks and can run on into recovery for slow dragons, where a hit counts as a punish. Staggered halves Evasion for the next move. Between slots, separation snaps to the nearest ½ pace, so where a dragon lands in a band matters only for that action. The brain tournament reports how far each morph travels and at what range fights happen.

## Aim

An attack's aim follows its target through the wind-up and settles 12 − Accuracy ticks before the strike [Proposed], never less than 1 tick and never longer than the wind-up. Movement after the aim settles is what the shape must cover, so a blast's radius and a line's width decide close calls, and a fast mover slips what a slow one can't. A stoop and a crunch's halves keep their own aim.

## Altitude

Leap rises and Dive descends, up to one band each, to a ceiling of 9 paces. Approach, Retreat and Strafe move across the floor. Distances, reach, range bands and the leash all count height. The Wyrm is grounded: its Leap is a hop that lands by the end of the slot, and it can't Dive. Stomp misses anything aloft, and a dragon in the air can't Stomp. Evasion beyond the one-band move cap makes moves finish sooner.

## Aspects

Each morph bends one rule (design doc §2).
- **True Dragon, Stalwart** [Proposed]: master of the charged Breath. Its own zones never harm it, and each charging slot widens its released Breath by ½ pace. Its 45 Wounds are base (the old +9 Aspect is folded in).
- **Wyvern, Talons:** it bends the one-band move rule in its Leap, which climbs two bands. A Claw from the air against a grounded opponent within Far is a stoop: the Wyvern descends to the ground during the wind-up, carrying at most a band forward (never closer than 1½ paces short of the target) or a band back (`claw:left:back`), and swipes both ways. From Close it connects; from Far it falls short. The descent takes 2 ticks a pace, so a one-band stoop strikes at tick 12 and a two-band stoop at tick 18, late enough for a Stomp to catch it landing. It deals +1 per 2 paces fallen. Against an airborne opponent it simply claws. Its price is positional: it must have been aloft since the exchange began, and it lands in Bite range.
- **Wyrm, Serpentine:** its Strafe tests Evasion with Dodge's +3. It is grounded: its Leap is a hop, and it can't Dive.

## Breath effects

At wyrmling strength (design doc §3):
- **Water** pushes the target back a whole band (3 paces). **Air**'s vortex pulls the target a band toward the breather, lowering a flier without grounding it; a second vortex in the breather's own space throws anything at Melee back out to Close, so the pull ends at Close. A push and a pull in the same moment cancel. Any forced movement that meets the wall or an obstacle slams for 3 [Proposed]. Water's jet shoves a boulder a band instead of breaking it. Any landed hit breaks a charge. **Affinity is the element's Evasion** [Proposed]: a verb (push, pull, burn, corrosion, a smolder's tug) takes hold only if the breather's Potency beats the target's Affinity, ties to the higher Acumen. **The Acumen meter** [Proposed] is fueled by Affinity: it starts at age bracket × 10 + 3 × Affinity, and each trigger (a near miss, a Scales or Dodge slot held to the end, a Breath charging slot, a landed Breath for the breather) adds Affinity + 9. Full at 100, the next landed Bite, Claw or Breath deals true damage (no Hardness, no Affinity, no verb contest) plus Affinity ÷ 3, and drains it. A miss, a Stomp or a Technique's side-hit spends nothing. Grazes are retired. **Gravity** [Proposed]: a flier that doesn't Leap during an exchange drops a band at its end; a Wyvern can stoop only if aloft since the exchange began. **Intimidate** that reaches also demoralizes: the target's next Bite or Claw loses 3. **Stomp** has no near misses (Accuracy's phantom band belongs to aimed attacks), deals 3 + Hardness ÷ 3 and shatters boulders inside its radius. **Crunches** come once per exchange and never lunge, pounce or stoop.
- **Breath damage by element:** Water +2, Air 0, Earth +1, Fire −2. Harmless extras earn points; harmful ones cost them.
- **Fire** leaves a burning zone where it lands; **Earth** leaves a corrosive pool. Zones last through the next slot. A grounded dragon inside one at a slot's end takes 1 damage (burning) or loses 3 Hardness for the next slot (corrosive), whoever breathed it.

## Obstacles

The arena has four unbreakable rim pillars. Scenarios can add boulders: `"arena": { "boulders": 2, "seed": 5 }` scatters them by seed, and `"arena": { "obstacles": [{ "size": "large", "x": 0, "y": 0 }] }` places them in paces. Boulders are small, medium or large, with 3, 6 or 9 Wounds.
- A move into an obstacle is blocked and becomes a dodge. A flyer above a boulder's top passes over it.
- An attack that meets an obstacle on the way to its target hits the obstacle instead. Stomp shakes the ground and isn't blocked.
- Earth's slurry eats obstacles: double damage, and if it destroys the obstacle it carries on to the target.

## Shards

A wyrmling's array is one valence of three pips (pips 0, 1 and 2), treated as a ring so any two pips are adjacent. Seat shards per side in a scenario, in order:

```json
"shards": [
  { "shard": "Bastion Plates", "pips": [0, 1] },
  { "shard": "Snapping Jaw", "grade": "adult", "pips": [2] }
]
```

- **Body and Bloodstone** (all 40): names carry their grade. Wyrmling, Juvenile and Adult chips add 1, 2 or 3 points on one pip. Elder and Venerable splinters take two pips, add 3 points and a conditional +3 rider; a Venerable adds 1 point of a related attribute. Riders apply in play when their condition holds (half Wounds, aloft, guarding with Scales, a target at a different altitude, a chain's final link, a target at Far, an element that beats your stone).
- **Techniques** (all 20) need a grade. They take one pip (Lance Throat and Bellows Chest two) and one more at Elder and Venerable.
- **Seating locks.** A shard seated over another strips the covered shard's rider first, then its value; a chip covered is destroyed.
- Supports wait for seams, and Traits are Elder-and-Venerable rule bends; neither is built yet.
- Strafe shifts for Sidewinder Spine are written `strafe:cw:in` or `strafe:ccw:out`. Baleful Eye's reveal can drive a scripted revision: `"if": "revealed attack"`.

## Brains

Brains are AI tamers that think. Give a side `"ai": "swarmer"` (any style below) and optionally `"skill": "novice" | "adept" | "master"` and `"seed"`. See `scenarios/brains.json`.

How a brain decides, each exchange:
1. **Read.** It tallies the opponent's habits from the public slot record: what it did, by range band, slot, and whether its Breath was ready. Old habits fade. Before it has seen anything, it guesses from what's available and sensible at that range. A charge on the board is a certainty.
2. **Imagine.** It writes candidate scripts, mostly in its style's lean, including charges and any crunches its shards allow. Adept and master brains also build counter-scripts against their likeliest guesses, testing each slot in the Referee. Then it plays every candidate against every guess in a copy of the bout.
3. **Value.** It scores each imagined outcome by its style's priorities.
4. **Choose.** It picks among good scripts with weighted chance, so it can bluff and isn't perfectly predictable.
5. **Revise.** At the end of slot 2 it imagines slot 3 again, using a Baleful Eye reveal if it has one, and revises when a new idea is clearly better.
6. **Tell.** Each style keeps one readable habit. Novices show it 90% of the time, adepts 50%, masters 15%.

It sees only what a player sees: the board, the record, and its own script.

| Style | Plays like | Values | Tell |
|---|---|---|---|
| swarmer | pressure, claws and chains up close | being in Melee, live chains | beyond Close, it opens by closing in |
| out-boxer | range, breath, footwork | being at Far; hates being hit | at Close or nearer, it opens by backing off |
| slugger | few hits, each one big | big hits, punishes, a banked Intimidate | it intimidates right before its big Bite |
| counterpuncher | guard, make them miss, punish | the opponent's misses, punishes; hates being hit | after taking a hit, it opens with Scales |
| boxer-puncher | balanced | damage dealt against taken | after an exchange that went its way, it repeats the script |
| aerialist | altitude and stoops | being aloft above a grounded opponent | on the ground, it opens by taking to the air |
| reader | information | locking the opponent's revision, a Baleful Eye reveal | it opens by intimidating |
| claw-focus | attacks only with Claw (crunched if it can); moves and guards to get to Melee | being at Melee | beyond Melee, it opens by closing in |
| bite-focus | attacks only with Bite (charged or crunched if it can); holds Close | being at Close | at Melee it backs off; beyond Bite reach it closes in |
| breath-focus | attacks only with Breath (charged if it can); holds Far | being at Far | at Close or nearer, it opens by backing off |

Skill sets how many scripts it imagines (8, 14, 28), how many opponent guesses it tests each against (4, 6, 12), how far ahead it looks (1, 2 or 3 exchanges), how tightly it sticks to its best idea, and how long it remembers your habits. Looking ahead, an adept or master plays its best few scripts (plus a few others, so a plan that pays off later gets a hearing) forward through the next exchanges, both sides on habit, and judges the whole line, later exchanges counting less. It keeps the next exchange of its chosen line as a plan, offered again next exchange if it still fits.

`npm run brains` (add `-- --skill master`) runs the brain tournament across four workers: a balanced brain against the crude AIs, every style against every other on identical dragons (with a check for boxing's swarmer > out-boxer > slugger triangle), and every pairing against every other with random styles. It reports damage by attack type and each attack's land rate, every action's share of slots, and what came of them (revisions, Intimidates landed and cashed, evades, verbs landed and held, slams, setups). Arenas throw 1d4+2 boulders.

### When a rule changes, update the brains

A brain playing by old patch notes can't play well. For each kind of rule change, the brain code to check:

| Rule area | Brain code |
|---|---|
| A new or changed action, or its cooldown | `brain/options.ts` `legalActions` and `advance`; `brain/styles.ts` `LEAN`; `brain/read.ts` `prior` |
| Movement (band moves, depth, altitude) | `brain/options.ts` `legalActions` (depth) and `advance` (altitude) |
| Attack reach, shapes, damage | `brain/styles.ts` `idealBand` (rough damage per attempt); `brain/controller.ts` `tell` (reach thresholds); `brain/read.ts` `prior` |
| Charges, lunges, pounces, crunches | `brain/options.ts` `legalActions` and `place`; `brain/controller.ts` `counterScript` (two-slot ideas); `brain/styles.ts` `CHARGE_LEAN` |
| The Acumen meter | `brain/value.ts` `SHARED.meterGain` and the meter-focus `WEIGHTS`; `brain/read.ts` (the meter-full context) |
| Forced movement and slams | `brain/value.ts` `pinned` and `SHARED.pinned` |
| Zones (burning lanes, pools: shape, duration, burn) | `brain/value.ts` `zoneThreat` and `SHARED.zoneStanding` |
| Element verbs and debuffs (corrosion, the wheel in contests) | `brain/value.ts` `SHARED.corrodedPending`, `zoneThreat` |
| Statuses that last (Stagger) | `brain/value.ts` `SHARED.staggerPending` |
| The stoop (its reach and payoff) | `brain/value.ts` `inStoopReach`, `stoopThreat` and `SHARED.stoopPending`; `brain/styles.ts` aerialist lean; `ai.ts` `altitudeHabit` |
| Reaches (bands) and shapes | `brain/styles.ts` `idealBand`; `brain/controller.ts` `tell`; `brain/read.ts` `prior` |
| New action forms (hard landing, reversal) | `brain/options.ts` `legalActions` and `advance`; the Referee's imagined fights do the rest |
| Intimidate, demoralize, carry-over | `brain/value.ts` `SHARED` pending terms |
| Aspects (stoop, Talons' two-band Leap, Stalwart, Serpentine) | `brain/options.ts` `legalActions` (the back stoop) and `advance` (Leap height); `brain/value.ts` aerialist `perch`; `brain/read.ts` (the aloft context) |
| Late game (rim pulses, timeouts) | `brain/value.ts` `SHARED.rim` |
| A new style | `brain/styles.ts` (`TASTE`, `LEAN`, `MISS_TASTE`); `brain/value.ts` `WEIGHTS`; `brain/controller.ts` `tell` |

Every value weight is named in `brain/value.ts` (`SHARED` for all styles, `WEIGHTS` per style), with its reason. `test/brain-behavior.test.ts` checks a few clear choices (a claw-focus claws at Melee, a full meter pulls toward Breath at Close), so a rule change that breaks a style shows up there.

## Attack roles

Hits resolve in layers: geometry first (is the target in the shape?), then Accuracy against Evasion for a moving or dodging target, then Acumen on a tie. A swift dragon that reaches safe geometry before the active window is meant to escape.

Three [Proposed] rules give each attack a role. They began as switches and are now part of the rules everywhere: tests, scenarios and tournaments play the same game.
- **Charge:** a one-slot charge releases with no bonus. Scripting the same charge again holds it a second slot (Bite or Breath, slots 1–2), and that release earns +3. Bellows Chest restores the +3 on any Breath charge, then adds its own.
- **Lunge:** a Bite right after an Approach that moved carries the dragon up to 1 pace along its line during the wind-up. Pure geometry: Evasion still applies, and a retreat that outruns it escapes. Only the first Bite after the Approach lunges.
- **Pounce:** a Claw right after a Strafe that moved advances up to one band along its line during the active window, sweeping its arc as it goes, and pierces 3 Hardness. It stops 1½ paces short of where the target stood. An airborne Wyvern that strafes into its stoop gets the pierce on the stoop.

A fourth, mandatory Breath charge, was tried and retired in Round 7.

Brains are updated with every rule change, so none plays by old patch notes. Their value counts what's pending when a slot or exchange ends (an Intimidate bonus, a demoralize, a setup), and their reads key on whether the opponent is aloft and whether its meter is full. Every style has an ideal band, from its taste for each attack and its own dragon's attacks (Claw at Melee, Bite at Close, Breath at Far), and values forcing misses by style. Diagnostic brains: meter-focus plays the Acumen meter, charge-focus two-slot charges, kite-focus position. They plan the setups as two-slot ideas (Approach then Bite, Strafe then Claw, a two-slot charge), weighed by their style's taste for both halves, and every style reads leverage: a target pinned within a band of the wall or an obstacle, its own exposure, and charges broken. The brain tournament prints how often a Bite follows an Approach and a Claw follows a Strafe.

## Where the numbers live

Every dial is in `src/rules.ts` (`DEFAULT_RULES`), `src/actions.ts` (timing profiles) and `src/hatch.ts` (stat sheets). Units (ticks, paces, bands) are fixed constants; everything else is a dial. Each bout carries its rules as `bout.rules`, and controllers see them in their `View`. To try a change without editing the defaults, pass `rulesWith({ ... })` to `newBout`. Each dial is tagged by where it came from:
- **[Doc]:** settled in the design doc.
- **[Proposed]:** marked [Proposed] in the design doc.
- **[Assumed]:** a placeholder this build needed. The numbers pass should replace these.

## The tournament

`npm run draft` (add `-- --skill novice|adept|master`) is the hatch tournament: every brain drafts its own egg, bloodstone and wyrmling-grade shards by its playstyle (`src/brain/hatchery.ts`), then fights every other style. Ladders draft 0, 1 and 3 pips of shards. A draft is a weighted draw: skill sets how tightly a brain sticks to its style's best pick, and a novelty bonus pulls it toward builds its style has picked least. It reports each style's win rate and builds (with their spread), and each build, morph, stone and shard's pick and win rates.

`npm run gauntlet` (add `-- --tamers N --rounds N --cards file`) is the living ladder. Each tamer (one brain style) raises one wyrmling at a time. Each round, dragons fight a random dragon on their own rung (pips of shards), or an unclaimed dragon when the rung is odd. A loss is death; three straight wins earn one pick from the victim's spoils (its morph's Body shard, its stone's Bloodstone shard, and its intact array) and a step up. A full three-pip array makes a wyrmling champion, who retires. Tamers learn: novice until they first reach rung 1, adept there, master from rung 2. Their drafts learn on curves: novelty fades as a tamer hatches more dragons (1 ÷ (1 + hatched ÷ 5)), and a build's record weighs in as 4 × (win rate − ½) × n ÷ (n + 4) for n fights, so a proven build outweighs novelty. At a spoils pick a tamer seats a shard; or melts one into its Ichor (1 per pip; the tamer's, outliving its dragons) and freezes a wyrmling-grade shard of its choosing (2 Ichor per pip), Techniques included; or melts and banks, staying on its rung to chase a better shard. A tamer plans the whole array: it values arrays with diminishing returns for shards serving the same want, counts later picks only as likely as its dragon is to reach them (three straight wins), and only for what the field on its rung is likely to drop; skill sets how far ahead it plans (novice none, adept one pick, master two). Yields and timeouts are non-lethal: a yield (before the bout, or at an exchange boundary) pays the victor 1, 2 or 3 Ichor by the ladder, and a tamer without it can't yield; a timeout pays the victor the same. `--kills N` sets kills per spoils pick (3). Seasons: `--save file` writes every tamer's state at the end, and `--carry file` brings back a saved season's champion tamers (anyone who raised a champion) with their records, Ichor and learned builds, rerolling the rest. Season rosters live in `seasons/`; `seasons/season1.json` is rebuilt from the first run's hall of champions. It reports builds by rung (win rate and field share), the drift in hatches, styles, skill, spoils, the hall of champions, and writes tamer cards with match histories.

`npm run tourney` (add `-- --shards` for random, seeded 3-pip loadouts and a shard ranking) fights each of the 12 core pairings against the other 11, under all 16 combinations of AI styles, once as challenger and once as challenged: 4,224 bouts in a few seconds. It prints win rates by pairing, morph and stone, and the most one-sided matchups. Add `-- --rounds 3` for more bouts.

Each bout's arena throws 1d4+2 seeded boulders, so it's never an open floor. The AIs are crude, so the numbers mean "strong in crude hands."

## Not built yet

Supports, Traits, compounds (Tendon Weave), hazards beyond boulders (pits, traps, atmospherics), Salt/Magma/Lightning/Storm breaths, extended morphs, claw sweep timing, Acumen-scaled punishes, and growth past wyrmling.

## Files

| File | Job |
|---|---|
| `src/rules.ts` | Units and `DEFAULT_RULES`, every dial |
| `src/actions.ts` | The action menu and timing profiles |
| `src/hatch.ts` | Egg + stone → stat sheet; the element wheel |
| `src/shapes.ts` | Attack shapes and the phantom band |
| `src/geometry.ts` | Whole-number vector math, in 3D |
| `src/arena.ts` | Pillars, boulders, lingering zones |
| `src/random.ts` | Seeded random numbers for AI and map layout |
| `src/referee.ts` | The resolver's public face |
| `src/referee/` | The resolver: `state` (fighters, bouts), `events`, `plan` (an action's timing and bends), `exchange` (slots, revisions), `tick` (the resolution order), `movement`, `damage`, `elements`, `meter`, `riders`, `techniques` |
| `src/bout.ts` | Exchanges to a KO, rim pulses, timeouts; what each side can see |
| `src/ai.ts` | Crude AI tamers: habits only |
| `src/brain.ts` | Brain AI tamers' public face |
| `src/brain/` | `styles` (tastes, leanings, skill), `read`, `options` (legal scripts), `value` (named weights), `controller` (imagine, choose, revise, tell) |
| `src/brains.ts`, `src/brains-worker.ts` | The brain tournament, in parallel |
| `src/scenario.ts` | Scenario files, scripted revisions |
| `src/shards.ts` | Shard catalog, the array, seating and overlap, compiling a loadout |
| `src/tourney.ts` | The balance harness |
| `src/report.ts` | Turns the event log into text |
| `src/cli.ts` | Runs a scenario file |
| `src/golden.ts` | Golden masters: `npm run golden` checks a refactor changed nothing |
| `src/harness.ts` | Shared tooling: `--rule` overrides, worker threads, win-rate margins |
| `src/diagnostics/` | `pairing` (a pairing against the field) and `movement` (the movement census) |
| `src/ladder.ts` | One npm script across several commits |
| `src/dials.ts` | Writes `DIALS.md`, the [Proposed]/[Assumed] audit |
| `src/pool.ts` | Pools tournament JSON files from independent seeds |
| `test/*.test.ts` | Design-doc claims as tests |

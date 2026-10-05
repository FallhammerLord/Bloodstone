# The Referee

The Dragon Duel rules engine. It takes two dragons and their scripts and works out exactly what happens, tick by tick. It draws nothing and rolls no dice: the same scripts always produce the same fight.

## Running it

Needs [Node.js](https://nodejs.org) 22 or newer. From this folder:

```sh
npm install                                  # once, for the type checker
npm run duel -- scenarios/footsies-melee.json  # run a fight and print it
npm test                                     # check the Referee against the design doc
npm run tourney                              # every pairing fights every other; prints win rates
```

Add `--trace` to a duel to print both dragons' positions every tick, or `--json` for the raw event log.

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
- **Wyvern, Talons:** it bends the one-band move rule. A Claw from the air against a grounded opponent anywhere within Far is a stoop: the Wyvern flies to the ground during the wind-up, lands at Melee, and swipes both ways. Against an airborne opponent it simply claws. Its price is positional: it must have been aloft since the exchange began, and it lands in Bite range. From the ground its Claw reaches only 2 paces (forelimbs are wings).
- **Wyrm, Serpentine:** its Strafe tests Evasion with Dodge's +3. It is grounded: its Leap is a hop, and it can't Dive.

## Breath effects

At wyrmling strength (design doc §3):
- **Water** pushes the target back a whole band (3 paces). **Air**'s vortex pulls the target a band toward the breather, lowering a flier without grounding it; a second vortex in the breather's own space throws anything at Melee back out to Close, so the pull ends at Close. A push and a pull in the same moment cancel. Any forced movement that meets the wall or an obstacle slams for 3 [Proposed]. Water's jet shoves a boulder a band instead of breaking it. Any landed hit breaks a charge. **Affinity is the element's Evasion** [Proposed]: a verb (push, pull, burn, corrosion, a smolder's tug) takes hold only if the breather's Potency beats the target's Affinity, ties to the higher Acumen. **The Acumen meter** [Proposed] is fueled by Affinity: it starts at age bracket × 10 + 3 × Affinity, and each trigger (a near miss, a Scales or Dodge slot held to the end, a Breath charging slot, a landed Breath for the breather) adds Affinity + 9. Full at 100, the next landed Bite, Claw or Breath deals true damage (no Hardness, no Affinity, no verb contest) plus Affinity ÷ 3, and drains it. A miss, a Stomp or a Technique's side-hit spends nothing. Grazes are retired. **Gravity** [Proposed]: a flier that doesn't Leap during an exchange drops a band at its end; a Wyvern can stoop only if aloft since the exchange began. **Intimidate** that reaches also demoralizes: the target's next Bite or Claw loses 3. **Stomp** deals 3 + Hardness ÷ 3 and shatters boulders inside its radius. **Crunches** come once per exchange and never lunge, pounce or stoop.
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

Skill sets how many scripts it imagines (8, 14, 28), how many opponent guesses it tests each against (4, 6, 12), how tightly it sticks to its best idea, and how long it remembers your habits.

`npm run brains` (add `-- --skill master`) runs the brain tournament across four workers: a balanced brain against the crude AIs, every style against every other on identical dragons (with a check for boxing's swarmer > out-boxer > slugger triangle), and every pairing against every other with random styles. It reports damage by attack type and each attack's land rate, every action's share of slots, and what came of them (revisions, Intimidates landed and cashed, evades, verbs landed and held, slams, grazes, setups). Arenas throw 1d4+2 boulders.

## Attack-role variants

Hits resolve in layers: geometry first (is the target in the shape?), then Accuracy against Evasion for a moving or dodging target, then Acumen on a tie. A swift dragon that reaches safe geometry before the active window is meant to escape.

Four [Proposed] changes sit behind a switch, so a run can add them one at a time: `REFEREE_VARIANT=charge,lunge,pounce npm run brains -- --skill master`.
- **charge:** a one-slot charge releases with no bonus. Scripting the same charge again holds it a second slot (Bite or Breath, slots 1–2), and that release earns +3. Bellows Chest restores the +3 on any Breath charge, then adds its own.
- **mandatory:** Breath must charge. A plain Breath is read as a one-slot charge, and slot 3 can't start one. Off since Round 7.
- **lunge:** a Bite right after an Approach that moved carries the dragon up to 1 pace along its line during the wind-up. Pure geometry: Evasion still applies, and a retreat that outruns it escapes. Only the first Bite after the Approach lunges.
- **pounce:** a Claw right after a Strafe that moved advances up to one band along its line during the active window, sweeping its arc as it goes, and pierces 3 Hardness. It stops 1½ paces short of where the target stood. An airborne Wyvern that strafes into its stoop gets the pierce on the stoop.

Brains are updated with every rule change, so none plays by old patch notes. Their value counts what's pending when a slot or exchange ends (an Intimidate bonus, a demoralize, a setup), and their reads key on whether the opponent is aloft and whether its meter is full. Every style has an ideal band, from its taste for each attack and its own dragon's attacks (Claw at Melee, Bite at Close, Breath at Far), and values forcing misses by style. Diagnostic brains: meter-focus plays the Acumen meter, charge-focus two-slot charges, kite-focus position. They plan the setups as two-slot ideas (Approach then Bite, Strafe then Claw, a two-slot charge), weighed by their style's taste for both halves, and every style reads leverage: a target pinned within a band of the wall or an obstacle, its own exposure, and charges broken. The brain tournament prints how often a Bite follows an Approach and a Claw follows a Strafe. Tests flip the switches at runtime in `test/variants.test.ts`.

## Where the numbers live

Every dial is in `src/rules.ts` and `src/actions.ts`, tagged by where it came from:
- **[Doc]:** settled in the design doc.
- **[Proposed]:** marked [Proposed] in the design doc.
- **[Assumed]:** a placeholder this build needed. The numbers pass should replace these.

## The tournament

`npm run tourney` (add `-- --shards` for random, seeded 3-pip loadouts and a shard ranking) fights each of the 12 core pairings against the other 11, under all 16 combinations of AI styles, once as challenger and once as challenged: 4,224 bouts in a few seconds. It prints win rates by pairing, morph and stone, and the most one-sided matchups. Add `-- --rounds 3` for more bouts.

Each bout's arena throws 1d4+2 seeded boulders, so it's never an open floor. The AIs are crude, so the numbers mean "strong in crude hands."

## Not built yet

Supports, Traits, compounds (Tendon Weave), hazards beyond boulders (pits, traps, atmospherics), Salt/Magma/Lightning/Storm breaths, extended morphs, claw sweep timing, Acumen-scaled punishes, and growth past wyrmling.

## Files

| File | Job |
|---|---|
| `src/rules.ts` | Every number |
| `src/actions.ts` | The action menu and timing profiles |
| `src/hatch.ts` | Egg + stone → stat sheet; the element wheel |
| `src/shapes.ts` | Attack shapes and the phantom band |
| `src/geometry.ts` | Whole-number vector math, in 3D |
| `src/arena.ts` | Pillars, boulders, lingering zones |
| `src/random.ts` | Seeded random numbers for AI and map layout |
| `src/referee.ts` | The tick-by-tick resolver and the revision window |
| `src/bout.ts` | Exchanges to a KO, rim pulses, timeouts; what each side can see |
| `src/ai.ts` | Crude AI tamers: habits only |
| `src/brain.ts` | Brain AI tamers: read, imagine, value, choose, tell |
| `src/brains.ts`, `src/brains-worker.ts` | The brain tournament, in parallel |
| `src/scenario.ts` | Scenario files, scripted revisions |
| `src/shards.ts` | Shard catalog, the array, seating and overlap, compiling a loadout |
| `src/tourney.ts` | The balance harness |
| `src/report.ts` | Turns the event log into text |
| `src/cli.ts` | Runs a scenario file |
| `test/*.test.ts` | Design-doc claims as tests |

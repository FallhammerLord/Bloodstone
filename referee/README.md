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
- **separation** is optional; it defaults to 6.5 paces (Far, just outside Bite range).

**Full bouts.** Add `"bout": true` to play until a KO or the exchange limit (8), with rim pulses in the final three exchanges and the timeout rule at the end. `"exchangeLimit"` changes the limit. `"timeout": "mostWounds"` gives an open-lobby timeout to the dragon with more Wounds; the default is that the challenger forfeits. `"challenged"` is `"A"` or `"B"` (default B). Exchanges you don't script are played by the side's AI, or held.

**AI sides.** Add `"ai": "brawler"` (and optionally `"seed": 7`) to a side. Styles:
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

## Altitude

Leap rises and Dive descends, up to one band each, to a ceiling of 9 paces. Approach, Retreat and Strafe move across the floor. Distances, reach, range bands and the leash all count height. The Wyrm is grounded: its Leap is a hop that lands by the end of the slot, and it can't Dive. Stomp misses anything aloft, and a dragon in the air can't Stomp. Evasion beyond the one-band move cap makes moves finish sooner.

## Where the numbers live

Every dial is in `src/rules.ts` and `src/actions.ts`, tagged by where it came from:
- **[Doc]:** settled in the design doc.
- **[Proposed]:** marked [Proposed] in the design doc.
- **[Assumed]:** a placeholder this build needed. The numbers pass should replace these.

## The tournament

`npm run tourney` fights each of the 12 core pairings against the other 11, under all 16 combinations of AI styles, once as challenger and once as challenged: 4,224 bouts in a few seconds. It prints win rates by pairing, morph and stone, and the most one-sided matchups. Add `-- --rounds 3` for more bouts.

The AIs are crude, so the numbers mean "strong in crude hands." The Wyvern still lacks its Aspect (talons on dives) and its shards.

## Not built yet

Morph Aspects, obstacles, crunch, charge, compounds, breath verbs (push, burn, pools), claw sweep timing, Acumen-scaled punishes, shards, and growth past wyrmling.

## Files

| File | Job |
|---|---|
| `src/rules.ts` | Every number |
| `src/actions.ts` | The action menu and timing profiles |
| `src/hatch.ts` | Egg + stone → stat sheet; the element wheel |
| `src/shapes.ts` | Attack shapes and the phantom band |
| `src/geometry.ts` | Whole-number vector math |
| `src/referee.ts` | The tick-by-tick resolver and the revision window |
| `src/bout.ts` | Exchanges to a KO, rim pulses, timeouts; what each side can see |
| `src/ai.ts` | AI tamers |
| `src/scenario.ts` | Scenario files, scripted revisions |
| `src/tourney.ts` | The balance harness |
| `src/report.ts` | Turns the event log into text |
| `src/cli.ts` | Runs a scenario file |
| `test/*.test.ts` | Design-doc claims as tests |

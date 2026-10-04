# The Referee

The Dragon Duel rules engine. It takes two dragons and their scripts and works out exactly what happens, tick by tick. It draws nothing and rolls no dice: the same scripts always produce the same fight.

## Running it

Needs [Node.js](https://nodejs.org) 22 or newer. From this folder:

```sh
npm install                                  # once, for the type checker
npm run duel -- scenarios/footsies-melee.json  # run a fight and print it
npm test                                     # check the Referee against the design doc
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
- **Actions:** `bite`, `claw:left`, `claw:right`, `breath`, `stomp`, `approach`, `retreat`, `strafe:cw`, `strafe:ccw`, `dodge`, `scales`, `intimidate`, `hold`.

## Reading the output

Each slot shows both actions as 30-character bars, one character per tick:

```
A  Claw (left)  ------###############=========
B  Bite         ------xxxxxxxxxxxxxxxxxxxxxxxx
```

`-` wind-up, `#` active, `=` recovery, `x` cancelled by an interrupt. Below the bars, every hit shows its arithmetic.

## Where the numbers live

Every dial is in `src/rules.ts` and `src/actions.ts`, tagged by where it came from:
- **[Doc]:** settled in the design doc.
- **[Proposed]:** marked [Proposed] in the design doc.
- **[Assumed]:** a placeholder this build needed. The numbers pass should replace these.

## Not built yet

Altitude (Leap, Dive), obstacles, crunch, charge, compounds, slot-3 revision, breath verbs (push, burn, pools), claw sweep timing, Acumen-scaled punishes, shards, and growth past wyrmling.

## Files

| File | Job |
|---|---|
| `src/rules.ts` | Every number |
| `src/actions.ts` | The action menu and timing profiles |
| `src/hatch.ts` | Egg + stone → stat sheet; the element wheel |
| `src/shapes.ts` | Attack shapes and the phantom band |
| `src/geometry.ts` | Whole-number vector math |
| `src/referee.ts` | The tick-by-tick resolver |
| `src/report.ts` | Turns the event log into text |
| `src/cli.ts` | Runs a scenario file |
| `test/referee.test.ts` | Design-doc claims as tests |

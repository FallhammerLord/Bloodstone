# Referee Findings, Edition 1

*What building and testing the Dragon Duel rules engine shows, from the wyrmling regrid on. Companion to `dragon-duel-design.md`. The first era's log (Rounds 2–25) is in `history/docs/referee-findings.md`.*

## What carried forward from the first era

- **The Referee** and every rule test. The rules in force: the wyrmling regrid (the morph and stone grid, Accuracy = Claw − Evasion, Affinity = Breath − Hardness, a preferred stone's +3 on a derived stat, a disliked stone's −6 Wounds), full-band arc strafes and the wider Claw, the Drake with Ravener and its hop, Surge, suite v0.3 Techniques, and Ash Gland's clinging cloud at full damage.
- **The element wheel** works only on elements: ±3 on Breath, in verb contests and on burning zones. Preference is separate.
- **The tools:** the brain tournament, draft, gauntlet, measure (with `--only` and `--sheets`), diagnostics, ladder, goldens.
- **Not carried:** the first brains and their patch notes, the old crude AI, the measured table, seasons 1–4 and the champion hall.

**Index.** Newest first.

| Round | What changed |
|---|---|
| [1](#round-1-the-edition-1-brains) | The edition 1 brains: five goal-driven archetypes and a crude floor; the table rebuilt |

## Round 1: the edition 1 brains

**Built fresh** (`src/brain/`):
- **Five archetypes** (swarmer, out-boxer, slugger, counterpuncher, boxer-puncher), each a goal vector over twelve outcome features on one scale. No habit tables.
- **Probes:** a brain asks the Referee what each attack is worth from each band, for both dragons, so the damage math (wheel included) is never copied.
- **The aerial overlay:** the perch counts in full on a winged dragon.
- **Skill** read from the dragon's own shard pips by default.
- **A crude brain** as the floor.

**Speed** (4 workers): novice 1,392 bouts in 27 s; adept in 90 s; master in 228 s. About 0.02, 0.065 and 0.16 s a bout.

**The floor holds.** Archetypes beat the crude brain 89% of 240 bouts at both adept and master. Each one, at master (±6–11): swarmer 85%, out-boxer 83%, slugger 96%, counterpuncher 88%, boxer-puncher 92%.

**Archetype against archetype** (master, identical dragons; 24 bouts a cell, ±20; overall ±10):

| | swarm | out-boxer | slug | counter | box-punch |
|---|---|---|---|---|---|
| swarmer | · | 33 | 63 | 33 | 63 |
| out-boxer | 67 | · | 46 | 58 | 50 |
| slugger | 38 | 54 | · | 50 | 67 |
| counterpuncher | 67 | 42 | 50 | · | 42 |
| boxer-puncher | 38 | 50 | 33 | 58 | · |

Overall: out-boxer 55, slugger 52, counterpuncher 50, swarmer 48, boxer-puncher 45 (±10). Nothing separates outside the margins. The boxing triangle (an observation) doesn't hold: the out-boxer beats the swarmer (67) and the swarmer beats the slugger (63).

**Habits** (master, share of slots; where it fights):
- **Swarmer:** Bite 22%, Approach 13%, Claw 13%; at Melee 32%, Very Far 9%. Presses.
- **Out-boxer:** Scales 11%, Retreat 10%; at Very Far 27%, Melee 20%. Holds range.
- **Slugger:** Bite 22%, Claw 13%, Approach 11%; at Melee 30%. Close to the swarmer.
- **Counterpuncher:** Scales 10%; Very Far 19%. Close to the boxer-puncher.
- **Boxer-puncher:** the middle.
- **Breath** is a quarter of every archetype's slots.

The swarmer and the out-boxer are clearly distinct. The slugger reads as a heavier swarmer, and the counterpuncher as a more guarded boxer-puncher.

**Morphs with both sides thinking** (master tournament, random archetypes on plain dragons, ±5): Wyvern 61, Wyrm 49, True Dragon 49, Drake 41.

**The brains' table, rebuilt** (adept, 48 pairs a cell, 16,800 bouts, 19 min in four chunks). Pooled sheet win rates against the field; ±5 a pooled sheet:

| Morph | Water | Earth | Fire | Air | Mean |
|---|---|---|---|---|---|
| True Dragon | 42 | 35 | 44 | **63** | 46 |
| Wyvern | 53 | 46 | 56 | 53 | 52 |
| Wyrm | 41 | 39 | 45 | 45 | 42 |
| Drake | 39 | 38 | 36 | 44 | 39 |

**Shards:** −7 to +6, every one inside its margin (±4–8 with five archetypes). Pebblescale +6, Scything Forelimbs +5, Ratchet Claws +5; Lance Throat −6, Bellows Chest −7.

**What it shows:**
- **True Dragon + Air is still the outlier** (63%) under brains that share none of the old ones' code, so it's the sheet, not the instrument. Accuracy 9 from Claw 12 − Evasion 3 is the leading suspect.
- **The Drake trails** under the new brains too (39–41%). The brains now play Ravener only as far as their imagination finds it: the hop is an option, and the window counts as tempo. A Drake-specific check (Ravener on and off, same brains) would split sheet from Aspect.
- **The Wyvern leads** the morphs with both sides thinking (61%), while sitting mid-table in the drafting table (52%).
- **Archetype distinctness is partial:** two of five read clearly in their habits.

**Open, for Ken:**
- True Dragon + Air: Accuracy formula or sheet.
- The Drake: sheet or Aspect.
- Whether the slugger and counterpuncher need sharper goals to read as their own styles.
- Omnibus, hatch and gauntlet, held for later.

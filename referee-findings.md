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
| [4](#round-4-season-1-a-true-dragon--air-monoculture) | Season 1: a TD+Air monoculture; no Evasion counter formed |
| [3](#round-3-reined-in-gambits-chase-and-juke-priors-meta-memory) | Gambits reined in; chase and juke priors; meta memory, counterpicks, season carry |
| [2](#round-2-stacking-shards-ravener-payoff-free-hits-and-pursuit) | Shards stack; Ravener payoff, free hits, pursuit; gambits; stack rows in the table |
| [1](#round-1-the-edition-1-brains) | The edition 1 brains: five goal-driven archetypes and a crude floor; the table rebuilt |

## Round 4: Season 1, a True Dragon + Air monoculture

Run locally by Ken (60 rounds, 8 workers). Cards in `referee/seasons/cards-season1.md`.

**Champions** (343 seats):
- **By build:** TD+Air 235 (69%), Wyvern+Fire 55, Wyvern+Air 29, Wyvern+Water 11, Wyrm+Air 5, Wyvern+Earth 4, other TD 4. **No Drake champions.**
- **By archetype:** slugger 94, boxer-puncher 75, out-boxer 66, swarmer 57, counterpuncher 51.
- **Shards:** Heartgrit 222, Whetted Nail 146, Snapping Jaw 116, Riposte Talons 92, Bounding Haunches 88, Pebblescale 71, Coiled Sinew 69.
- **Stacks:** only ×2, plus Whetted Nail ×3 twice. **No Coiled Sinew ×3.**

**Win rates:**
- **Archetypes:** 46–52%, all even.
- **Builds:** TD+Air 56% (3,635–2,835), Wyvern+Fire 53%, Wyvern+Air 42%, TD+Fire 42%; Wyrm builds 25–44%; Drake builds 15–37%.

**The meta** (8,000 remembered opponents, rounds 21–60):
- TD+Air share of the field rose from 57% to 63%.
- Coiled Sinew on faced dragons fell from 182 to 132.
- Trials: 3,681. Top trial winners were Heartgrit 704, Whetted Nail 694, Riposte 457.

**What it shows:** the Evasion counter didn't form. The field converged on TD+Air, and Wyvern+Fire emerged as the only standing counter.

**Likely causes:**
- **Supply:** Coiled Sinew drops only from Wyvern and Drake victims. A TD+Air field mostly drops Heartgrit and Whetted Nail.
- **Shape:** a ×3 stack fills the whole 3-pip wyrmling array.
- **Greedy drafting:** the measured ×1 and ×2 rows are about −1, so marginal scoring never climbs toward the ×3 jump (+9).
- **Trials:** novice-skill, gated to close calls, two candidates. They can confirm a pick but rarely discover a plan.

**Card bugs:** stacks print as a repeated name; "as a adept"; trial lines name a "best" even at 1–5.

**Open, for Ken:**
- Brain fix: plan stacks toward thresholds (value the full ×3 row when choosing the first copy); let freezes target a threshold.
- Rule or economy question: should spoils supply match the field (Sinew drops only from Evasion morphs)?
- The Drake still has no champion.

## Round 3: reined-in gambits, chase and juke priors, meta memory

**Gambits reined in.**
- **What they were:** a breakdown of 60 adept bouts showed out-of-reach attacks were mostly Stomps (38, none landed) and Breaths (33, 3 landed) thrown from beyond reach, plus Bites from Very Far.
- **Two fixes:**
  - an attack that can't reach is barely imagined, by archetypes and by exploring scripts alike;
  - a new **ready** feature makes a wasted cooldown cost something (Breath and Stomp off cooldown at the exchange's end, net of the opponent's).
- **Result** (adept): gambits fell from 6–12% of slots to 5–9%, and now land 12–16% (was 7–12%).

**Priors carry the goals.**
- *Pursuit* chases: Approach up, Retreat down, the strike after an Approach up.
- *Free hits* juke: Strafe and Dodge up, the strike after an evasive move up.

**Adept tournament after both** (1,392 bouts, 106 s):
- **The floor:** 90%.
- **Overall** (±10): out-boxer 57, boxer-puncher 57, counterpuncher 49, slugger 44, swarmer 43.
- **Triangle:** out-boxer over slugger (67) and slugger over swarmer (58) hold; swarmer over out-boxer doesn't (38).
- **Morphs:** Wyvern 58, True Dragon 52, Drake 46 (was 39–40), Wyrm 45.
- **Habits:** the slugger's overall mix still resembles the swarmer's. Its chase should show in pursuit situations, which the overall mix doesn't isolate.

**Meta memory** (gauntlet):
- Tamers remember the last 40 dragons they faced.
- At a close spoils pick, where the table's top two are within about 8 points, adept and master tamers try both candidates against three remembered dragons, and the result leans the pick.
- Seasons carry each champion tamer's full match history and memory.
- **Cost:** a 40-tamer, 12-round smoke season ran 247 bouts and 1,388 trials in 162 s, so a full season is about 60–70 minutes. Season 1 is held.

## Round 2: stacking shards, Ravener payoff, free hits and pursuit

**Rules:** attribute shards stack as far as the array's shape permits; Techniques never duplicate. The design doc's build philosophy now reads: the base design avoids single-attribute dependence (every derived stat draws on two attributes), shard allocation is free, and min-maxing is allowed.

**Brains:**
- **Three new features.**
  - *Payoff:* a lunging Bite or pouncing Claw that lands.
  - *Free:* a hit in a slot where it took nothing back.
  - *Pursuit:* keeping its reach when the opponent backs off.
- **Ravener.** An open window stays tempo, and with it open a Drake imagines Bites more often. A Drake now values a safe slot-3 Approach over a Bite from beyond reach (tested).
- **Counterpuncher** weighs free hits and forced misses; Scales is no longer favored over footwork.
- **Slugger** weighs pursuit and big hits; forced misses barely count.
- **Drafting** allows chip repeats and values each stack at its measured row. The old repeat discount is gone.
- **Gambits** (attacks started beyond reach) are counted per archetype.

**The Drake** (120 adept bouts against random archetypes): wins 52 → 59 of 120, lunges 54 → 65 (Ravener windows cashed 27% → 38%). Bites from beyond reach: 34, one landed.

**Tournaments** (1,392 bouts each; adept 90 s, master 230 s):
- **The floor:** 89% against the crude brain at both skills.
- **Overall at master** (±10): counterpuncher 59, out-boxer 56, swarmer 50, slugger 45, boxer-puncher 40. At adept the boxer-puncher led (65). Ranks move between runs inside the margins.
- **Triangle:** out-boxer over slugger holds at both skills (63%); the other two legs don't.
- **Morphs** with both sides thinking (master, ±5): Wyvern 62, True Dragon 51, Wyrm 48, Drake 39.
- **Gambits:** 6–12% of every archetype's slots, landing 7–12%. Mostly noise for now. The out-boxer and counterpuncher take the most (11–12%).
- **Habits:** the new goals barely moved them. The slugger still reads like the swarmer (Bite 25%, Approach 11%, Melee 32%). The counterpuncher strafes 8%, against the boxer-puncher's 7%.

**The table, refreshed with stack rows** (adept, 48 pairs, 24,480 bouts, 28 min in five chunks). Sheets (±5):

| Morph | Water | Earth | Fire | Air | Mean |
|---|---|---|---|---|---|
| True Dragon | 42 | 33 | 48 | **61** | 46 |
| Wyvern | 49 | 47 | 54 | 59 | 52 |
| Wyrm | 41 | 33 | 39 | 45 | 39 |
| Drake | 34 | 35 | 35 | 50 | 38 |

Chip stacks (pooled change in win rate for one, two and three copies; margins ±6–9):

| Chip | ×1 | ×2 | ×3 |
|---|---|---|---|
| Coiled Sinew (Evasion) | −1 | −1 | **+9** |
| Pebblescale (Hardness) | +3 | +7 | +5 |
| Whetted Nail (Claw) | +1 | 0 | +8 |
| Heartgrit (Wounds) | +6 | +2 | +4 |
| Slit Pupil (Accuracy) | +3 | −2 | +5 |
| Milk Fang (Bite) | −1 | 0 | +5 |
| Smolder Sac (Breath) | +2 | +4 | +3 |
| Weathered Hide (Affinity) | −3 | −2 | −3 |

Techniques span −3 to +8 (±7–8): Snapping Jaw, Bounding Haunches and Riposte Talons +8.

**What it shows:**
- **Coiled Sinew ×3 jumps to +9** while one or two copies do nothing. That's the shape the threshold idea predicts (the third Evasion point is the one that crosses Accuracy), but it sits inside a ±8 margin. Treat it as a lean.
- **The table's shard margins are wide** (±7–8) with five archetypes. Calls on single shards need targeted runs (`--only`, more pairs).
- **The archetype reshape is weak in habits.** The goals changed what they value, but what gets imagined still comes mostly from probed attack worth. The slugger and counterpuncher need their priors to carry their goals more strongly, or a habit-level signature check.
- **The Drake improved but still trails** (38% in the table, 39% with both sides thinking).

**Open:**
- Sharper archetype priors for the slugger (chase) and counterpuncher (juke).
- The Drake: sheet or Aspect, now that the brains cash Ravener more often.
- Steps 6–8: tamer memory and counterpicks, season carry with match history, the gauntlet.

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

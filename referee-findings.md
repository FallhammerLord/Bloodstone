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
| [8](#round-8-brains-that-scale-the-loaded-up-slugger-chips-valued-by-their-stacks-base_wounds) | Brains: pool scaling, per-style nerve, power and the loaded-up slugger; chips valued by their stacks; BASE_WOUNDS; the table rebuilt |
| [7](#round-7-pair-off-dice-the-wounds-curve-the-heavy-slugger-and-the-table-rebuilt) | Pair-off dice for the Evasion test; brains weigh Wounds on a curve; the slugger's heavy goal; the measured table rebuilt |
| [6](#round-6-season-3-what-makes-air-strong-and-the-air-regrid) | Season 3; Air's edge is Claw damage, not Accuracy; Air regridded to 12/12/12 with a Surge perk; dice odds for hit resolution |
| [5](#round-5-season-2-and-suite-v04) | Season 2: the monoculture holds; suite v0.4 and the Scales/Guard/Defend rename |
| [4](#round-4-season-1-a-true-dragon--air-monoculture) | Season 1: a TD+Air monoculture; no Evasion counter formed |
| [3](#round-3-reined-in-gambits-chase-and-juke-priors-meta-memory) | Gambits reined in; chase and juke priors; meta memory, counterpicks, season carry |
| [2](#round-2-stacking-shards-ravener-payoff-free-hits-and-pursuit) | Shards stack; Ravener payoff, free hits, pursuit; gambits; stack rows in the table |
| [1](#round-1-the-edition-1-brains) | The edition 1 brains: five goal-driven archetypes and a crude floor; the table rebuilt |

## Round 8: brains that scale, the loaded-up slugger, chips valued by their stacks, BASE_WOUNDS

**Rules:** `BASE_WOUNDS` [Proposed, default 36]: every pool moves by the baseline's change; morph swings and a disliked stone's −6 stay on top (at 60: True Dragon 66, Wyvern 60, Wyrm and Drake 54). `DICE_SCALES` [Proposed, default 0]: the defender rolls Evasion + Scales.

**Brains:**
- **Pool scaling:** damage features, probed worth and the big and heavy bars count against a baseline pool (`BASE_WOUNDS` ÷ 36). Without it, a 60 pool would shrink every hit by 40% against the flat counts (misses, free hits, tempo) and tilt brains toward the counterpuncher's and out-boxer's goals. A no-op at 36.
- **Nerve by style:** the Wounds curve is 1 + curve × (1 − left)²: swarmer 1, out-boxer 3, slugger 0.5, counterpuncher 2, boxer-puncher 2.
- **Power:** a feature for every style, landed hits carrying a Surge's true damage or a cashed Intimidate's +3.
- **The slugger rebuilt** to load up and land haymakers: power 2.5, surge 1 → 2.2, pursuit 2.2 → 1.2 (a chase costs most of a slot), heavy 2 → 1 (a linear lean on what gets through). Its priors raise Intimidate, a Guard and a charging Breath while its Surge has room, and its attacks while it holds a full Surge or an Intimidate.
- **Shards valued by their stacks:** drafting valued a chip by its single row (Pebblescale +3) while three measure +16 to +25, so a chip never started the stack that pays. Drafting now scores each chip by the best stack it can still complete, per pip, and each Technique by its measured worth per pip. In spoils, an unfinished stack keeps half its promise, times the dragon's reach, at the edge of a tamer's plan.

**The measured table, rebuilt** (adept, 48 pairs, 25,440 bouts, 19 min on 4 workers):
- Sheets: TD+Air 62%, TD+Water and Wyvern+Air 55%, Wyvern+Fire 54%, Drake+Air 50%. Bottom: Drake+Fire 33%, Wyrm+Earth 34%, Drake+Earth 37%, TD+Earth 38%.
- Shards: stacks lead harder: Pebblescale ×3 +25, Whetted Nail ×3 +24, Whetted Nail ×2 +18. The swarmer's best is Whetted Nail ×3 at +37. Elemental Jaws +8 leads the Techniques.

**Wounds at 60** (the default now; `--rule BASE_WOUNDS=36` restores 36): True Dragon 66, Wyvern 60, Wyrm and Drake 54, a disliked stone −6, all flat. The brains count damage against the 36-point pool they were tuned on (×5/3), so hits keep their worth against misses and tempo.

**A measure bug, fixed:** job seeds stepped by 2, so `s % 2` was always 0 and the measured dragon was the challenger in every bout, losing every timeout. At 36 Wounds this pulled the pooled sheets to a mean near 47%; at 60, where about a fifth of adept bouts time out, to 39%. The challenged side now alternates. Every earlier table carried this bias, mildly.

**The table at 60 Wounds, unbiased** (adept, 48 pairs, 25,440 bouts, 29 min on 4 workers):
- Sheets span 41–62% (was 31–62%): Wyvern+Water 62%, Wyvern+Fire 59%, TD+Air 57%, Wyvern+Air and Wyrm+Air 56%, TD+Water 55%. Bottom: Wyrm+Earth 41%, Drake+Earth 43%, Drake+Water and Drake+Fire 45%. TD+Air no longer leads.
- Shards: Whetted Nail ×3 +27, Pebblescale ×3 +18, Pebblescale ×2 +16, Whetted Nail ×2 +14. Stacks still lead.
- About a fifth of adept bouts reach the 8-exchange limit (estimated from the biased run). `EXCHANGE_LIMIT` 12 is the candidate.

**Open:**
- Stacked chips are now the clearest outlier in the game; with brains drafting toward them, expect ladder arrays of three of one chip.
- Ken's local runs: the omnibus at default, with `DICE_SCALES=1`, with `BASE_WOUNDS=60`, and both.

## Round 7: pair-off dice, the Wounds curve, the heavy slugger, and the table rebuilt

**Rules:**
- **The Evasion test rolls pair-off dice** (`HIT_DICE`, on by default; `--rule HIT_DICE=0` restores Accuracy against Evasion with ties to Acumen). Attack stat ÷ 3 in d6 against Evasion ÷ 3, sorted high to low and paired off; the first difference decides, the higher die winning. An unbroken chain goes to the side with dice left; equal pools matched all the way down are the defender's, as a near miss that fills the attacker's Surge. Blindness and Scything's −3 come off the attack stat. Accuracy keeps aim tracking and the phantom band. Exact odds: `dice-hit-odds.tsv`.
- A real bout rolls from a stream seeded with the arena; a clone replays it.

**Brains:**
- **Imagining dice:** each guessed opponent script plays at its own luck quantile, (i + ½) ÷ n; a test lands in imagination when its exact chance beats the quantile. The average over guesses weighs every Evasion test by its true odds, with no extra Referee calls.
- **Wounds on a curve:** damage taken and exposure weigh 1 + 2 × (1 − left)²: ×1 at full, ×1.5 at half, ×2.3 at a fifth. It shapes valuation and how readily a wounded dragon imagines a Guard or Dodge.
- **Discovery:** from the public record, each attack's share of clean-hit worth that has been getting through (a Guard, a held Affinity), starting from the board's numbers as two prior hits.
- **The slugger's heavy goal:** its attack priors weigh each attack by what gets through against the heaviest from here, squared; its outcomes count each landed hit by (damage ÷ a fifth of the pool)², at most 4. Its flat big goal halves (2 → 1).
- The sheets are public (the board), so playouts already used true Scales and Affinity; discovery adds what the fight reveals.

**The measured table, rebuilt** (adept, 48 pairs a cell, 25,440 bouts, 27 min on 4 workers; suite v0.4, the Air regrid, dice, the new brains). Pooled sheets (±5):
- TD+Air 62%, Wyvern+Water 55%, Wyrm+Air 53%, TD+Water 52%, Wyvern+Earth 51%, Wyvern+Air 50%, Wyvern+Fire 49%, Drake+Air 47%.
- Bottom: TD+Fire 43%, Wyrm+Water 42%, TD+Earth 39%, Wyrm+Fire 39%, Drake+Water 38%, Wyrm+Earth 34%, Drake+Earth 31%, Drake+Fire 31%.
- Every style's best sheet is TD+Air except the swarmer's (Wyrm+Air).
- **Shards:** attribute stacks lead: Whetted Nail ×3 +22 (±8), Pebblescale ×3 +16, then ×2 rows near +10. v0.4's +1 per chip plus stacking makes three of one chip the strongest pick. Snapping Jaw +9 is the top Technique; Sidewinder Spine −6 the bottom.
- Gnashing Teeth, Raking Talons, Sapping Bellow, Goading Roar and Baleful Eye measure 0 ±0: the measured bouts never put them to work (Baleful Eye is pulled by default). Their rows carry no information.

**Omnibus with and without dice** (Ken, master, `--shards`, 1,392 bouts each):
- Dice cut evasion hard: evades while moving 0.64 → 0.15 a bout, by Dodge 0.34 → 0.07. Attack stats (9–15) roll far more dice than Evasion (3–9).
- Stones are flat either way (46–53%): the Air regrid did that, not the dice. Morphs are the same either way (Wyvern 58–59, TD 52–53, Wyrm 44–46, Drake 43–45).
- The slugger is last either way (31% without dice, 38% with), against 40% in the v0.3 omnibus.
- Under test: `DICE_SCALES` (the defender rolls Evasion + Scales), which puts the baseline defender (6 + 6) level with the baseline attack (Bite 12).

**Open:**
- TD+Air still leads at adept (62%): the Air regrid and dice didn't break it, as Round 6 predicted. The damage formula is the remaining lever.
- Stacked attribute chips (×3 rows at +16 to +22) are the new outlier.
- Omnibus, hatch and gauntlet on these rules: Ken's to run locally.

## Round 6: Season 3, what makes Air strong, and the Air regrid

Season 3 run locally by Ken under suite v0.3 (seed 2026, 200 tamers, 60 rounds, carried from season 2). Numbers parsed from the tamer histories, each bout counted once from the loser's line: 14,613 bouts across seasons 1–3, 5,937 in season 3.

**Season 3:**
- TD+Air is 66% of all dragons fought across seasons 1–3 and Air is 88% of season 3's stones. TD+Air wins 53% overall and 59% outside the mirror; mirrors are 48% of bouts.
- The triangle holds, lopsided: TD+Air beats Wyvern+Air 70%, Wyvern+Air beats Wyvern+Fire 59%, Wyvern+Fire beats TD+Air 56%. Drake is gone by season 3; Earth 33%, Water 36%, TD+Fire 39%.
- Fights keep shortening: 4.07, 3.93, 3.78 exchanges by season, against the 6–8 target. Half end in exchange 3.
- Styles converge: a 12-point spread in season 1, 5 points in season 3.
- Shard count doesn't move win rate (50.0 / 50.1 / 49.8% for 0 / 1 / 2 shards), confounded by rung pairing. Scything Forelimbs 72% on the ladder but 50% in the omnibus: a carrier effect, not the shard.

**Omnibus, suite v0.3** (`npm run brains -- --skill master --shards`, 1,392 bouts): morphs 44–55% (±5); stones Air 59%, Fire 51%, Water 48%, Earth 43% (±5). TD+Air tops the pairings at 68% (±9) with random styles, so the ladder didn't invent it. 4.1 exchanges a bout: short fights are the engine, not the meta.

**The planted True Dragon:** 17% of True Dragons never leave 1½ paces of the start. In those 117 bouts 85% script no move at all; they bite (41% of slots) and breathe as the opponent closes, win 58%, and end in 2.8 exchanges. Evasion 3 makes a move cost 24 of the slot's 30 ticks for a 6-tick evasive window, so trading in place is the better deal. Band moves verified: every primary move carries one band ± Evasion ÷ 6 paces, unchanged from v0.3 to v0.4.

**What makes TD+Air strong** (`diag:pairing --morph true-dragon --stone air --bouts 48 --skill master`, 720 bouts each, suite v0.3, the sheet patched in a scratch copy):

| TD+Air | Wins | Claw's share of damage dealt |
|---|---|---|
| Base (Claw 12, Accuracy 9) | 68% ±3 | 14.9 of 31.9 |
| Accuracy forced to 6 | 61% ±4 | 15.8 of 30.8 |
| Claw cut to 9 | 50% ±4 | 6.6 of 28.6 |

Claw damage is the larger lever; Accuracy is secondary. This overturns Round 5's Accuracy hypothesis. Damage is attack − Scales, and Claw's baseline 9 sits nearest typical Scales, so at wyrmling a +3 Claw peak doubles a landed Claw (3 → 6 against Scales 6) and halves time-to-kill. The gain is linear (+3 a hit) and shrinks in share as growth widens margins; the Entry track stays wyrmling.

**Air at 12 / 12 / 12** (Claw peak, Breath valley, +3 Surge a trigger when preferred), same instrument, before the regrid landed:
- TD+Air 65% ±3 (from 68%). Bite takes over from Claw: Bite 17.8 of 31.5 dealt; fights 3.8 exchanges.
- Wyvern+Air 60% ±4 (from 66%), down to Accuracy 3; its matchup with TD+Air goes from 27% to 42%.
- Reading: with two attacks at 12 against Scales 6, Air stays strong. The doubling lives in the damage formula, not in which attack carries the peak.

**Rules now in force (the Air regrid):**
- **Air:** Claw 12, Bite 12, Breath 12; peak Claw, valley Breath (was Bite 9, Breath 15). Each attack is now one stone's peak and one's valley: Claw (Air / Fire), Bite (Earth / Water), Breath (Water, Fire / Earth, Air).
- **Air preference:** +3 on every Surge trigger (was +3 Accuracy). Surge starts at Acumen and each trigger adds Affinity + 9, + 3 for a preferred Air stone. Only the Wyvern prefers Air.
- Air's Affinity falls 3 on every egg (TD 6, Wyvern 9, Wyrm 3, Drake 6). Wyvern+Air's Accuracy falls to 3.
- Tests: the grid, the obstacle and the verb-contest tests follow the new numbers; a new test pins the Surge perk. Goldens re-recorded: 7 scenarios with an Air dragon change.
- The brains' measured table predated both v0.4 and this regrid; rebuilt in Round 7.

**Dice for hit resolution (explored; not built).** The current Evasion test is deterministic. One candidate replaces it: attack dice = attack stat ÷ 3, Evasion dice = Evasion ÷ 3 (a dodge adds one). Sort both high to low and pair them off; the first difference decides, the higher die winning. An unbroken chain goes to the side with dice left; equal pools matched all the way down go to the defender as a near miss. The phantom band stays as is. Equal pools land near 50%; every row and column is monotonic. Exact odds for 1–8 dice a side are in `dice-hit-odds.tsv`. Rejected along the way: dividing by Evasion (a ×3 multiplier on the True Dragon's valley), highest-against-lowest pairing by count (Evasion 6 out-defends 9), summed pools with doubled Evasion (Evasion-9 morphs near immune).

**Open:**
- Fight length: 3.8–4.1 exchanges against a 6–8 target. Candidates: higher wyrmling margins against Scales, or a start at full Far (9 paces), where every Breath sits exactly at its reach.
- Measure the regrid: an omnibus on this commit against `HEAD~1` (`npm run ladder`).
- A growth chart, to check that stone peaks fade on schedule past wyrmling.

## Round 5: Season 2, and suite v0.4

Season 2 run locally by Ken (seed 2026, 200 tamers, 60 rounds, carried from season 1). Cards in `referee/seasons/cards-season2.md`. Numbers below are parsed from the season's tamer histories: 5,908 season-2 bouts, each counted once from the loser's line.

**Builds** (share of dragons fought, win rate):
- TD+Air 62%, 54.5% overall and 62% outside the mirror. Mirrors are 39% of all bouts.
- Wyvern+Fire 15.5%, 50%; Wyvern+Air 12%, 41%. Everything else is under 2% of the field.
- Head to head: Wyvern+Fire beats TD+Air 600–574 (51%), the only even counter. TD+Fire 46–89, Wyvern+Air 240–615, TD+Water 21–89. Wyrm+Air 47–45 on a thin sample, untested by the field.
- TD+Air's share: 46% (season 1, rounds 1–30), 63% (season 1, rounds 31–60), 60% then 65% (season 2).

**Champions:** 374; TD+Air 284 (76%), Wyvern+Fire 51, Wyvern+Air 23. No Drake.

**Fights are short:** KOs land mostly in exchange 3 (2,675 of 5,654). TD+Air winners average exchange 3.6; Wyvern+Fire 4.2; Wyvern+Air 5.0. 138 deaths came from rim pulses (exchanges 7–8).

**Shards, within TD+Air:** Scything Forelimbs 75% (n 105), Pebblescale 66%, Milk Fang 66%, Heartgrit 55%, Snapping Jaw 42% (n 633, the third most common shard). 61% of dragons fought shardless.

**Styles:** 47–52%, tighter than season 1's 45–56%.

**Reading:** TD+Air is the only sheet with Accuracy 9 (Claw 12 − Evasion 3). The derivation pays most to a Claw peak on an Evasion valley, and only that pairing has both. Air on other eggs and the True Dragon on other stones both underperform. A hypothesis until `diag:pairing` measures it.

**Suite v0.4** (Ken's notes, 2026-10-07; see the README and `dragonshards-technique.md`):
- **Renames:** Hardness is Scales; the brace action is Guard; Guard and Dodge are the Defend category. No rule change: every golden bout kept its winner, length and Wounds.
- **Attribute shards:** +1 at every grade (Wyrmling +2).
- **Freed:** Thornscale, Elemental Mantle (was Mantle Wings) and Ashbreath (was Ash Gland) carry no drawback; the Intimidate Techniques keep the +3, and Baleful Eye returns.
- **Changed:** Lance Throat pierces 3 at every grade; Sapping Bellow resets the opponent's chain; Ashbreath Blinds for Affinity ÷ 3 slots.
- **New:** Elemental Jaws (Bite + Affinity ÷ 3; a landed Bite readies Breath; Breath cooldown +1).
- `--rule SUITE_V03=on` restores v0.3.

**Open, for Ken:**
- **Rebuild the measured table** before the next season: its rows predate v0.4, and Elemental Jaws and Baleful Eye have none.
- **Grade ladders** for Elemental Jaws and Ashbreath, and new Adult perks for Thornscale and Elemental Mantle (their old perks lightened costs that are gone).
- **The pip budget** rule ("1 pip per unit at Adult efficiency") no longer holds with +4 Adult chips.
- **The Technique doc** still shows v0.2 text for Lockjaw, Bellows Chest, Smoldering Maw and Stooping Pinions; the engine runs their v0.3 variants.

## Round 4: Season 1, a True Dragon + Air monoculture

Run locally by Ken (60 rounds, 8 workers). Seasons and tournaments run locally from here on. Cards in `referee/seasons/cards-season1.md`.

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
- **Not supply.** Ichor freezes any shard at 2:1, and tamers used it: 1,718 freezes against 1,705 banks. Only 14 froze Coiled Sinew. The top freezes were Techniques: Snapping Jaw 456, Bounding Haunches 243, Riposte Talons 242, Pebblescale 146.
- **Shape:** a ×3 stack fills the whole 3-pip wyrmling array.
- **Greedy drafting:** the measured ×1 and ×2 rows are about −1, so marginal scoring never climbs toward the ×3 jump (+9).
- **Trials:** novice-skill, gated to close calls, two candidates. They can confirm a pick but rarely discover a plan.

**Card fixes** (after the season): a stack prints once with its count ("Whetted Nail ×2"); "as an adept"; a trial line lists every candidate's record and names a lean only when one led.

**Open, for Ken:**
- Brain fix: plan stacks toward thresholds (value the full ×3 row when choosing the first copy); let freezes target a threshold.
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

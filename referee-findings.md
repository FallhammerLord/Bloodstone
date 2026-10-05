# Referee Findings
*What building and testing the Dragon Duel rules engine has shown so far. For the project chat. Companion to `dragon-duel-design.md`.*

**Index.** Newest first. The earliest build notes (decisions, what's built, open questions) follow Round 2.

| Round | What changed |
|---|---|
| [20](#round-20-brains-look-ahead-stoops-fall-harder-serpentine-slips-breath-stomp-catches-movers) | Brains look ahead, stoops fall harder, Serpentine slips Breath, Stomp catches movers |
| [19](#round-19-earth-corrodes-and-the-wheel-holds-everywhere) | Earth corrodes, and the wheel holds everywhere |
| [18](#round-18-fire-sets-the-world-on-fire) | Fire sets the world on fire |
| [17](#round-17-fires-blast-at-¾-pace-on-the-cleaned-up-referee) | Fire's blast at ¾ pace, on the cleaned-up Referee |
| [16](#round-16-trimmed-stalwart-½-pace-snap-brains-that-value-position) | trimmed Stalwart, ½-pace snap, brains that value position |
| [15](#round-15-band-movement-and-the-breath-first-true-dragon) | band movement and the breath-first True Dragon |
| [14](#round-14-stalwart-steadies-charges) | Stalwart steadies charges |
| [13](#round-13-gravity-demoralize-stomp-crunch-cap) | gravity, demoralize, Stomp, crunch cap |
| [12](#round-12-the-affinity-ladder) | the Affinity ladder |
| [11](#round-11-claws-3-vortex-½-pace-swings-move-wounds) | Claws +3, vortex ½ pace, swings move Wounds |
| [10](#round-10-airs-vortex) | Air's vortex |
| [9](#round-9-waters-jet) | Water's jet |
| [8](#round-8-waters-claw-back-to-3-fires-burn-to-3) | Water's Claw back to 3, Fire's burn to 3 |
| [7](#round-7-breath-charge-optional-again) | Breath charge optional again |
| [6](#round-6-everything-at-once) | everything at once |
| [5](#round-5-charge-and-lunge-reworked) | charge and lunge, reworked |
| [4](#round-4-attack-roles) | attack roles |
| [3](#round-3-focus-brains) | focus brains |
| [2](#round-2-update) | update |

## Round 20: brains look ahead, stoops fall harder, Serpentine slips Breath, Stomp catches movers

Changes since Round 19 [Proposed] (master; **three independent tournaments pooled, 7,632 bouts**, so margins are about ±3 for morphs and styles, ±4 for stones, ±7 for pairings):
- **Brains look ahead by skill:** novice 1 exchange, adept 2, master 3. The best few scripts, plus a few long shots, are played forward on habit and judged on the whole line; the chosen line's next script is kept as a plan. Head to head, a look-ahead master beats a one-exchange master 50–54% (±8): no clear gain in strength yet.
- **A stoop deals +1 per pace it falls** (+3 a band). Wyvern stoops per 132 bouts: 57 → 75; a landed stoop 5.3 → 7.9 damage.
- **Serpentine slips Breath:** a strafing Wyrm tests Evasion (6 + 3) against Breath too. Against Fire's blast and Water's line a strafe usually slips out by geometry anyway; it matters most against Earth's cone.
- **Stomp catches movers:** a Stomp landing mid-move Staggers for two slots, and a Staggered dragon tests half its Evasion, so Stomp then Breath answers a strafing Wyrm.
- **Brains** value a pending Stagger and a pending stoop. **Speed:** a fast bout copy and idle-tick skips make a master bout 2–3× faster before look-ahead's cost.

Wyrm tracks first (`diag:pairing`, 220 bouts per pairing):

| | Round 19 rules | + Serpentine vs Breath | + Stomp catches movers |
|---|---|---|---|
| Wyrm + Water | 45% | 49% | 49% |
| Wyrm + Air | 36% | 45% | 46% |
| Wyrm + Fire | 44% | 40% | 42% |
| Wyrm + Earth | 32% | 38% | 41% |
| Wyrm strafe share | 11–14% | 11–17% | 11–17% |

Serpentine lifted the Wyrm about 4 points; Stomp's counter trimmed nothing measurable. Strafing rose 1–3 points and timeouts held: no strafe-spam.

Then the pooled tournaments:

| | Round 19 | Round 20 (3 runs) |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 58 / 46 / 45 | 54 / **43** / **53** |
| Stones (Air / Earth / Water / Fire) | 54 / 51 / 46 / 49 | 56 / 48 / 46 / 50 |
| Pairing spread | 39–67% | 34–62% |
| Fights at Melee / Close / Far / Very Far | 31 / 33 / 27 / 8% | 28 / 33 / 29 / 10% |
| Breath's share of damage | 46% | 49% |
| Style range (identical dragons) | 34–64% | 34–58% |
| Timeouts | 14% | 13% |

**What it shows:**
- **The Wyvern caught up (45 → 53% ±3).** The stoop now pays, and every style counts a pending stoop. Wyvern + Air (62%) joins True Dragon + Fire (62%) at the top.
- **The True Dragon came down to 54% ±3** without being touched: the gap it held was partly the Wyvern's weakness.
- **The Wyrm is now alone at the bottom (43% ±3),** and Wyrm + Fire is the weakest pairing (34% ±7). Serpentine helped in the tracks, but the Wyrm still trails. Next suspect: its Accuracy 3, the lowest of any morph. Its aim settles 9 ticks before the strike, so its own Breath and Bite miss movers, and Breath is now half of all damage.
- **Water is the weakest stone (46% ±4),** Air the strongest (56% ±4).
- **Style balance tightened** to 34–58%. Fights spread outward (Very Far 10% of slots).

## Round 19: Earth corrodes, and the wheel holds everywhere

Changes since Round 18 [Proposed] (master, 2,544 bouts):
- **The element wheel holds in every element contest** (push, pull, corrosion, burns): a target whose stone beats the breather's adds 3 to its Affinity, and the reverse.
- **A burn adds the matchup (±3)** like the Breath that laid it, never below 1. The contest alone lifted Earth's Affinity only from 3 to 6 against Fire's Potency of 12–18, so the burn still landed; the damage term is what makes Earth smother Fire. True Dragon + Fire's lane now burns Earth for 1, Air for 7, Water or Fire for 4.
- **Earth corrodes on the hit, no pool:** a corroded dragon takes +Potency ÷ 4 (3) from every hit for Potency ÷ 6 slots (2), plus an exchange per charging slot, and each hit on it is an Acumen trigger.
- **Brains** value a corroded opponent and count the wheel in a fire's threat; they also stop re-offering last exchange's script when a cooldown makes it illegal.

Tracks first (`diag:pairing`, 220 bouts per pairing, each column adding one change):

| | Round 18 | + wheel | + corrosion | + meter fill |
|---|---|---|---|---|
| TD + Earth | 51% | 55% | 56% | 60% |
| Wyrm + Earth | 44% | 50% | 50% | 49% |
| Wyvern + Earth | 40% | 45% | 50% | 47% |
| TD + Fire | 68% | 65% | 64% | 63% |
| Wyrm + Fire | 50% | 49% | 48% | 49% |
| Wyvern + Fire | 40% | 45% | 45% | 45% |

The wheel did most of the work (burns on Earth 3.3 → 1.6 a bout). Corrosion lifted Wyvern + Earth; the meter fill is within noise.

Then the full tournament:

| | Round 18 | Round 19 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 58 / 46 / 46 | 58 / 46 / 45 |
| Stones (Air / Earth / Water / Fire) | 54 / 46 / 48 / 53 | 54 / **51** / 46 / 49 |
| Pairing spread | 39–70% | 39–67% |
| Fights at Melee / Close / Far / Very Far | 32 / 34 / 26 / 9% | 31 / 33 / 27 / 8% |
| Style range (identical dragons) | 37–62% | 34–64% |
| Timeouts | 13% | 14% |

**What it shows:**
- **The stones are balanced.** All four sit within 8 points (Air 54 to Water 46), and every stone's margin (±7) covers 50%. Earth rose 5; Fire gave back 4 of its Round 18 gain, as the wheel meant it to.
- **The morph gap is now the largest imbalance.** True Dragon 58% ±6 against Wyrm 46% and Wyvern 45%: the four True Dragon pairings are the top four, from True Dragon + Air (67% ±11) down. Wyvern + Water (39%) and Wyrm + Fire (41%) trail.
- **Style balance is unchanged:** boxer-puncher leads at 64%; the one-attack focus brains (bite-focus 36%, breath-focus 34%) trail, as diagnostics should. The boxing triangle reads even, even, ✓.
- **Timeouts held** at 14%.

## Round 18: Fire sets the world on fire

Changes since Round 17 [Proposed] (master, 2,544 bouts):
- **Fire's burning ground is a lane** along its line through Close and Far (from the Melee edge to the Far edge), as wide as the blast, so closing in means crossing it.
- **A burn deals Potency ÷ 4** (True Dragon + Fire 4, the others 3).
- **Floor zones linger Potency ÷ 6 slots** after the one they land in, plus an exchange per charging slot; Earth's pools too. Each dragon keeps at most two; overlapping fires burn once a slot.
- **Brains** count ending a slot in enemy ground as about one more burn.
- **Blind on burn** was built as a toggle (`BURN_BLINDS`) and tested; it added nothing, so it's off.

Fire tracks first (`diag:pairing`, each Fire pairing against every other, 20 bouts each, 220 per pairing):

| | Old zone rules | New | New + Blind |
|---|---|---|---|
| True Dragon + Fire | 52% ±7 | **68% ±6** | 68% ±6 |
| Wyrm + Fire | 42% ±6 | **50% ±7** | 48% ±7 |
| Wyvern + Fire | 45% ±7 | 40% ±6 | 38% ±6 |

The lane works as meant: True Dragon + Fire takes 14 Bite damage a bout instead of 21.

Then the full tournament:

| | Round 17 | Round 18 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 56 / 44 / 50 | 58 / 46 / 46 |
| Stones (Air / Earth / Water / Fire) | 54 / 49 / 51 / 46 | 54 / **46** / 48 / **53** |
| Fire pairings (TD / Wyrm / Wyvern) | 61 / 36 / 41 | 61 / **50** / 47 |
| Pairing spread | 36–65% | 39–70% |
| Fights at Melee / Close / Far / Very Far | 33 / 35 / 25 / 7% | 32 / 34 / 26 / 9% |
| Style range (identical dragons) | 39–61% | 37–62% |
| Timeouts | 13% | 13% |

**What it shows:**
- **Fire went from last stone to second (46 → 53% ±7).** The biggest gain is the weakest pairing: Wyrm + Fire 36 → 50%. Every Fire pairing is now within its margin of 50% or above it.
- **True Dragon + Fire holds at 61% ±11** in the pairing bouts (68% in the larger Fire track): strong, with True Dragon + Air (70% ±11) still on top.
- **Earth is now the last stone (46% ±7)**, and Wyrm + Earth the last pairing (39% ±11). Its pools now linger too, but a pool costs Hardness, not Wounds, so it gains less than Fire's lane.
- **Fights drifted outward** a little (Very Far 7 → 9%), and timeouts held at 13%: the lingering fire hasn't made turtling pay.
- **The boxing triangle shuffled** (swarmer over out-boxer now 42%); at ±12 per cell, that's within noise.

## Round 17: Fire's blast at ¾ pace, on the cleaned-up Referee

Changes since Round 16 (master, 2,544 bouts):
- **Fire's blast radius ½ → ¾ pace**, now that aim settles late (12 − Accuracy ticks before the strike).
- **The cleanup** (`referee/ROADMAP.md`, Phases 0–8) changed no fights: a fixed set of 144 brain bouts replays identically. Charge, lunge and pounce are now the rules everywhere rather than switches.
- **Win rates now carry a 95% margin.** Pairings are ±11–12 points, morphs and stones ±6–7, styles ±6. Two rates whose margins overlap may not differ.

| | Round 16 | Round 17 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 56 / 47 / 47 | 56 / 44 / 50 |
| Stones (Air / Earth / Water / Fire) | 56 / 51 / 49 / 44 | 54 / 49 / 51 / **46** |
| Pairing spread | 36–65% | 36–65% |
| Fights at Melee / Close / Far / Very Far | 36 / 35 / 24 / 6% | 33 / 35 / 25 / 7% |
| Travel per bout (TD / Wyrm / Wyvern) | 11.2 / 14.8 / 16.6 | 10.9 / 14.4 / 16.2 paces |
| claw-focus vs general | 48% | 43% |
| charge / kite / meter-focus vs general | 51 / 48 / 46% | 53 / 52 / 42% |
| Style range (identical dragons) | 38–61% | 39–61% |
| Crunchling vs plain | 57% | 55% ±8 |
| Timeouts | 16% | 13% |

**What it shows:**
- **Stones are within 8 points (Air 54 to Fire 46)**, and every stone's margin overlaps its neighbors'. Fire rose 2; True Dragon + Fire is second at 61% ±11. Wyrm + Fire is last at 36% ±11, the one pairing whose margin clears 50%.
- **True Dragon is the strongest morph (56% ±6)**; the Wyrm (44% ±6) is the only morph whose margin falls below 50%. The Wyvern rose 3 points.
- **Most round-to-round moves are noise.** At these sample sizes a 3-point shift in a stone, or 10 in a pairing, is within the margin. Larger runs (`--rule` tracks, or `diag:pairing` with more bouts) are the way to test a specific change.
- **Breath is the main damage source** (44% of damage, 25% of slots); Bite 37%, Claw 17% (but the most accurate, landing 65%).
- **Two brain habits to look at:** the counterpuncher at Melee opens with a Bite 14 times in 20 and never with Scales, and kite-focus at Melee breathes or bites 11 times in 20 rather than backing off. Both still do well (56% and 52% against the general styles), so these may be sound reads rather than bugs.
- **The boxing triangle's third leg stays reversed:** the slugger beats the swarmer only 25% of the time.

## Round 16: trimmed Stalwart, ½-pace snap, brains that value position

Changes since Round 15 [Proposed] (master, 2,544 bouts; the style matrix adds a kite-focus brain):
- **Stalwart** drops the 3-tick faster Breath; it keeps own-zone immunity and ½ pace of widening per charging slot.
- **Separation snaps to the nearest ½ pace between slots**, so where a dragon lands in a band matters only for that action.
- **Brains value position:** each style's ideal band comes from its taste for each attack and its own dragon's attacks (Claw at Melee, Bite at Close, Breath at Far); keeping the opponent out of its band also counts. Every style values forcing misses, scaled by style.
- **Kite-focus**, a diagnostic brain: position first, holding Far.

A movement diagnostic before this round (528 bouts, Round 15 rules) found dragons moving in only 19–37% of slots, Retreat a small share of moves, and separation settling at the Melee/Close boundary (about 3.7 paces) by slot 7. True Dragons were hit in 24 of every 100 moves, mostly while still traveling into recovery, and never evaded mid-move.

| | Round 15 | Round 16 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 60 / 45 / 45 | 56 / 47 / 47 |
| Stones (Air / Earth / Water / Fire) | 64 / 46 / 47 / 42 | **56** / 51 / 49 / 44 |
| Pairing spread | 27–67% | **36–65%** |
| Fights at Melee / Close / Far / Very Far | 42 / 32 / 19 / 7% | **36 / 35 / 24 / 6%** |
| Travel per bout (TD / Wyrm / Wyvern) | 10.8 / 12.7 / 14.7 | 11.2 / 14.8 / 16.6 paces |
| claw-focus vs general | 54% | **48%** |
| charge / kite / meter-focus vs general | 44 / — / 39% | 51 / 48 / 46% |
| Style range (identical dragons) | 34–59% | 38–61% |
| Crunchling vs plain | 63% | 57% |
| Timeouts | 14% | 16% |

**What it shows:**
- **The tightest balance yet.** Stones span 12 points (Air 56 to Fire 44), down from 22; pairings 36–65%. Air's lead fell 8 points without touching Air: position-aware brains stop walking into its Claw range.
- **Fights spread out:** Melee fell from 42% to 36% of slots, Far rose to 24%. Retreat rose to 6% of slots.
- **No more dominant single plan.** Claw-focus fell to 48% against general styles; charge-, kite- and meter-focus all land 46–51%, viable without dominating. Only bite-focus (30%) and breath-focus (35%) trail.
- **The True Dragon came down to 56%** with the faster Breath gone, still the strongest morph; True Dragon + Air (65%) is the top pairing.
- **Fire is the weak stone (44%)**, with Wyvern + Fire (36%) and Wyrm + Fire (39%) at the bottom: Fire's Breath lands only 39%.

## Round 15: band movement and the breath-first True Dragon

Two changes since Round 14, in one run [Proposed] (master, 2,256 bouts; the style matrix now includes a charge-focus brain):
- **Band movement:** Approach, Retreat, Leap and Dive carry a band (3 paces) for every dragon, landing short or long by Evasion ÷ 6 paces. Strafe carries Evasion × ⅓ pace. A move winds up, evades for 2 × Evasion ticks, then recovers; travel takes 72 ÷ Evasion ticks and can run into recovery (punishable). Previously Evasion set distance (⅓ pace per point), so a True Dragon moved 1 pace per action.
- **Stalwart:** a True Dragon's Breath winds up 3 ticks sooner (recovers 3 later), its own zones never harm it, and each charging slot widens its released Breath by ½ pace.

**Movement census before the change** (528 diagnostic bouts, Round 14 rules): a True Dragon moved 1.05 paces per move and 4.5 paces a bout, and in 22% of bouts never left 1½ paces of its start. Wyrms moved 1.75 paces per move, Wyverns 2.48.

| | Round 14 | Round 15 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 44 / 51 / 55 | **60** / 45 / 45 |
| True Dragon pairings (Air / Earth / Water / Fire) | 64 / 47 / 38 / 27 | 67 / 61 / 61 / **53** |
| Travel per bout (TD / Wyrm / Wyvern) | 4.5 / 8.5 / 14.9 paces | 10.8 / 12.7 / 14.7 |
| Never leave 1½ paces of the start (TD / Wyrm / Wyvern) | 22 / 7 / 1% | 9 / 3 / 4% |
| Fights at Melee / Close / Far / Very Far | 41 / 33 / 20 / 5% | 42 / 32 / 19 / 7% |
| Stones (Air / Water / Earth / Fire) | 61 / 48 / 49 / 41 | 64 / 47 / 46 / 42 |
| Bottom pairings | TD + Fire 27 | Wyvern + Fire 27, Wyrm + Earth 33 |
| Timeouts | 14% | 14% |
| claw-focus / charge-focus / meter-focus vs general | 52 / — / 51% | 54 / 44 / 39% |

**What it shows:**
- **The True Dragon overshot: 44 → 60%.** True Dragon + Fire nearly doubled (27 → 53%), and every True Dragon pairing sits at 53–67%. The Wyrm and Wyvern both fell to 45%.
- **True Dragons move now** (10.8 paces a bout, up from 4.5), but **fights didn't spread out**: Melee and Close still hold 74% of slots. Approach carries a band too, so pressure keeps pace with retreat, and the leash bounds kiting.
- **So the True Dragon's gain is more likely the breath-first Aspect than range.** A Breath active at tick 9 interrupts Bites and slower Breaths, and its zones no longer burn it. The run can't separate the two changes; an ablation (band movement without Stalwart) would.
- **The rim isn't crowding fights:** 1.4% rim-pulse KOs, 0.06 slams and 0.77 blocked moves per bout. No case yet for a wider arena.
- **Charge-focus is viable but not dominant** (44% against general styles). Meter-focus fell to 39%.
- **Still open:** Air leads the stones (64%), and bite-focus trails (30% against general).

## Round 14: Stalwart steadies charges

One change from Round 13 [Proposed]: the True Dragon's old Aspect (+9 Wounds) is folded into a base 45, and **Stalwart** now means a hit breaks a True Dragon's charge only if it deals 6 or more after the charging guard. Master, 1,992 bouts.

| | Round 13 | Round 14 |
|---|---|---|
| Morphs (TD / Wyrm / Wyvern) | 48 / 50 / 52 | **44** / 51 / 55 |
| True Dragon pairings (Air / Earth / Water / Fire) | 64 / 56 / 41 / 32 | 64 / 47 / 38 / **27** |
| Stones (Air / Earth / Water / Fire) | 60 / 53 / 47 / 41 | 61 / 49 / 48 / 41 |
| Charges (share of slots) / broken per bout | 5% / 0.35 | 6% / 0.32 |
| Top / bottom pairing | Wyvern + Air 65 / TD + Fire 32 | Wyvern + Air 68 / TD + Fire 27 |

**What it shows:**
- **Stalwart barely engaged.** Charge breaks fell only from 0.35 to 0.32 per bout, and charges rose a point. Breaking charges was never common, so protecting them buys little.
- **The True Dragon fell 4 points** (partly noise: its pairings sit within ±8), and True Dragon + Fire fell again to 27%. Whatever is sinking it isn't its charges.
- **Likely suspects for True Dragon + Fire** (39 Wounds, Hardness 3, Breath 18): its Breath lands least of any stone (48%, the ½-pace blast), its Bite is its valley (6), and since Round 13 Intimidate's +3 is cashed three times as often, mostly by Bites into soft targets like it. It takes Bites at ×8.8.
- **Next:** a focused diagnostic on True Dragon + Fire (its action mix, damage dealt and taken by attack, and who beats it), before another rule change.

## Round 13: gravity, demoralize, Stomp, crunch cap

One fully patched run (master, 1,992 bouts: the style matrix now includes a meter-focus brain). Changes since Round 12, rung 5 [all Proposed]:
- **Gravity:** a flier that doesn't Leap during an exchange drops a band at its end.
- **The stoop** needs an exchange already aloft: no Leap and stoop in the same exchange.
- **Intimidate** that reaches also demoralizes: the target's next Bite or Claw loses 3.
- **Stomp** deals 3 + Hardness ÷ 3 and shatters boulders inside its radius.
- **Crunches** come once per exchange (Raking Talons and Gnashing Teeth) and never lunge, pounce or stoop.
- **Brains:** carry-over value for pending Intimidates, demoralizes and setups; reads keyed on altitude and a full meter; a meter-focus diagnostic style.

| | Round 12, rung 5 | Round 13 |
|---|---|---|
| Stones (Air / Earth / Water / Fire) | 63 / 46 / 46 / 44 | 60 / 53 / 47 / 41 |
| Morphs (TD / Wyrm / Wyvern) | 49 / 53 / 48 | 48 / 50 / 52 |
| Top / bottom pairing | Wyvern + Air 73 / Wyvern + Earth 35 | Wyvern + Air 65 / **True Dragon + Fire 32** |
| Pairing spread | 35–73% | 32–65% |
| Damage: Breath / Bite / Claw / Stomp | 40 / 36 / 24 / 0 | 42 / 34 / 22 / 2 |
| Timeouts / exchanges per bout | 16% / 4.8 | 15% / 4.7 |
| Intimidate: share of slots, lands, cashed per bout | 2%, 0.49, 0.22 | 6%, 1.27, 0.60 (demoralize felt 0.41) |
| Stomp: share of slots, lands | 1%, 26% | 2%, 36% |
| Stoops per bout | 0.22 | 0.14 (+0.07 tried too soon); gravity drops 0.34 |
| Crunchling vs plain, crunching | 72%, 15% of slots | 63%, 9% of slots |
| Style range (identical dragons) | 38–62% | 32–58% |
| claw-focus / meter-focus vs general | 56% / — | 55% / 51% |

**What it shows:**
- **Wyvern + Air came down 8 points**, and the Wyvern morph as a whole rose to 52%: the other Wyverns gained (Wyvern + Earth 35 → 47, Wyvern + Fire 41 → 47, Wyvern + Water 44 → 50). Gravity and the delayed stoop cut altitude camping, not the Wyvern.
- **Intimidate came alive:** three times the use, and the styles that lean on it rose (slugger 42 → 48, reader 43 → 53). The aerialist fell from first (62 → 55).
- **The crunch cap worked:** the crunchling fell from 72% to 63%. Brains adapted rather than hitting the cap (0.01 capped crunches per bout).
- **The meter is healthy:** meter-focus wins 51% against general styles, a viable plan, not a dominant one.
- **Stomp is now an action** (2% of slots, landing 36%), and Earth rose to 53%, likely through Wyrm and True Dragon Stomps and more grounded targets.
- **New problem: True Dragon + Fire fell to 32%** (from 45%), the new bottom pairing, and Fire is the weakest stone (41%). Its plan is Breath from range (Breath 18, Wounds 39): demoralize does nothing to Breath, but Intimidate's +3 and more frequent Stomps from heavier dragons may punish the low-Wounds breather. Needs a look.
- **Still open:** claw-focus leads the styles (55% against general), bite-focus (30%) and breath-focus (33%) trail, and Air (60%) still leads the stones.

## Round 12: the Affinity ladder

Five master runs (1,752 bouts each), one per commit, each adding a layer:
1. **Baseline:** Round 11 with the +3 Claw reverted (½-pace vortex and Wounds swing kept).
2. **Arena and contest:** 1d4+2 boulders; Affinity contests Breath verbs; a first Scales meter step; every action tracked.
3. **Meter:** Affinity fuels the Acumen meter; a full meter makes the next landed Bite, Claw or Breath true damage; grazes retired (base fill 3).
4. **Meter tuned:** base fill 9; a full meter's hit adds Affinity ÷ 3.
5. **Breath +3:** every Breath +3, and so every Affinity +3.

| | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Stones (Air / Fire / Earth / Water) | 67 / 46 / 45 / 41 | 65 / 44 / 46 / 45 | 64 / 49 / 41 / 45 | 63 / 46 / 49 / 42 | 63 / 44 / 46 / 46 |
| Morphs (TD / Wyrm / Wyvern) | 46 / 52 / 52 | 50 / 55 / 45 | 50 / 49 / 51 | 52 / 47 / 51 | 49 / 53 / 48 |
| Wyrm + Water | 41% | 48% | 45% | 42% | **55%** |
| Top / bottom pairing | Wyvern + Air 73 / 36 | Wyvern + Air 77 / Wyvern + Fire 30 | 73 / Wyvern + Earth 33 | 74 / 41 | 73 / Wyvern + Earth 35 |
| Damage: Breath / Bite / Claw | 32 / 42 / 26 | 33 / 41 / 25 | 35 / 40 / 25 | 37 / 39 / 24 | 40 / 36 / 24 |
| Timeouts | 20% | 20% | 21% | 18% | 16% |
| Scales / Dodge (share of slots) | 2% / — | 5 / 1% | 4 / 3% | 5 / 4% | 5 / 4% |
| Meter fills per bout (both sides) | — | — | 8.1 | 8.0 | 7.6 |
| Meters filled / true-damage hits per bout | — | — | 0.23 / 0.17 | 0.63 / 0.44 | 0.92 / 0.68 |
| Verbs held by Affinity per bout | — | 0.04 | 0.05 | 0.05 | 0.05 |
| breath-focus vs general | 37% | 37% | 35% | 35% | 42% |
| claw-focus vs general | 61% | 57% | 57% | 55% | 56% |
| Crunchling vs plain | 69% | 67% | 66% | 66% | 72% |

**By step** (±3 points on stones and morphs is noise; ±8 on single pairings):
- **1 → 2, arena and contest:** Water +4. Scales use more than doubled (2 → 5%), from its meter step. Wyverns dipped (52 → 45) on the denser floor, Wyvern + Fire to 30%, then recovered in later rungs. **The verb contest almost never decides anything:** 0.04–0.05 verbs held per bout in every rung.
- **2 → 3, the meter:** about 4 triggers per dragon per bout, but only 0.23 meters filled and 0.17 true-damage hits per bout at base fill 3. Dodge rose to 3% as a trigger. Morphs tightened to 49–51%.
- **3 → 4, base 9 and the steroid:** meters filled nearly tripled (0.63 per bout) and true-damage hits reached 0.44. Stone moves are inside the noise.
- **4 → 5, Breath +3:** the payoff step. 0.92 meters filled and 0.68 true-damage hits per bout; Breath's share rose to 40%, breath-focus to 42% against general styles, and timeouts fell to 16%. **Wyrm + Water jumped 42 → 55%**: Affinity 12 means a 46 start, 21 per trigger and a +4 steroid. The feared Fire cannon didn't appear (Fire 44%).

**Across all five:**
- **The meter is the mechanism that moved Water's flagship,** and it gave the guard layer back some use (Scales 5%, Dodge 4%, from 2% and about 1%).
- **About a quarter of filled meters are never spent** (0.92 filled against 0.68 spent): those bouts end first.
- **Air's lead is untouched (63–67%), and Wyvern + Air tops every rung (73–77%).** None of these layers touched Air's Claw-and-pull kit.
- **Claw-focus still beats general styles (55–61%), and crunchlings stay at 66–72%.** Both are the melee loop's symptoms and remain open.
- **Rarely used:** Intimidate (2% of slots, cashed 0.22 times per bout, falling short 0.08–0.13), Stomp (1%), Hold and Dive (about 0%).

## Round 11: Claws +3, vortex ½ pace, swings move Wounds

Three changes since Round 10, in one run, so attribution is by reasoning:
- **Every Claw +3 Sharpness** (Water 6, Earth 9, Fire 9, Air 12).
- **Air's vortex radius ½ pace** (was 1), aiming its land rate at Fire's.
- **The body side of every swing is Wounds, in 6s** [Proposed]. Signature defenses stay at base (True Dragon Wounds, Wyvern Evasion, Wyrm Hardness); no swing feeds a derived stat.

Master, 1,752 bouts.

| | Round 10 | Round 11 |
|---|---|---|
| Damage: Breath / Bite / Claw | 34 / 40 / 25% | 28 / 29 / 42% |
| Air Breath lands | 75% | 55% (Fire 45%) |
| Stones (Air / Fire / Earth / Water) | 67 / 49 / 45 / 39 | 69 / 53 / 44 / 34 |
| Morphs (TD / Wyrm / Wyvern) | 53 / 50 / 47 | 48 / 52 / 50 |
| Wyrm + Water / Wyrm + Air | 36 / 68% | 32 / 73% |
| Top / bottom pairing | TD + Air 73% / Wyrm + Water 36% | TD + Air 74% / TD + Water 24% |
| claw-focus | 63% | 63% |
| Timeouts | 18% | 15% |
| Crunchling vs plain | 71% | 74% |

**What it shows:**
- **Claw is now the main attack (42% of damage)**, as expected from raising every Claw. Melee is where bouts are decided.
- **The vortex fix worked:** Air's Breath lands 55%, close to Fire's 45%.
- **Morphs are tight (48–52%).** The Wounds swing kept every morph's identity and the morph spread narrowed.
- **The swing didn't rescue Wyrm + Water (32%), and Wyrm + Air rose (73%).** Raising every Claw outweighed the durability change: Wyrm + Air (Claw 9, 36 Wounds) gained more from Claws than it lost from Hardness.
- **Stone balance follows the attack mix.** Air's peak is Claw and Water's valley is Claw. In Breath-heavy rounds Water won 53%; with Claw at 42% of damage it wins 34%, and True Dragon + Water (no swing, the plain Water dragon) is last at 24%. Water's peak, Affinity, defends against the least-used attack (Breath, 28%).

**The structural point:** each stone has a peak in one attack or defense, so whichever attack dominates crowns the stone that peaks in it. Stones balance when the three attacks carry roughly equal shares of damage. Round 7 came closest (34 / 38 / 28), and Air still led there, so Air's lead is partly the shape of its kit (pull into its own Claw) and partly the mix.

## Round 10: Air's vortex

Changes from Round 9 [Proposed]:
- **Air's Breath is a ranged vortex**, centered where it's aimed, 2 paces across (was a wide cone).
- **It pulls the target a band toward the breather**, lowering a flier without grounding it. A second vortex in the breather's own space throws anything at Melee out to Close, so the pull ends at Close.
- **Air's +2 Breath is gone.**
- **Any forced movement into the wall or an obstacle slams for 3** (was Water-only). A push and a pull in the same moment cancel.
- **Brains read leverage:** every style values a pinned target (wall or obstacle within a band behind it), avoids being pinned, and credits breaking a charge.

Master, 1,752 bouts.

| | Round 9 | Round 10 |
|---|---|---|
| Stones (Air / Fire / Earth / Water) | 66 / 48 / 46 / 40 | 67 / 49 / 45 / 39 |
| Air pairings (TD / Wyrm / Wyvern) | 65 / 71 / 61 | 73 / 68 / 59 |
| Air Breath: lands, damage per hit | 79% ×5.9 | 75% ×3.8 |
| Damage: Breath / Bite / Claw | 38 / 38 / 23% | 34 / 40 / 25% |
| Morphs (TD / Wyrm / Wyvern) | 50 / 54 / 47 | 53 / 50 / 47 |
| claw-focus / bite-focus / breath-focus | 57 / 40 / 39% | 63 / 37 / 34% |
| Timeouts | 16% | 18% |
| Crunchling vs plain | 72% | 71% |

**What it shows:**
- **Air's lead didn't move (67%).** Its Breath now hits for the least damage of any stone (3.8 a hit) and still lands 75%: a 1-pace vortex aimed at the target's position is hard to slip, since most dragons move about a pace by the time it's active.
- **The pull feeds Air's Claw.** Air is the only stone whose Claw works against Hardness: 9 against 3–6 (12 on a Wyvern). Every other stone's Claw is 6 or 3 and does 0–3 a hit. Air led in every era (60% in the cone baseline, 64–69% since), and its Claw is the common thread. Dragging targets to Close only adds to it.
- **Wyrm + Air fell (71 → 68%)**, True Dragon + Air rose (65 → 73%): the TD has Claw 9 with 45 Wounds.
- **Water stays last (39%)** and Wyrm + Water is still the bottom pairing.
- **Leverage didn't swing results.** The brains now value pins, but the arena offers few, and slams stay rare.

**Levers:**
1. **Claw against Hardness** is the root: either raise every Claw by 3 (the original intent), so Air's peak stops being the only Claw that works, or give Claw a little pierce of its own.
2. **Vortex radius:** 1 pace lands 75%; Fire's ½ pace lands 47%. ¾ pace would put the pull's reliability in between.
3. The Wyrm Wounds swing (from the analysis) for Wyrm + Water at the bottom.

## Round 9: Water's jet

Changes from Round 8 [Proposed]: Water's jet pushes a whole band (3 paces, was 1); a push that meets the wall or an obstacle slams for 3; the jet shoves a boulder a band instead of breaking it (a Water Breath of 9 shattered every boulder, so shoving needed that). Any landed hit already broke a charge, so no change was needed there. Master, 1,752 bouts.

Accuracy by stone before the change (Round 8 rules), first figure lands, ×figure damage per landed hit:

| Stone | Breath | Bite | Claw | Breath taken | Bite taken | Claw taken |
|---|---|---|---|---|---|---|
| Air | 78% ×6.0 | 44% ×8.6 | 57% ×6.4 | 55% ×6.9 | 48% ×8.7 | 82% ×3.2 |
| Earth | 50% ×8.7 | 46% ×10.7 | 72% ×3.7 | 63% ×9.7 | 54% ×8.5 | 76% ×4.1 |
| Fire | 46% ×6.9 | 50% ×5.8 | 80% ×4.0 | 42% ×7.6 | 41% ×8.6 | 60% ×4.5 |
| Water | 52% ×9.6 | 50% ×8.9 | 86% ×1.6 | 63% ×3.9 | 49% ×9.2 | 73% ×4.3 |

Water's line lands mid-pack and hits hardest; its Affinity cuts Breath taken to 3.9 a hit. Its Claw (×1.6) is the hole, and it takes the hardest Bites (the preferred Wyrm + Water swings Hardness 6 → 3).

| | Round 8 | Round 9 |
|---|---|---|
| Stones (Air / Fire / Earth / Water) | 65 / 49 / 48 / 37 | 66 / 48 / 46 / 40 |
| Water pairings (TD / Wyvern / Wyrm) | 38 / 38 / 36 | 44 / 41 / 35 |
| Damage: Breath / Bite / Claw | 35 / 42 / 23% | 38 / 38 / 23% |
| breath-focus | 34% | 39% |
| Timeouts | 14% | 16% |

- **Water gained 3 points (37 → 40%)**, and Breath's share rose to 38%. The push helps, but modestly.
- **Brains don't plan slams.** They value damage and range band one slot deep; a push that sets up a slam or spoils a lunge isn't something they aim for. The slam itself counts as damage once it happens.
- **A band of push is double-edged:** it sends the target out of Water's own Bite range, and the Breath cooldown leaves Water little to follow with.
- **Rule check:** Water's +2 Breath came from "harmless extras earn points." The slam is now a harmful extra, so by that rule the +2 should shrink.
- Wyrm + Water stays bottom (35%): its preferred swing trades Hardness for Affinity, and Bites dominate.

## Round 8: Water's Claw back to 3, Fire's burn to 3

Changes from Round 7: Water's Claw returns to 3 (its valley; Air's Claw of 9 is its stone peak, not a boost), and Fire's burning zone deals 3 at slot's end instead of 1 (up to 6 if the target stays grounded in it through the next slot). Fire keeps its −2 Breath. Master, 1,752 bouts.

| | Round 7 | Round 8 |
|---|---|---|
| Damage: Breath / Bite / Claw | 34 / 38 / 28% | 35 / 42 / 23% |
| Timeouts | 14% | 14% |
| Stones (Air / Fire / Earth / Water) | 65 / 46 / 44 / 45 | 65 / 49 / 48 / 37 |
| Morphs (TD / Wyrm / Wyvern) | 47 / 59 / 44 | 47 / 57 / 45 |
| claw-focus / bite-focus / breath-focus | 59 / 40 / 30% | 58 / 40 / 34% |
| Top / bottom pairing | Wyrm + Air 77% / Wyvern + Earth 30% | Wyrm + Air 74% / Wyvern + Earth 35% |
| Crunchling vs plain | 74% | 74% |

- **Fire recovered to 49%**, now second among the stones. Breath-focus rose 4 points.
- **Water fell to 37%** without its Claw raise. Its strengths (Affinity, Breath 9) don't carry it yet.
- **Air still leads at 65%, and Wyrm + Air at 74%.** That pairing isn't a Claw story: the Wyrm dislikes Air, so the swing moves 3 from Claw into Hardness, making it the only dragon with Hardness 9. Bites pierce to 6, a plain Claw of 6 does nothing, and a pounce does 3. Wyrm + Earth (Hardness 6, Bite 12) is second at 65%.
- **Crunchlings hold at 74%.** Raking Talons needs its own look.

**Next levers:** cap the disliked swing on Hardness (a disliked Wyrm gains Wounds instead), or raise pierce against Hardness 6 and above. Then Water, then Raking Talons.

## Round 7: Breath charge optional again

The only change from Round 6: a plain Breath fires in one slot again. Everything else stays: two-slot charges earn +3 (a one-slot charge earns nothing), Bellows Chest restores the +3, lunge and pounce are on, Water's Claw is 6, and brains plan setups. Master, 1,752 bouts.

| | Round 6 | Round 7 |
|---|---|---|
| Breath's share of damage | 22% | 34% |
| Bite's share | 51% | 38% |
| Claw's share | 27% | 28% |
| Lands: Breath / Bite / Claw | 66 / 50 / 66% | 60 / 48 / 69% |
| Timeouts | 20% | 14% |
| Exchanges per bout | 5.1 | 4.8 |
| Charges (share of slots) | 14% | 5% |
| Bites after an Approach / Claws after a Strafe | 23 / 29% | 29 / 29% |
| claw-focus / bite-focus / breath-focus | 63 / 48 / 26% | 59 / 40 / 30% |
| Morphs (TD / Wyrm / Wyvern) | 50 / 56 / 45 | 47 / 59 / 44 |
| Stones (Air / Earth / Fire / Water) | 69 / 49 / 43 / 39 | 65 / 44 / 46 / 45 |
| Pairing spread | 33–74% | 30–77% |
| Crunchling vs plain | 64% | 74% (crunches in 20% of slots) |

**What it shows:**
- **The three attacks split damage about evenly for the first time** (34 / 38 / 28). Breath recovered 12 points, mostly from Bite. Timeouts are at their lowest yet (14%), and bouts are shortest (4.8 exchanges).
- **Water and Fire recovered** (39 → 45%, 43 → 46%) as Breath came back. Earth fell to 44%.
- **Charges dropped to 5% of slots.** A one-slot charge only guards, so brains skip it and use plain Breath or the two-slot charge.
- **Claw still leads.** Claw-focus wins 59%, Air (Claw 9) leads the stones at 65%, and crunchlings climbed to 74%.
- **The Wyrm rose to 59%, and Wyrm + Air is the top pairing (77%).** Serpentine makes the Wyrm's strafe evade like a dodge, and every strafe now sets up a pounce. The Wyrm owns the setup for the strongest attack.

**Next levers:**
1. **Trim the pounce:** pierce only, no advance; or a 2-pace reach. That should pull Claw, Air, the Wyrm and crunchlings down together.
2. If crunchlings still lead after that, look at Raking Talons with Water's Claw at 6.

## Round 6: everything at once

Added since Round 5, all in one run (master, 1,752 bouts):
- **Pounce:** a Claw right after a Strafe advances up to one band during its active window, sweeping its arc, and pierces 3. An airborne Wyvern that strafes into its stoop pierces too.
- **Water's Claw 3 → 6.** A Claw of 3 hurt nothing.
- **Brains plan setups:** Approach-Bite, Strafe-Claw and two-slot charges are weighed as two-slot ideas, by each style's taste for both halves.
- Elemental bite dropped.

| | Round 5 (charge + lunge) | Round 6 (all) |
|---|---|---|
| Breath's share of damage | 45% | 22% |
| Bite's share | 42% | 51% |
| Claw's share | 12% | 27% |
| Lands: Breath / Bite / Claw | 70 / 45 / 61% | 66 / 50 / 66% |
| Timeouts | 29% | 20% |
| Exchanges per bout | 5.7 | 5.1 |
| Bites after an Approach | 14% | 23% |
| Claws after a Strafe | — | 29% |
| claw-focus / bite-focus / breath-focus | 47 / 67 / 34% | 63 / 48 / 26% |
| Morphs (TD / Wyrm / Wyvern) | 51 / 52 / 47 | 50 / 56 / 45 |
| Stones (Air / Earth / Fire / Water) | 64 / 48 / 39 / 49 | 69 / 49 / 43 / 39 |
| Pairing spread | 32–70% | 33–74% |
| Crunchling vs plain | 58% | 64% (crunches in 17% of slots) |

**What it shows** (one run, so attribution is by reasoning, not isolation):
- **The pendulum swung to melee.** Claw's share more than doubled and Breath's halved. Timeouts fell to 20%, the lowest yet. The Dragonseeds range trap is gone, and Breath is now the weak attack: breath-focus wins 26%.
- **Brains use the setups.** Bites after an Approach rose from 14% to 23%; 29% of Claws follow a Strafe. Bite-focus fell from 67% to 48% as general styles learned the same sequence, so the Round 5 overshoot was mostly a brain gap.
- **Claw-focus now overshoots (63%, 60% against general styles).** A pounce reaches from Close and pierces; with a Claw of 6–9 it out-damages most answers.
- **Stones now track Claw.** Air (Claw 9) leads at 69%; Water (Breath and Affinity, its strengths) fell to 39% despite the Claw raise. With Breath this small, Affinity protects little.
- **Crunchlings climbed to 64%**: Raking Talons rides the Claw meta.
- **Morphs hold within 45–56%.** The Wyvern holds its niche at 45%.

**Levers, in the order I'd try them:**
1. **Relax mandatory charge.** It was the fix for Breath dominance, which no longer exists. Plain Breath again, with the two-slot charge still earning +3, would lift Breath and Water together.
2. **Trim the pounce** if Claw still leads: pierce only, without the advance, or a 2-pace reach.
3. Revisit Water's valley once Breath recovers.

## Round 5: charge and lunge, reworked

Settled from Round 4:
- Hits resolve in layers: geometry first, then Accuracy against Evasion, then Acumen. A swift dragon reaching safe geometry before the active window is intended. Round 4's Evasion skips are gone.
- Tracking is dropped. Bite stays a straight line.
- A one-slot charge releases with no bonus. Holding a charge a second slot (Bite or Breath, slots 1–2, release in 3) earns +3. Bellows Chest restores the +3 on any Breath charge and then adds its own; its 2-pip size is its price.
- The lunge needs an Approach that moved in the slot before, and is geometry only.

Probes: a Bite chain against a retreating Wyrm hits at Melee, hits at Close, and misses once it reaches Far. Approach then Bite catches a retreating Wyrm one pace farther out than before; a Wyvern still outruns it.

**Results (master, 1,752 bouts per run, one change added per run):**

| | Base | +Charge | +Lunge | +Elemental |
|---|---|---|---|---|
| Breath's share of damage | 63% | 55% | 45% | 46% |
| Bite's share | 27% | 35% | 42% | 42% |
| Claw's share | 10% | 11% | 12% | 12% |
| Breath lands | 59% | 71% | 70% | 70% |
| Bite lands | 39% | 40% | 45% | 45% |
| Timeouts | 28% | 33% | 29% | 29% |
| Exchanges per bout | 5.6 | 6.0 | 5.7 | 5.7 |
| Bites right after an Approach | 13% | 13% | 14% | 13% |
| breath-focus | 48% | 43% | 34% | 34% |
| claw-focus | 44% | 44% | 47% | 47% |
| bite-focus | 34% | 53% | 67% | 67% |
| Morphs (TD / Wyrm / Wyvern) | 47 / 52 / 52 | 49 / 52 / 49 | 51 / 52 / 47 | 51 / 52 / 48 |
| Air / Fire (top and bottom stones) | 60 / 49 | 59 / 44 | 64 / 39 | 65 / 39 |
| Pairing spread | 33–68% | 38–67% | 32–70% | 33–73% |
| Crunchling vs plain | 54% | 57% | 58% | 58% |

**Attribution:**
- **Charge without the free +3 does what Round 4's didn't.** Breath's share falls 63% → 55% and Bite's rises 27% → 35%. Breath lands more often (71%): brains charge when it's safe, and the charging slot guards. Bite-focus jumps 34% → 53%, since a charging dragon stands still. That fits "Approach and lunge counter a charged Breath." Timeouts rise 5 points; bouts run longer when every Breath costs two slots.
- **The gated lunge shifts damage without the Round 4 collapse.** Breath falls to 45% and Bite rises to 42%; the three attacks now split damage. Morphs stay within 47–52%: the Wyvern holds at 47% (it was 39% with the ungated lunge). The setup is rarely free: only 13–14% of Bites follow an Approach in every run.
- **Bite-focus overshoots: 67% overall, 65% against general styles.** The focus brain approaches and then bites on purpose; general brains do it about 1 time in 7. Before tuning the lunge down, it's worth teaching general styles the Approach-Bite sequence. A ½-pace lunge is the fallback.
- **Elemental bite is still a wash in aggregate**, as in Round 4: on the four built stones each beats one and loses to one. The style matrix uses identical dragons, so it can't move there at all.
- **Fire keeps sliding (49% → 39%).** Mandatory charge hits Fire hardest: its −2 breath and small blast make two slots for one Breath a poor trade. Air (wide cone, shove) stays on top at 64–65%.

**Open questions:**
- **Elemental bite is dropped.** It was meant to carry Bite through bad matchups while Breath sat on a longer cooldown. Breath's cooldown didn't change, so it would only punish Bite in bad matchups.
- Teach general brains the Approach-Bite sequence, then rerun before touching the lunge's size.
- Fire under mandatory charge: lift the −2, or give its burning zone more weight.
- Timeouts went up with charge (33%); the lunge pulls them back to 29%, still above the 28% baseline.

## Round 4: attack roles

The goal: each attack catches one form of evasion. Claw catches strafes, Bite catches retreats and armor, Breath catches dodges, Stomp catches burrows and the grounded. Four [Proposed] changes went in behind a switch (`REFEREE_VARIANT`) and were added one per run, master skill, 1,752 bouts each:
1. **Charge:** Breath must charge. A plain Breath is read as a charge; slot 3 can't start one.
2. **Tracking:** a Bite begun at Close re-aims as its wind-up ends, and a strafe's Evasion doesn't apply to it. Melee strafes still escape.
3. **Lunge:** a Bite carries the dragon up to 1 pace along its aim during its wind-up, and a retreat's Evasion doesn't apply to it.
4. **Elemental bite:** a Bite carries the stone matchup (±3) unless the biter has a Breath charged.

**A premise correction from building it.** A strafe or retreat escapes a Bite through the Evasion test (Evasion above Accuracy while moving), not through geometry. Probes showed pure re-aiming changed nothing against Wyvern and Wyrm strafes, so tracking and lunge were built to skip that Evasion. Claw also tests Evasion against strafes, so "Claw catches strafes" is not built yet; only Scything Forelimbs Elder touches it.

| | Base | +Charge | +Tracking | +Lunge | +Elemental |
|---|---|---|---|---|---|
| Breath's share of damage | 63% | 69% | 68% | 25% | 25% |
| Bite's share | 27% | 22% | 24% | 55% | 55% |
| Claw's share | 10% | 9% | 9% | 20% | 20% |
| Breath lands | 59% | 68% | 69% | 65% | 64% |
| Bite lands | 39% | 34% | 24% | 40% | 40% |
| Claw lands | 55% | 57% | 57% | 73% | 74% |
| Timeouts | 28% | 23% | 22% | 16% | 16% |
| Exchanges per bout | 5.6 | 5.6 | 5.5 | 4.5 | 4.5 |
| Scales use | 5% | 2% | 2% | 2% | 2% |
| breath-focus | 48% | 46% | 44% | 31% | 31% |
| claw-focus | 44% | 40% | 40% | 54% | 54% |
| bite-focus | 34% | 38% | 39% | 40% | 40% |
| Morphs (TD / Wyrm / Wyvern) | 47 / 52 / 52 | 51 / 49 / 50 | 50 / 49 / 52 | 56 / 55 / 39 | 55 / 57 / 39 |
| Air (top stone) | 60% | 62% | 61% | 68% | 68% |
| Pairing spread | 33–68% | 33–67% | 33–68% | 24–79% | 29–80% |
| Crunchling vs plain | 54% | 60% | 55% | 70% | 70% |

**Attribution:**
- **Charge made Breath stronger, not weaker.** The release's +3 and the charging slot's Scales guard outweigh the lost tempo; Breath lands more (68%) and its share rose to 69%. Timeouts fell 5 points. Scales use halved, since the charging slot already guards. Morphs tightened to 49–51%.
- **Tracking alone barely moved anything.** Bite's land rate fell (34% → 24%): brains bite more at Close and still meet dodges and Melee strafes. Bite-focus gained 1 point.
- **The lunge is the big lever, and it overshoots.** Breath falls to 25% of damage, Bite rises to 55%, fights end an exchange sooner, timeouts drop to 16%. The Dragonseeds range trap is gone. The cost: every Bite is also a free 1-pace approach, so the swarmer and claw-focus climb, crunchlings jump to 70%, and the Wyvern collapses to 39% (its Evasion was its defense against being run down). Breath-focus falls to 31%.
- **Elemental bite is a wash in aggregate.** Among the four built stones, each beats one and loses to one, so ±3 cancels across stones. It nudges single pairings (Wyvern + Fire 24% → 29%). Salt, Magma, Lightning and Storm would change that.

**Open questions for the project chat:**
- **Scope the lunge.** Candidates: lunge only when the Bite begins at Close (where Bite lives); lunge ½ pace; keep the carry but drop the Evasion skip. Each answers "catches retreats" with less tempo.
- **Charge as built rewards Breath.** If the intent was a tempo tax, the charged release should lose the +3 when charging is mandatory, or the charging slot should lose its Scales guard.
- **Wyvern needs an answer to the lunge** if it stays: a Leap or airborne target might escape it.
- **Claw's strafe-catching role** needs its own rule: for example, Claw skips a strafe's Evasion at Melee, mirroring tracking at Close.
- Infuse refocusing on Claw waits on Supports, which aren't built.

## Round 3: focus brains

Three new brains attack with one thing only, and use every move, guard and Intimidate to serve it: **claw-focus** (Melee), **bite-focus** (Close), **breath-focus** (Far). They joined the style-against-style matrix on identical dragons (24 bouts per pairing of styles, so ±10 points is noise).

| Focus brain | Overall, adept | Overall, master | vs general styles (master) |
|---|---|---|---|
| breath-focus | 51% | 48% | 48% |
| claw-focus | 43% | 44% | 39% |
| bite-focus | 34% | 34% | 32% |

- **Breath alone nearly holds its own.** A dragon that only ever breathes wins about half its bouts against brains using everything. More evidence that Breath carries the game.
- **Bite alone is the weakest plan,** even after piercing. It needs Close range and a narrow line, and moving targets escape it through Evasion (see Round 4).
- **Claw-only beats the other focus brains at master (63%)**: the long active window catches movement.
- With focus brains in the mix, Breath's share of all damage reads 63–64%.
- **General styles at master:** aerialist 62%, out-boxer 56%, counterpuncher 56%, slugger 55%, swarmer 50%, reader 48%, boxer-puncher 47%.

## Round 2 update

**Changes from the project chat's shard notes:**
- **Bite pierces 3 Hardness** [Doc: "piercing"; amount Assumed]. A baseline Bite now deals 9 instead of 6. Chained bites reach 30 on a True Dragon.
- **Ratchet Claws** is an escalating chain: each landed Claw link adds +1 to the next; the final link's bonus pays for it (−3, −1 from Adult). Grade terms are [Proposed].
- **True Dragon Aspect, Stalwart:** a flat +9 Wounds after the swing (36 → 45; Fire 39; Earth 51).
- Information Techniques kept as they are; judge them in human play. Crunchlings judged healthy.

**Results (master skill, 1,176 bouts):**

| | Round 1 | Round 2 |
|---|---|---|
| True Dragon | 41% | 49% |
| Wyrm | 56% | 53% |
| Wyvern | 53% | 47% |
| Breath's share of damage | 76% | 68% |
| Breath lands | 57% | 60% |
| Pairing spread | 29%–76% | 35%–74% |
| Crunchling vs plain | 51% | 52% |

- **Morphs are now within 47–53%** at master, and within 49–52% at adept. The True Dragon recovered from last.
- **Bite piercing pulled Breath's damage share down** from 76% to 68%: closing in pays more now. Timeouts are still about 25%.
- **Hardness shards no longer sweep the shard ranking.** Mountainback (65%) and Ironheart (64%) remain strong; Shalecoat fell out of the top. The top is now mixed: Sundering Claws 72%, Smoldering Maw, Crucible Gland, Lance Throat.
- **Still at the edges:** Air leads the stones (61%); Earth (41%) and Fire (44%) trail. Wyrm + Air (74%) and True Dragon + Earth (35%) are the outliers.
- **Ratchet Claws (Venerable) ranks low (38%)** in random loadouts with crude AI. Worth a look after human play.

The rest of this file is Round 1.

The Referee is a text-only rules engine (in `referee/`). It plays two dragons' scripts tick by tick and reports exactly what happened. AI tamers play thousands of bouts through it to test balance. Every number it uses lives in `referee/src/rules.ts`, tagged **[Doc]** (settled), **[Proposed]** (marked proposed in the design doc) or **[Assumed]** (a placeholder this build needed).

---

## 1. Decisions made during the build

These are settled in conversation and now reflected in the docs or the engine.

**Combat timing**
- An action always totals 30 ticks. Wind-up and recovery shifts move the active window's edges.
- Attacks aim when their wind-up starts. A strafe or leap during the wind-up can slip them. [Assumed]
- Breath, Bite and Claw reach as far as their shapes allow; Air's breath reaches Far like the others.

**Revisions**
- One revision per exchange. It flashes, and the opponent sees only *that* a revision happened, never what it was.
- A revised slot 3 gets no chain bonus.

**Chains**
- A link counts only when it lands. Other actions in between don't break a chain; a different attack starts a new one.
- A chain lapses only when a whole exchange passes without a landed hit.

**Guarding**
- Dodge avoids harm (Evasion). Scales presents the hide: +3 Hardness against Bite and Claw, and +3 Affinity against Breath.

**Morphs**
- **Wyvern egg:** Wounds 24, Evasion 9, Hardness 3. Its valley moved to Wounds so Evasion isn't its only defense.
- **Wyvern Aspect, Talons:** a Claw from the air against a grounded opponent anywhere within Far is a stoop. It flies to the ground during the wind-up, lands at Melee and swipes both ways. The price is getting airborne first and landing in Bite range.
- **Wyrm Aspect, Serpentine:** its Strafe evades like a Dodge (+3). It is grounded: its Leap is a hop, and it can't Dive. [Proposed]
- **True Dragon:** no Aspect, as the doc says.

**Elements and Breath**
- Breath effects at wyrmling strength: Water pushes 1 pace, Air shoves 1 pace sideways, Fire leaves a burning zone, Earth leaves a corrosive pool.
- Breath damage by element: harmless extras earn points, harmful ones cost them. Water +2, Air +2, Earth +1, Fire −2. [Assumed values]
- Fire's blast radius cut from 1.5 to 0.5 paces.
- Breath otherwise left as designed while systems are added.

**Charges and crunches**
- Bite and Breath can be charged: one action across two slots. The charging slot guards like Scales; a landed hit breaks the charge; the release hits for +3 and can't be revised. No charging in slot 3.
- Crunches (two attacks in one slot, 15 ticks each, no modifiers, no chains) come only from Raking Talons or Gnashing Teeth. Wyrmlings don't crunch by default.

**Techniques**
- Lockjaw no longer forces the next slot to Bite: it looped. Its price is now **[Open]**.
- Ratchet Claws rewritten for the new chain rule: it holds a Claw chain through a hitless exchange.
- Mantle Wings stacks +3 more Affinity on top of Scales' +3.

**Project**
- Platform: PC and Linux, private, local play first. Local PvP between save profiles in lobby bouts.
- Art direction: hand-drawn watercolor, ink-blot and ink-stamp.
- Unfilled slots hold position when the clock runs out. Scripting clock: 30 seconds.
- Team: solo with AI help for the mockup; contractors later, with the designer as project manager.

---

## 2. What's built

| System | State |
|---|---|
| 30-tick timeline, hits, near misses, grazes, Acumen meter, interrupts, punishes, trades | Built |
| Chains, cooldowns, Intimidate, Scales, Dodge, statuses | Built |
| Movement in 3D: altitude, Leap, Dive, leash, arena wall | Built |
| Revision window with hidden content | Built |
| Full bouts: exchange limit (8), rim pulses, timeouts | Built |
| Aspects (Talons stoop, Serpentine) | Built |
| Breath effects and zones | Built |
| Obstacles: rim pillars, seeded boulders | Built |
| Charges and crunches | Built |
| Shards for wyrmlings: 3-pip array, overlap, all Body, Bloodstone and Technique shards | Built |
| Brain AI: read, imagine, value, choose, tell; seven styles; three skill levels | Built |
| Supports, Traits, compounds | Not yet (Supports need seams; Traits are Elder+) |
| Growth past wyrmling, the Hatchery and Weir, saves | Not yet |
| The browser Scripter | Not yet |

---

## 3. Findings

### Breath dominates, and better players make it worse

The clearest result of the whole build.

| | Crude AI | Adept brains | Master brains |
|---|---|---|---|
| Breath lands | 82–95% | 59% | 57% |
| Breath's share of all damage | ~50% | 75% | 76% |
| Bouts ending in timeout | 9% | 26% | 25% |
| Slots spent on Scales | — | 6% | 5% |

Smarter brains dodge more breaths, yet Breath's share of damage still rises, because they avoid closing in. Bite and Claw happen less and more bouts stall. This is the Dragonseeds pull toward range that the design doc set out to fix.

Why Breath wins:
1. **Reach.** It's the only attack that works at Far, where bouts start.
2. **No Evasion test,** by design.
3. **Area.** A shape is easier to land than Bite's narrow line.
4. **Damage equal to a Bite,** without having to close in.

Guarding with Scales rarely pays: it costs a whole slot to save 3 points, and brains judge that a bad trade.

**Candidate levers, not yet tested:**
- **Every breath is a charge** (two slots). Range costs tempo and gives the opponent a slot to close in.
- **On-again, off-again cooldown** (cooldown 5: Breath every other exchange, same slot).
- **Damage falloff with range** (full at Close, less at Far).
- **Graze on Evasion:** a moving or dodging dragon takes −3 and no breath effect.

### Balance at master skill (latest run, 1,176 bouts)

**Morphs:** Wyrm 56%, Wyvern 53%, True Dragon 41%.
**Stones:** Air 64%, Water 53%, Fire 44%, Earth 39%.

| Pairing | Win rate |
|---|---|
| Wyrm + Air | 76% |
| Wyvern + Air | 64% |
| Wyrm + Water | 61% |
| Wyvern + Water | 55% |
| True Dragon + Air | 52% |
| Wyvern + Fire | 50% |
| Wyrm + Fire | 45% |
| True Dragon + Water | 44% |
| Wyvern + Earth | 44% |
| Wyrm + Earth | 44% |
| True Dragon + Fire | 38% |
| True Dragon + Earth | 29% |

- **The True Dragon trails.** Low Evasion, no Aspect. True Dragon + Earth is last: Earth's disliked swing costs it Bite, and Earth's Affinity is 0.
- **Air now leads.** After its breath reach was fixed and it gained +2 damage, it's the strongest stone. Worth watching.
- **The Wyvern recovered** from last place (31%) after its egg change, the stoop, and Scales vs. Breath.

### Brains

- **They work.** An adept brain beats the crude AIs 80% of the time; a master 83%.
- **Styles converge at high skill.** At adept, swarmer > out-boxer > slugger > swarmer appeared (58% each leg). At master the triangle blurs, because strong brains all chase damage. Styles that feel distinct at every skill would need heavier style values.
- **Each style has a readable tell** for campaign play; novices show it 90% of the time, masters 15%.

### Shards

- **Hardness shards dominate** random loadouts (Ironheart 68%, Shalecoat 65%, Mountainback 65%). Every Bite and Claw subtracts Hardness.
- **Information Techniques rank last** (Ash Gland, Baleful Eye), likely because the AI barely uses information. Real players may value them more.
- **Ratchet Claws is weak** (35%): under the new chain rule, chains rarely need saving, so it mostly pays its cost.
- **Crunchlings** (Juvenile Raking Talons) win 56% at adept and 51% at master against identical plain dragons, crunching in 7–10% of slots. A mild edge.

### Design-doc conflicts found

- **Zmey's Aspect** ("breath leaves burning zones natively") duplicates every Fire breath. Marked **[Open]**; it needs a different bend.
- **Lockjaw** has no price since the forced Bite was cut. Marked **[Open]**. One option: Bite recovery +5 ticks (+3 from Adult).
- **Revision timing:** a revision made at the last moment gives the opponent no time to answer the flash, so the flash rarely informs. Still open.

### Placeholder bugs caught by testing

- Air's breath reached only 6 paces, short of Far; it landed 40% of the time. Fixed.
- Dodge's active window ended before a Bite's opened, so a same-slot Dodge never met a Bite. Fixed (6/12/12).
- Two attacks striking the same boulder on the same tick depended on processing order. Fixed: they land together.
- A tournament bias let one side win every timeout. Fixed.

---

## 4. Open questions for the project chat

1. **The Breath lever.** Charge-only breath, on-off cooldown, range falloff, or graze on Evasion? Each can be measured in a few minutes.
2. **Lockjaw's price.**
3. **Zmey's Aspect.**
4. **Revision timing:** should late revisions cost something (for example, +3 wind-up ticks) so the flash means more?
5. **The True Dragon's weakness:** accept it as the cost of having no Aspect, or adjust?
6. **Style values:** heavier, so rivals feel distinct even at master skill?
7. **Next build:** the browser Scripter, or the Hatchery-to-arena pipeline?

---

## 5. How to reproduce

From `referee/` (Node.js 22+):

```sh
npm test                        # rule tests, brain behavior, and the scenario goldens
npm run duel -- scenarios/talons.json
npm run brains -- --skill master
npm run golden                  # 144 fixed-seed brain bouts: did anything change?
```

Earlier rounds ran their [Proposed] rules behind a `REFEREE_VARIANT` switch; charge, lunge and pounce are now the rules everywhere, and the switch is gone. To try a dial without editing the defaults, pass `--rule KEY=VALUE` to the tournament (see `referee/README.md`, "Tools for balance work").

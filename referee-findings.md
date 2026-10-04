# Referee Findings
*What building and testing the Dragon Duel rules engine has shown so far. For the project chat. Companion to `dragon-duel-design.md`.*

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
npm test                        # 96 tests pinning design-doc rules
npm run duel -- scenarios/talons.json
npm run tourney -- --shards     # crude AI, random loadouts
npm run brains -- --skill master
```

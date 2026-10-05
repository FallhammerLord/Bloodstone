# Dragon Duel: Design Document v0.1.4
*Working title TBD. A spiritual successor to Dragonseeds (Jaleco, PS1, 1998).*

**Status convention:** everything here is settled unless marked **[Proposed]** (suggested, not yet confirmed) or **[Open]** (undecided).

**Companion files:** `dragonshards-body.md`, `dragonshards-bloodstone.md`, `dragonshards-technique.md`, `dragonshards-support.md`, `dragonshards-trait.md` (shard suites).

---

## 1. Vision

**Pitch:** the neutral game of a fighter with the depth of a monster raiser.

**Lineage.** Dragonseeds let players raise dragons and fight them to the death. Its combat was solved: retreat to max range, reflect every special blast for free, then finish at close range. Its only max-range threat was finite, and the reflector answered it at no cost. Ken's friend group played it heavily anyway, in campaign and versus, which suggests the format holds and the solution was shallow.

**Principles**
- Every safe option needs a punish.
- Visible state turns guesses into reads. No hidden information.
- Information matters only when it persists to a decision point.
- Power grows mostly in options, less in numbers.
- The arena is the market: everything worth taking is visible on a rival.
- Each morph bends one rule.
- Morph sets how you play; element sets who you're strong against; combat decides who wins.
- Players control anything that affects power. Randomness lives only in flavor.
- Turtling is legal and boring, and it loses for whoever needs to win.
- A steep learning cliff with a high plateau is acceptable. A new player may lose a dozen wyrmlings before one reaches juvenile.

**Format: simultaneous resolution.** Real-time risks soulslike saturation and costs build depth, rollback netcode, and scope; Injustice 2 had to switch off its stat gear for ranked play. Pokémon proves simultaneous selection with RPG builds sustains a major competitive scene, and Yomi proves reads alone can carry a game. The fighting-game DNA lives in the slot timeline, interrupts and punishes, and choreographed animation.

**The poker frame.** A dragon is the board everyone reads: silhouette, chest stone, shards, cooldowns. Slots 1 and 2 are the blind bet; their reveal is the flop and turn. Slot 3 is the river decision. Intimidate is the raise; retreating to Very Far is checking.

---

## 2. Dragons

### Egg and Bloodstone
- **Egg** sets the morph: body, array shape, and primary attributes.
- **Bloodstone** sets the element, secondary attributes, and the sub-model. A fire wyvern looks very different from a water one.
- Egg and stone interact through **elemental preference** (below), so every pairing has an identity beyond its two halves.
- Dragons have cratered chests with the bloodstone visible to anyone. Its color shows the element; carved seams show as lines, scars as cracks, a shiny line as its sheen, and the leash's thread runs from crater to crater. **[Proposed]** A readout, never a weak point.

### Cosmetics
- Each dragon draws from a detail roster per body part: head, shoulders, body, wings, forelegs, hind legs, haunches, tail, ridges, scales.
- **[Proposed]** Egg sets structure, stone sets surface (scales, ridges, coloration, breath effects), attribute density sets proportions, scars set marks.
- Size, shape, and color variation is flavor and never affects power.

### Attributes
| Tier | Attributes | Source |
|---|---|---|
| Primary | Wounds, Evasion, Hardness | Egg |
| Secondary | Claw Sharpness, Bite Force, Breath Potency | Bloodstone |
| Tertiary | Accuracy, Affinity, Acumen | Derived at hatching, then grown |

- **Wounds:** the health pool. 3 points make one Wound.
- **Evasion:** how fast and finely a dragon moves; tested on dodge and strafe. **[Proposed]** Approach, Retreat, Leap and Dive carry a full band for every dragon; Evasion buys where in that band it lands (± Evasion ÷ 6 paces, scripted short or long), how fast the move resolves (72 ÷ Evasion ticks), how long it counts as evading (2 × Evasion ticks of active window), and how far a Strafe carries (⅓ pace per point).
- **Hardness:** damage reduction; improved when guarding.
- **Claw Sharpness, Bite Force, Breath Potency:** attack damage.
- **Accuracy:** **[Proposed]** how late an attack's aim settles: it tracks through the wind-up and settles 12 − Accuracy ticks before the strike (never less than 1, never longer than the wind-up), so movement after that is what the shape must cover. Also tracking and reach without leaving position; sets the phantom band around hitboxes.
- **Affinity:** elemental resistance; improved when guarding with Scales. **[Proposed]** It is the element's Evasion: a Breath's verb (push, pull, burn, corrosion) takes hold only if the breather's Potency beats the target's Affinity, ties to the higher Acumen. Affinity still subtracts from Breath damage, and it fuels the Acumen meter (below).
- **Acumen:** battle sense, shown as an integer and mapped through a hidden curve. It converts near misses, tips close contests, and scales punishes. Its meter is visible to both players. No shards raise it; it grows only through play.

**Units.** 3 points make one combat unit, everywhere. Everything runs on integers and displays as units and thirds. Damage is dealt in points: attack attributes add, Hardness and Affinity subtract. Acumen is the exception, mapping through a hidden curve.

**Derivation.** Tertiaries derive once at hatching, after the elemental swing: Accuracy from Evasion plus an egg modifier, Affinity from Breath Potency plus a stone modifier, Acumen from a starting value. **[Proposed]** Acumen's starting value is seeded from egg and stone rather than rolled. After hatching, each attribute grows independently, so no attribute buys another.

**Build philosophy.** No bounded-accuracy doctrine and no per-morph caps; pips and baseline attributes bound totals naturally. Every defense has an attack that ignores it, which answers concentration. Single-attribute builds are avoided by design. **[Proposed]** Stomp now adds Hardness ÷ 3, kept small so Hardness stacking stays a minor gain; its radius still scales by age only. Evasion, the attribute most at risk, is answered by Breath, Stomp, Claw, and Accuracy.

### Starting Attributes [Proposed]
A hidden baseline; each morph and each stone takes one +3 peak and one −3 valley. Wounds runs on a doubled scale so a baseline hit is about a sixth of a pool.

| Morph | Wounds | Evasion | Hardness | Accuracy (egg) |
|---|---|---|---|---|
| Baseline | 30 | 6 | 3 | 6 (+0) |
| True Dragon | 45 | 3 | 3 | 6 (+3) |
| Wyvern | 24 | 9 | 3 | 6 (−3) |
| Wyrm | 30 | 6 | 6 | 3 (−3) |

- **True Dragon outlasts:** the most Wounds, paid for in mobility. Its generalism lives in its kit.
- **Wyvern is never where you aimed:** the highest Evasion, the fewest Wounds. Its valley sits on Wounds rather than a defense, so Evasion is never its only protection.
- **Wyrm shrugs:** the highest Hardness, a narrow phantom band.

| Stone | Claw | Bite | Breath | Affinity (stone) |
|---|---|---|---|---|
| Baseline | 6 | 9 | 12 | 6 (−6) |
| Water | 3 | 9 | 12 | 9 (−3) |
| Earth | 6 | 12 | 12 | 3 (−9) |
| Fire | 6 | 6 | 15 | 6 (−9) |
| Air | 9 | 9 | 9 | 6 (−3) |

- **Water endures, Earth crushes, Fire scorches, Air rakes.**
- The element that beats you peaks where you're weakest, so matchup stacks reach two layers at most.
- Intermediates sum their parents' tilts: Salt +Bite −Claw; Magma +Breath −Affinity; Lightning +Claw −Bite; Storm +Affinity −Breath.
- Each dragon gets the same allotment, varying only slightly with lineage.

### Elemental Preference
Each morph prefers one element and dislikes the element that beats it.

| Morph | Prefers | Dislikes |
|---|---|---|
| True Dragon | Fire | Earth |
| Wyvern | Air | Fire |
| Wyrm | Water | Air |

**The swing** is zero-sum, so no pairing is simply better:
- **Preferred stone:** +3 to the stone's peak attribute, −6 Wounds. The dragon leans into its stone: more element, less body.
- **Disliked stone:** −3 to the stone's peak, +6 Wounds. The dragon fights its stone and toughens for it: more body, less element.
- **[Proposed]** The body side of the swing is always Wounds. Each morph's signature defense (True Dragon Wounds, Wyvern Evasion, Wyrm Hardness) stays at its base, and no swing feeds a derived stat, so every swing is zero-sum.
- **Neutral stone:** no swing.
- Wounds moves in 6s on its doubled scale.
- **Order:** the swing applies before tertiaries derive, so it carries into Accuracy and Affinity. A swing on Affinity (Water's peak) moves the stone modifier.

| Pairing | Swing | Derived knock-on |
|---|---|---|
| True Dragon + Fire | Breath 15 → 18, Wounds 45 → 39: a breath cannon | Affinity 6 → 9 |
| True Dragon + Earth | Bite 12 → 9, Wounds 45 → 51: the hardest True Dragon to kill | |
| Wyvern + Air | Claw 9 → 12, Wounds 24 → 18 | |
| Wyvern + Fire | Breath 15 → 12, Wounds 24 → 30: the toughest Wyvern | Affinity 6 → 3 |
| Wyrm + Water | Affinity 9 → 12, Wounds 30 → 24: a sea serpent the elements slide off | |
| Wyrm + Air | Claw 9 → 6, Wounds 30 → 36 | |

**[Open]** Derivation still amplifies swings that touch Breath Potency: True Dragon + Fire gains Affinity on top of its Breath. Swings no longer touch Evasion.

- **Growth leans the same way:** preferred pairings weight age-up points toward the stone's attributes; disliked pairings toward the egg's.
- **Intermediates derive:** one preferred parent counts as preference, one disliked parent as distaste, one of each cancels to neutral. For a True Dragon, Lightning is preferred, Salt disliked, Magma neutral.
- **[Open]** Coverage: among the core three, no morph prefers Earth or dislikes Water. Extended morphs can fill it; a Lindworm or Drake preferring Earth would be natural.

### Aspects and Parity
- **Draconic test:** every morph fills bite, claw, breath, and scales, and earns its identity by bending one of them.
- **Aspect** is the player-facing name for that bend ("bend" stays as design shorthand).
- Morphs offer interesting choices and never overshadow base dragons. A True Dragon stands alongside an Ouroboros proudly. Unlock depth measures cost in lifetimes, never power.
- No RPS at the egg or morph level.
- Every Aspect has a price. The True Dragon is the generalist and gold standard. **Stalwart [Proposed]:** its old flat +9 Wounds is folded into its base 45. Its own zones never harm it, and each charging slot widens its released Breath by ½ pace: the master of the charged Breath. (A Breath that wound up 3 ticks sooner was tried and overshot.)
- **[Proposed]** Readability balances specialists: an Aspect telegraphs through the silhouette.
- **[Proposed]** Audit rule: an Aspect may change its holder's own actions or respond to generic attack types, never another morph's features.
- Balance watches pick rate against win rate across every choice. No Aspect should be an obvious best pick.

### Core Morphs
- **True Dragon:** four limbs plus wings. The generalist.
- **Wyvern:** forelimbs are wings; claws come from hind talons on dives. Owns altitude. **Talons:** the Wyvern bends the one-band move rule. A Claw scripted while aloft, against a grounded opponent anywhere within Far, is a stoop: it flies to the ground during the wind-up, lands at Melee, and swipes both left and right. Against an airborne opponent it simply claws. Its price is positional: it must get airborne first, and it lands in Bite range. **[Proposed]** A stoop hits harder the farther it falls: +1 per pace of altitude it starts from (+3 a band), like a charge paying for its setup. **[Proposed]** It must also have been aloft since the exchange began: no Leap and stoop in the same exchange. Its Claw reaches as any Claw does, from the ground or the air.
- **Wyrm:** serpentine and grounded. Owns lateral movement and close range. **[Proposed] Serpentine:** its Strafe tests Evasion with Dodge's bonus, against Breath too: a strafing Wyrm can slip a Breath that would otherwise skip Evasion. Its Leap is a hop that lands within the slot; it can't Dive.

### Extended Morphs (Aspects **[Proposed]** unless noted)
- **Chimera:** three heads; a native cruncher.
- **Manticore:** its breath is a physical spray of spines that slips Affinity and meets Hardness.
- **Hydra:** regrowing heads bend Wounds through regeneration.
- **Feathered Serpent:** a wyrm with flight; trades Hardness for Evasion.
- **Tarasque:** its shell guards two slots at once; pays with flight.
- **Drake:** wingless; burrows instead of flying.
- **Druk:** Bhutan's Thunder Dragon. Its Intimidate works out to Very Far and Rattles.
- **Lung:** rises without wings; its breath falls as lingering rain.
- **Yinglong:** the "Responding Dragon." When struck in slot 1, it may revise slot 2, at the cost of that exchange's slot-3 revision.
- **Vouivre:** its gem eye sees through obstacles, so its attacks ignore cover; when it Guards, it's Blinded next slot.
- **Zilant:** its Stomp works from the air as a diving slam; it lands Staggered.
- **Mordiford Wyvern:** a creature of habit. Its chains build from the second link; it can't revise slot 3 while chaining.
- **Cockatrice:** a wyvern with a rooster's head. Its breath becomes a gaze that deals no damage and Pins on a clean hit.
- **Gargouille:** guard turns it to stone: near-total Hardness, unable to act next slot.
- **Lindworm:** grappling forelegs turn claw hits into holds.
- **Zmey:** the Slavic fire serpent. Its breath leaves burning zones natively. **[Open]** Fire breath already leaves a burning zone (§3), so this Aspect needs a different bend, such as larger or longer-lasting zones.
- **Leviathan:** swallows whole. A landed Bite engulfs the target; if the target's next action is an attack, it lands from inside ignoring Hardness and bursts free, otherwise it takes 3 from digestion. Either way it's spat to a range band of the Leviathan's choosing.
- **Amphisbaena:** a head at each end; attacks while retreating.
- **Basilisk** (tier 3): the crowned serpent king. Gaze Pins; breath scorches and splits rock.
- **Tiamat, Jörmungandr, Ouroboros** (tier 3): see section 9.

---

## 3. Elements

**Core quartet:** each beats the next. Water erodes Earth; Earth smothers Fire; Fire consumes Air; Air scatters Water. Opposites (Water and Fire, Earth and Air) are neutral, deliberately: fire answers to smothering, and a fire with its own oxidizer burns underwater.

**Intermediates** blend adjacent cores: Salt (Water + Earth), Magma (Earth + Fire), Lightning (Fire + Air), Storm (Air + Water). They're rarer stones. Wheel order: Water, Salt, Earth, Magma, Fire, Lightning, Air, Storm.

**Matrix.** Matchups derive by scoring each pair of components (+1 if the attacker's beats the defender's, −1 if the reverse). Every advantage is ±3, with no double weakness or resistance.

| | Water | Salt | Earth | Magma | Fire | Lightning | Air | Storm |
|---|---|---|---|---|---|---|---|---|
| **Water** | · | ▲ | ▲ | ▲ | · | ▼ | ▼ | ▼ |
| **Salt** | ▼ | · | ▲ | ▲ | ▲ | · | ▼ | ▼ |
| **Earth** | ▼ | ▼ | · | ▲ | ▲ | ▲ | · | ▼ |
| **Magma** | ▼ | ▼ | ▼ | · | ▲ | ▲ | ▲ | · |
| **Fire** | · | ▼ | ▼ | ▼ | · | ▲ | ▲ | ▲ |
| **Lightning** | ▲ | · | ▼ | ▼ | ▼ | · | ▲ | ▲ |
| **Air** | ▲ | ▲ | · | ▼ | ▼ | ▼ | · | ▲ |
| **Storm** | ▲ | ▲ | ▲ | · | ▼ | ▼ | ▼ | · |

*Rows attack, columns defend.* On the wheel, every element beats the three clockwise of it, loses to the three counterclockwise, and is neutral with itself and its opposite.

**Breath.** Element sets breath shape, substance, and arena verb; morphs modify the shape only when they must, as with the Manticore's spines. No breathing solids. Breath effects grow at the wyrmling, adult, and venerable breakpoints.

| Element | Shape | Substance and verb |
|---|---|---|
| Water | Line | High-pressure jet; pushes the target back a band, slamming it into walls and obstacles (3); shoves boulders **[Proposed]** |
| Earth | Narrow cone | Acidic slurry; eats obstacles and corrodes the target. **[Proposed]** A corroded dragon takes +Potency ÷ 4 from every hit for Potency ÷ 6 slots (plus an exchange per charging slot), and each hit on it is an Acumen trigger |
| Fire | Ranged blast, ¾ pace radius **[Proposed]** | Flame; sets the world on fire. **[Proposed]** The ground burns in a lane along its line through Close and Far, as wide as the blast, so closing in means crossing it. A burn deals Potency ÷ 4 to grounded dragons at slot's end |
| Air | Ranged vortex **[Proposed]** | Vortex at the target, 1 pace across; pulls the target a band toward the breather (lowering, never grounding, a flier), while a vortex in the breather's own space throws Melee out to Close; disperses clouds |
| Salt | Line blooming into a cloud **[Proposed]** | Caustic gas; Blinds dragons inside |
| Magma | Narrow cone that pools **[Proposed]** | Molten spray; burns, then cools into a low ridge |
| Lightning | Forking blast **[Proposed]** | Instant arc; jumps through cover |
| Storm | Wide cone along a line **[Proposed]** | Wind and rain; shoves back and sideways at once |

**[Proposed]** Fire's burning lanes linger Potency ÷ 6 slots after the one they land in, plus an exchange per charging slot. Each dragon keeps at most two; the oldest goes out. Overlapping fires burn a dragon once a slot. **[Proposed]** The element wheel holds in every element contest and every burn: a target whose stone beats the breather's adds 3 to its Affinity against the verb, and a burn adds the matchup (±3) as the Breath does, so Earth smothers Fire and Fire consumes Air.

**[Proposed]** Optional depth: interacting surfaces in the style of Divinity: Original Sin 2.

**Assignment.** Secondary elements are worked for, never rolled. Fusion happens at hatching: two adjacent core stones produce their intermediate; opposites don't fuse. The player names a primary stone, whose scars survive, and the hatchery previews the result before confirming.

---

## 4. Combat

### Exchange and Scripting
- Each exchange has 3 action slots, scripted simultaneously. Slots 1 and 2 lock; slot 3 can be revised live while slots 1 and 2 resolve, once per exchange. A revision makes the slot flash on screen; the opponent sees that a revision happened, never what it was. Default: no change.
- **Unfilled slots** hold position when the clock runs out, so an idle dragon gets punished. **[Proposed]** Intimidate is the alternative default.
- Each action opens a menu of sub-actions and directions. A ghost preview shows the first few frames; confirm sends the set.
- Scripting clock: 30 seconds in PvP, unlimited in campaign.
- **[Proposed]** Directions are scripted relative to the orbit (clockwise or counterclockwise), so camera swings never flip inputs.
- **[Proposed]** Pacing: about 40 seconds per exchange; six to eight exchanges per fight, about four to five minutes.

**Readable information.** Slots 1 and 2 lock, so a wind-up inside a locked slot can't be answered; wind-ups matter for timing, not reading. What players can act on:
- **Between exchanges:** positions, cooldown rhythms, statuses, Acumen meters, silhouettes, the chest stone.
- **During the revision window:** slots 1 and 2 resolving, revision flashes, and a charge releasing in slot 3.

### Actions
| Category | Actions | Notes |
|---|---|---|
| Attack | Bite, Claw, Breath, Stomp | Shapes below |
| Move | Approach, Retreat, Strafe, Leap, Dive | Three degrees of freedom. **[Proposed] Gravity:** a flier that doesn't Leap during an exchange drops a band at its end. **Dive** comes down a band, or makes a **hard landing**: from two bands up or more, with Stomp ready, it comes all the way down and Stomps where it lands, spending Stomp's cooldown. |
| Guard | Dodge, Scales | Dodge avoids harm (Evasion); Scales presents the hide: +Hardness against Bite and Claw, +Affinity against Breath and its verbs. **[Proposed]** A Scales or Dodge slot held to the end also fills the Acumen meter. **Reversal:** a guard with a full Acumen meter turns an attack that lands, Breath included, back on its owner, against the owner's own hide, and empties the meter. Unlike Dragonseeds' always-on reflector, it costs a full meter and a read. **[Open]** Scales may be renamed. |
| Intimidate | Intimidate | +3 to the next attack; open for that action. **[Proposed]** One that reaches (within Far) also demoralizes: the target's next Bite or Claw loses 3. |

**Attack shapes**
- **Reach is in whole range bands;** widths and radii are paces, tuned by attributes.
- **Bite:** forward and narrow, through Close. High damage, piercing.
- **Claw:** an arc sweeping right-to-left or left-to-right, to Melee's edge and just into Close on either side, from the ground or the air. Short wind-up, long active window, short recovery: the natural strafe punish.
- **Breath:** a shaped area set by element. Skips Evasion. Reaches through Far. Cooldown 2. **At Melee a Breath is lost to any hit before it resolves,** a Bite or Claw trade included: Melee belongs to the body. A charged Breath's release can't be interrupted.
- **Stomp:** a ground quake through whole bands: Close at wyrmling, Far at adult, Far at venerable with Hardness ÷ 2. **[Proposed]** 3 + Hardness ÷ 3 true damage, and it shatters boulders inside its radius; Staggers. Cooldown 2. Modified by age only. Misses anything aloft. **[Proposed]** Hits burrowed dragons and forces them up; its long wind-up leaves it open to interruption. **[Proposed]** A Stomp that lands on a dragon mid-move Staggers it for two slots, and a Staggered dragon tests half its Evasion: Stomp is the answer to a dragon that won't stop moving.

### Space
- Combatants always face one another.
- **Four range bands,** relative to the combatants: Melee, Close, Far, Very Far. Each is a band of 3D space 3 paces deep.
- An action reaches at least its minimum distance within its band; modifiers extend reach to the band's outer edge, never beyond.
- **Three degrees of freedom:** advance or retreat along the line between dragons, strafe around the opponent, leap or fly. Altitude is ordinary movement.
- Obstacles restrict movement, and so does the opponent's body. Obstructions are physical: **[Proposed]** an attack shape stops where it meets an obstacle and damages it instead.
- **[Proposed]** Approach, Retreat, Leap and Dive carry exactly one band (3 paces), adjusted short or long by Evasion; Strafe carries Evasion × ⅓ pace. Bands are the range game; paces are hit geometry, which settles near misses (a lunge's extra pace can still reach into the next band). Where a dragon lands in a band matters only for that action: between slots, separation snaps to the nearest ½ pace.

**Threat map**
| Band | Bite | Claw | Breath | Stomp |
|---|---|---|---|---|
| Melee | ✓ | ✓ | ✓ | ✓ |
| Close | ✓ | arc edge | ✓ | |
| Far | | | ✓ | |
| Very Far | | | | |

- **Very Far is a disengagement zone.** Nothing reaches in or out except Jörmungandr. A distant dragon must close to Far to engage, risking Close and a bite.
- **Leash:** separation can't exceed Very Far's outer edge, in any direction including altitude and burrow depth. Kiting dies regardless of arena size.
- **Leash roar:** a retreat blocked by the leash becomes an impotent roar.
- **Intimidate range:** Intimidate takes effect only with the opponent within Far. Druk is the exception.
- **Blocked moves** default to a dodge rather than crashing. **[Proposed]** A converted dodge neither requires nor triggers Dodge's cooldown, and never triggers dodge techniques.
- **Claw timing:** direction and speed decide it. A fast claw catches the counter-strafe and misses the patient one.

### Timeline
- An action runs 30 ticks of 100 ms, split into wind-up, active, and recovery, each a whole number of ticks. Attributes, shards, and statuses shift wind-up and recovery; the active window absorbs the difference, so the action always totals 30. Faster wind-up or shorter recovery widens the active window; slower wind-up or longer recovery narrows it.
- **[Proposed]** The active window never drops below 3 ticks; shifts past that floor are lost.
- **[Proposed]** A crunch half runs 15 ticks: wind-up and recovery halve (rounding down), and the active window absorbs the rest.
- Identical attacks trade. An active window hitting the opponent's wind-up interrupts it; hitting their recovery is a punish, a guaranteed bonus scaled by Acumen.
- Fast attacks win when they connect; slow, wide attacks punish them when they whiff.
- **[Proposed] Base profiles** (wind-up / active / recovery ticks): Claw 6 / 15 / 9; Bite 12 / 6 / 12; Breath 12 / 9 / 9; Stomp 15 / 6 / 9.
- **Footsies:** at Melee a claw's active window opens inside a bite's wind-up, so claws interrupt bites up close; at Close only the claw's arc edge reaches, so bites win there. Claw wants Melee; Bite wants Close.
- **[Proposed]** Each action shows a three-band timeline bar when scripting.

**Resolution order [Proposed].** Everything within a tick resolves simultaneously: movement, hit detection, near-miss checks and accumulator updates for both dragons, damage and statuses together, then KO checks. Intimidate against Intimidate is a staredown where both gain the +3. Two advances stop at Melee and convert to dodges. A double KO goes to the challenged.

### Hits
- A dragon outside an attack's active area during its active window takes no hit.
- **Near misses** fall in a phantom band whose width Accuracy sets (⅓ pace per point, capped at the band edge). **[Proposed]** They fill the Acumen meter; the graze is retired.
- **Acumen meter:** visible to both players. **[Proposed]** Affinity fuels it, so Water dragons fill it best. It starts at age bracket × 10 + 3 × Affinity (wyrmling 1 through venerable 5; a wyrmling Wyrm + Water starts at 37). Each trigger adds Affinity + 9: a near miss, a Scales or Dodge slot held to the end, a Breath charging slot, a landed Breath (the breather's meter). Full at 100, the next landed Bite, Claw or Breath deals true damage, ignoring Hardness and Affinity (and so any verb contest), plus a steroid of Affinity ÷ 3, and drains it to 0. A miss spends nothing; a Stomp or a Technique's side-hit never spends it. Acumen itself still breaks ties. Deterministic and streak-free.

**Evasive resolution**
- **Strafe:** pure geometry. A dragon out of coverage is untouched; one still inside during the active window tests Evasion against Accuracy.
- **Dodge:** no invulnerability. Tests Evasion against Accuracy with a dodge bonus; Acumen tips close contests. Holds position.
- **Breath and Stomp ignore Evasion** inside their active area. Claw doesn't; it catches evasive dragons through timing and coverage.
- **[Proposed]** Tests are deterministic comparisons.
- Strafe is the hedge: clean escapes ignore attributes, and position carries forward. Dodge is the commitment: its bonus answers wide coverage, and it holds range and altitude.

### Damage [Proposed]
- **Bite:** Bite Force − Hardness. Bite is piercing: it ignores 3 Hardness. Baseline 9 − (3 − 3) = 9.
- **Claw:** one hit, Claw Sharpness − Hardness. Baseline 6 − 3 = 3; it earns its keep by landing often, its long active window catching strafes.
- **Breath:** Breath Potency − Affinity, ±3 for matchup. Baseline 12 − 6 = 6. **[Proposed]** Every Breath rose 3, and Affinity with it (it derives from Breath), so Breath damage nets out the same while every Affinity, and so every Acumen meter, gains.
- **Stomp:** 3 + Hardness ÷ 3 true damage (a Venerable's ÷ 2) plus Staggered.
- **Floor:** every landed hit deals at least 1 point.
- A True Dragon's 45 points fall to five landed bites or eight landed breaths.

**Modifiers:** Intimidate +3 to the next attack; +3 on a chain's third link; punish +3, raised by Acumen; graze −3. Crunched actions carry no modifier: the reward is doing the thing twice.

**Ceilings against a True Dragon (45 Wounds):** chained bites 30 (67%); crunched claws through Raking Talons 18 (40%); crunched bites through Gnashing Teeth 54, a full True Dragon in one perfect exchange. Crunch-granting shards carry those ceilings in their pips, restrictions, and recovery costs.

### Chains, Cooldowns, Crunch, Charge
- **Chains:** repeating an input 2 or 3 times improves efficacy. Each link counts only when it lands. Chains carry across exchanges: other actions in between don't break one, and a different attack starts a new one. A chain lapses only when a whole exchange passes without a landed hit. **[Proposed]** A revised slot 3 caps the bonus. **[Proposed]** Crunched slots don't count toward chains unless a shard says otherwise.
- **Cooldowns** replace stamina. Breath and Stomp default to 2; shards shift them. **[Proposed]** Dodge cooldown 1; cooldown actions can't chain. An action used in a slot returns N+1 slots later, so cooldown 2 locks to the same slot each exchange, a rhythm readable between exchanges.
- **Crunch:** an action done twice, or two actions, back to back in one slot, 15 ticks each. Crunching comes only from dragonshard builds, never innate to an action class; the Chimera's Aspect is the one morph exception. No cooldown debt: a cooldown action can't crunch with itself. Compounds are crunches of two different actions in order (approach then bite is a Pounce; bite then retreat is a hit-and-run). **[Proposed]** A crunch's first half winds up faster and gains priority, so crunch access stays gated; counterplay lives between halves.
- **Charge:** one action across two slots. A charge stays visible: readable during the revision window when it releases in slot 3, and between exchanges. Charging grants a defensive bonus mirroring the crunch's offense, a function of Scales. **[Proposed]** The charge slot counts as a Scales guard; an interrupt still cancels the charge.

**Collision triangle [Proposed]:** Guard beats Attack; Attack beats Intimidate; Intimidate beats Guard; Move wins no slot outright but gains position. Attack against Attack resolves by the timeline.

**Statuses:** Pinned (can't Move next slot); Staggered (Evasion halved next slot, for its move and its Evasion tests); Rattled (next wind-up +3 ticks); Blinded (Accuracy −3 next slot).

**Currencies** that Techniques trade: attributes, tempo, chain ceiling, coverage, exposure, priority, persistence, information, charge. Information carries the steepest price.

---

## 5. Arena
- Circular, with a radius equal to the leash (12 paces), roughly eight moves across.
- Four unbreakable pillars at the quadrants block strafes along the rim and form pockets that act as corners.
- Map-relevant obstacles and hazards are placed at random; **[Proposed]** seeded, so replays reproduce the map. Higher threat ratings mean more hazards.
- **Feature kinds:** movement blockers, forced movement, damage traps. Pits are leapt, or dropped into when too wide; boulders come in sizes to navigate around; atmospherics may limit height or knock dragons around. Environmental effects hit at the end of the exchange.
- Obstacles have 3, 6, or 9 Wounds by size. Overlapping hazards stack.
- Stomp affects terrain; a pit's ledge doesn't shield a grounded dragon.
- Starting distance: Far, just outside Bite range.
- **Late pressure:** at the end of each of the final three exchanges, the rim pillars pulse, dealing ⅓ of maximum Wounds to dragons on the outer rim. Pulse 1 can't kill (it leaves 1 point at worst); pulse 2 kills only a dragon pulse 1 already hit; pulse 3 kills any dragon in range.
- **Themes:** classic high fantasy, such as a verdant taiga in a mountain crater, each with a threat rating. **[Proposed]** Element themes add flavor and geometry, never a stat edge.

**Flow and camera**
- Animation follows YOMI Hustle: no neutral state; every action flows into the next. **[Proposed]** Exchange boundaries freeze mid-motion.
- Dragons always fight competently: every input should look cool and intentional.
- A dynamic action camera frames the fight; leaping over an opponent reorients it so player one stays left. Barriers turn transparent only when the camera would intersect one.
- Players can save replays. **[Proposed]** A replay is the two input logs re-simulated, which also serves spectating, async play, and verification.

---

## 6. The Dragonshard Array
- A radial array with the bloodstone at the nucleus and five valences, one per age category, holding 3, 5, 8, 11, and 14 pips (41 total). Every morph shares these counts.
- Each egg gives the array an overall shape, informed by its morph and modified by its stone. Patterns build on three core shapes, **Wheel** (True Dragon), **Wings** (Wyvern), and **Coil** (Wyrm); extended morphs modify their base shape.
- Seating locks.

**Shard shapes:** chips (one pip, or a compact cluster across adjacent valences), splinters (adjacent pips along one valence), and spikes (adjacent pips spanning valences). Very powerful shards may take compound shapes.

**Pip budget:** 1 pip per unit of value at Adult efficiency, 1 pip per perk. Grade sets points per pip: Wyrmling 1, Juvenile 2, Adult 3.

**Overlap:** a shard placed over another destroys the covered shard in those pips. A damaged shard loses perks first, then values; a shard with no pips left is destroyed. Overlap is the only way to replace a seated shard.

**Seams:** a seam connects two pips, and shards on seamed pips improve each other. Seams belong to pips, so whatever occupies a seamed pip gains the seam. Each morph has natural seams from egg and stone, varying slightly against the True Dragon baseline. **[Open]** Seam quality.

**Carving:** the tamer carves seams into the bloodstone, spending Ichor. Allowance: Juvenile 1, Adult 2, Elder 3, Venerable 4, up to ten in a life; wyrmlings can't bear carving. **[Proposed]** An unused allowance carries one age, then goes stale; Venerable's never stales. With up to five lineage seams, a fully realized stone holds fifteen player-chosen seams before the morph's natural ones. **[Proposed]** Seams index by valence and pip, which every morph shares, so stone-held seams map onto any egg.

**Ichor:** the blood in the bloodstone, spent to carve seams, the channels that carry elemental might. A resource in the spirit of Warframe's Endo. Sources: victories; melting shards down; **[Proposed]** overwritten pips; **[Proposed]** resting venerables.

**Hub effect:** inner pips gain seams at every age-up, making the core the natural home for heirlooms.

**[Proposed] Stone seam patterns:** Water Branch (forking hubs), Earth Bedrock (sparse, seals a gap), Fire Flare (short radial), Air Gyre (tangential), Salt Lattice (crystalline), Magma Fissure (deep radial lines), Lightning Bolt (valence-skipping), Storm Cyclone (forking spirals).

---

## 7. Dragonshards
Full details live in the companion suites.

| Family | Scaling | Rarity | Covers |
|---|---|---|---|
| Body | Magnitude | Common | Wounds, Evasion, Hardness, Accuracy |
| Bloodstone | Magnitude | Common | Claw Sharpness, Bite Force, Breath Potency, Affinity |
| Technique | Terms | Uncommon | How actions behave; every grade keeps a cost |
| Support | Reach | Uncommon | Inert alone; acts along seams |
| Trait | Commitment | Rare | Rule bends with a hard price |

- **Grades** borrow the age categories, Wyrmling through Venerable, and track the defeated dragon's age.
- **No element alignment.** A shard is exactly what it says. Points add directly: three +1 chips make one full unit.
- Acumen has no shards.

---

## 8. Progression

### Growth
Dragons don't age naturally; tamers force their growth through dragon magic.

| Age | Added pips | Total | Carving | Harvest reclaim |
|---|---|---|---|---|
| Wyrmling | 3 | 3 | 0 | No harvest |
| Juvenile | +5 | 8 | 1 | No harvest |
| Adult | +8 | 16 | 2 | 3 |
| Elder | +11 | 27 | 3 | 4 |
| Venerable | +14 | 41 | 4 | 5, then rest or ascension |

- Eligibility to grow: full valences. Every dragon passes through every age.
- Growth rates vary by morph and stone, with the True Dragon as baseline, and lean with elemental preference. **[Proposed]** Each age-up grants points equal to the new pips, weighted toward favored attributes; Wounds grows at double rate to keep time-to-kill near six hits.

### Spoils
- Shards are earned only in campaign and ranked. Dragons hatch with none.
- Every slain dragon drops two generated shards at its age grade, a Body shard of its morph's favored attribute and a Bloodstone shard of its stone's, plus any shards still intact in its array.
- The victor picks a number of shards equal to the slain dragon's age category: 1 from a wyrmling, 5 from a venerable.
- Campaign NPC dragons carry authored loadouts.
- Timeouts aren't lethal. **[Proposed]** A timeout awards no shard; unpicked shards are lost with the dragon.

### Harvest, Death, Scars
- Shards are permanent unless the dragon is harvested or slain.
- Harvest requires Adult or older and reclaims one shard per age category. It always returns the bloodstone.
- A slain dragon's stone returns scarred. Scars come from the killing blow, each +3 to an attribute: Claw scars Hardness, Bite scars Wounds, Breath scars Affinity. **[Proposed]** Stomp scars Evasion; environmental deaths leave no scar; one scar per attribute.
- Scars accrue only from deaths at Adult or older, and they show on the stone and the dragon.

### Lineage
- A bloodstone carries up to five memories, mixed between scars and lineage seams. When new memories would exceed five, the player chooses what to discard.
- Lineage seams are assigned as the dragon grows. **[Proposed]** Memory *k* binds to valence *k*.
- **[Proposed]** Eggs carry morph, array shape, and structural cosmetics.
- Fusion keeps the primary stone's scars and loses the secondary's.

### Retirement
- **Harvest** ends the dragon and returns its stone and reclaimed shards.
- **Rest** keeps a venerable alive; it lays eggs and **[Proposed]** yields Ichor.
- **Ascension** turns a qualifying venerable Wyrm into an Ouroboros (section 9).

**Economy loop:** low-grade chips fill a young core; larger shards overwrite them; victories, salvage, and melted shards become Ichor; Ichor carves seams.

---

## 9. Hatchery, Modes, Unlocks

### The Weir
- The dragon tamer's weir, kept stocked by immortal egg layers of each basic morph.
- A tamer with no dragon and no stone receives a starter egg and stone; with a stone but no dragon, an egg only. **[Proposed]** Unhatched eggs count too.
- Basic morphs: True Dragon, Wyvern, Wyrm. Basic stones: Water, Earth, Fire, Air. Everything else is earned.
- One dragon per bout. A tamer's total dragons are limited by their lair. Early play is one dragon at a time; more dragons come from resting venerables and lair growth.

### Tutorial
- The opening fight is a tutorial with no death.
- A skilled or lucky win earns a shiny, a cosmetic variant. **[Proposed]** It lives on the bloodstone and passes down the lineage.
- **[Proposed]** A homage to Dragonseeds' Count Awazanak: a wyrmling against an NPC tamer's elder running a readable pattern. Reads beat numbers.

### Modes
| Mode | Progression | Death | Rules |
|---|---|---|---|
| Open lobby | None | None | Player-set; any dragon; local hot-seat between save profiles |
| Ranked ladder | Shards | Permadeath | Locked track; age brackets |
| Campaign | Shards | Permadeath | Player-paced |

**Ranked tracks:** Entry (0 lineage, hatchlings with no shards), Intermediate (1–3 lineage), Advanced (4–5 lineage). A dragon joins as a wyrmling and stays in its track until slain. Ladder position is wins, losses, and a decaying MMR bound to the account; brackets bound the dragon, MMR measures the player. Ranked dragons may play campaign but gain no ladder position from it. **[Proposed]** Async ranked keeps thin brackets alive.

**Bouts:** single elimination: victory, death, or forfeit to the clock.
- **Timeouts:** in ranked and campaign, the challenger forfeits, non-lethally. The higher-MMR player is the champion in ranked; the player challenges in campaign. In open lobbies, timeout is a lobby option, defaulting to highest remaining Wounds.
- **[Proposed]** If champions kite in testing, a retreat penalty in the spirit of Guilty Gear's Negative Penalty.

**Collusion closure:** arranged deaths need a chosen opponent, and the only chosen fights are open lobbies, where nothing dies or transfers.

### Unlock Tree
A resting venerable lays an extended egg when its morph and stone match. Core stones unlock the first tier, intermediate stones (which require fusion) the second, extended morphs the third.

| Stone | True Dragon | Wyvern | Wyrm |
|---|---|---|---|
| Water | Tarasque | Vouivre | Hydra |
| Earth | Drake | Manticore | Lindworm |
| Fire | Chimera | Zilant | Zmey |
| Air | Yinglong | Mordiford Wyvern | Feathered Serpent |
| Salt | | Cockatrice | Leviathan |
| Magma | | | Amphisbaena |
| Lightning | Druk | | |
| Storm | Lung | Gargouille | |

Blank cells are plain sub-model variants. Zilant and Mordiford placements fill gaps and can swap.

**Tier 3 [Proposed recipes]:** Cockatrice + Magma → Basilisk; Chimera or Hydra + Salt → Tiamat; Lindworm + Salt → Jörmungandr.

**Tiamat:** carries two Aspects chosen from morphs its owner has unlocked; a wildcard is anything, Tiamat is many things. An unfillable choice draws from the Water and Salt morphs (Tarasque, Vouivre, Hydra, Cockatrice, Leviathan): the primordial waters of Apsu and Tiamat. **[Proposed]** The two Aspects bend different rules, both prices apply, and both lock at hatching; expect a ban list of specific pairs.

**Jörmungandr:** rings the arena, its head reaching in from above, striking at close and very long range; nowhere is safe. No claws. **[Proposed]** Its claw slot becomes the ring constricting along the rim; it can't Approach or Retreat.

**Ouroboros (ascension):** a venerable Wyrm with five lineage memories and all 41 pips filled may ascend. Ascension adds a seam series, not a ring: the rim seams back into the core, closing the loop. Aspect: a charge begun in slot 3 releases in the next slot 1, crunched with a fresh action. **[Proposed]** The wrapped charge is visible across the boundary; rebirth lets it egg itself, reclaiming five shards and re-choosing its loop seams on the way back up; rebirth starts a new ranked career.

---

## 10. Presentation and Tech [Proposed]
- **Platform:** PC and Linux, private build, local play first. Online play comes later.
- **Art direction:** hand-drawn watercolor, ink-blot, and ink-stamp. Brief artists and animators against that, not a Monster Hunter look.
- **[Open]** The clip-set approach below assumes 3D. Watercolor art may favor 2D cutout rigs or painted dragons in a 3D space; settle with the artists.
- **Resolve, then choreograph:** the outcome is known before animation starts.
- Authored clip sets per morph skeleton, adapted at runtime: motion warping steers attacks (Accuracy as warp tolerance), root-motion scaling carries moves (Evasion as distance and speed), IK handles footing and aim, blend spaces mix by speed and distance.
- Shards change proportions, surfaces, and attachments, never topology, which keeps animation authored rather than fully procedural.
- Precedent: For Honor's locked-on duels and motion matching.

---

## 11. Lore Direction
- Something Norse: dragons striving toward a final reward; tamers commanding them to fight, die, and be culled for lineage and shards.
- Tamers force growth through dragon magic.
- **[Proposed]** The leash as two facing bloodstones resonating, with tamers "hazeling the field" in the manner of the holmgang, where stepping off the marked ground counted as fleeing. The valkyries were the choosers of the slain; a tamer already stands in that role.

---

## 12. Vertical Slice
The testbed: the three core morphs, the four core elements, wyrmling through adult. The shard system can come later, depending on where the game most needs proving first. A dev manual for the slice is the next deliverable.

---

## 13. Open Threads

### Active
1. **Dev manual** for the vertical slice, then a browser mockup.
2. **Numbers pass:** confirm the base attack profiles; move, guard, and Intimidate profiles; growth weighting per morph and stone, breath verb values per breakpoint, Ichor rates for victories and melting.
3. **Feature catalog:** specific blockers, forced movement, and damage traps per theme.
4. **Arena roster:** themes and threat ratings.

### Later
- Valence patterns in detail; seam quality.
- Campaign structure: rest timing, rival hunts, the tutorial elder's pattern.
- Element depth: interacting surfaces.
- Roster: open grid cells; Tiamat's pair ban list; signature Traits and elemental preferences for the extended morphs.
- Region sectors as body regions on the array.
- Retreat penalty, if champions kite in testing.
- Array generation rules from egg and stone.
- Onboarding: age as tutorial, systems unlocking as the dragon grows.
- Lairs metagame at the weir.
- Lore: tamers, forced growth, the stones' bond, the final reward.

---

## 14. Reference Shelf
Dragonseeds, Monster Rancher, Dragonriders of Pern, Pokémon, Dragon Quest Monsters, Shin Megami Tensei, Persona (fusion previews), Injustice 2, Mouse Guard, Yomi, YOMI Hustle, For Honor, Street Fighter 6, Guilty Gear, BattleTech, Backpack Battles, FF7 (materia), FFX (Sphere Grid), Warframe (mods, Endo), Monster Hunter, Hollow Knight, Slay the Spire, Diablo, Divinity: Original Sin 2, Spore, D&D 5e, EVE Online, Boyd's energy-maneuverability theory, Elo and MMR matchmaking.

Mythic sources: Hesiod, Pliny, Lucan, Genesis, Job, Isaiah, the Enuma Elish, Norse myth and the sagas, European heraldry, and the folklore of Tarascon, Rouen, Kazan, Herefordshire, Bhutan, and China.

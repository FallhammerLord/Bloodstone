# Dragonshards: Full Index
*Every shard, one row each, for a manual refactor pass. Built from the suites at the repo root and the engine's in-force rules (`referee/src/shards.ts`, `referee/src/rules.ts`). Where the two differ, the engine column says what the ladder actually runs.*

**Count:** 20 Body, 20 Bloodstone, 20 Technique (1 cut), 6 Support, 19 Trait (12 general, 7 morph signatures).

**In the ladder today:** the 40 attribute shards and 19 Techniques. Support and Trait shards are design-only so far, since everything measured is wyrmling.

---

## Body · Common · magnitude
Grades: Wyrmling +1, Juvenile +2, Adult +3 (1 pip each); Elder +3 and a rider (2 pips); Venerable adds +1 of a related attribute. Chips stack.

| Attribute | Wyrmling | Juvenile | Adult | Elder (rider) | Venerable (+1 related) |
|---|---|---|---|---|---|
| Wounds | Heartgrit | Thickblood | Deep Keel | Ironheart (+3 Hardness at half Wounds or below) | Second Heart (+1 Hardness) |
| Evasion | Coiled Sinew | Spring Haunch | Swept Pinions | Galewing (+3 more while aloft) | Skyvane (+1 Accuracy) |
| Hardness | Pebblescale | Hornhide | Shalecoat | Bastion Plates (+3 more while guarding with Scales) | Mountainback (+1 Wounds) |
| Accuracy | Slit Pupil | Hunter's Eye | Nictitating Lens | Ranging Eyes (+3 more vs a different altitude) | Farseer Eyes (+1 Evasion) |

Generated drop: True Dragon Wounds, Wyvern and Drake Evasion, Wyrm Hardness.

## Bloodstone · Common · magnitude
Same grade ladder as Body.

| Attribute | Wyrmling | Juvenile | Adult | Elder (rider) | Venerable (+1 related) |
|---|---|---|---|---|---|
| Claw Sharpness | Whetted Nail | Hooked Talon | Razor Talons | Reaver Hooks (+3 more on a chain's final link) | Sundering Claws (+1 Affinity) |
| Bite Force | Milk Fang | Set Jaw | Crushing Molars | Vise Jaw (+3 more when crunched with a different action) | Sovereign Jaw (+1 Affinity) |
| Breath Potency | Smolder Sac | Bellows Lung | Furnace Gland | Cauldron Gullet (+3 more vs targets at Far) | Crucible Gland (+1 Affinity) |
| Affinity | Weathered Hide | Tempered Hide | Mantled Hide | Wardskin (+3 more vs elements that beat your stone) | Allward Mantle (+1 Breath Potency) |

Generated drop: Water Affinity, Earth Bite Force, Fire Breath Potency, Air Claw Sharpness.

---

## Technique · Uncommon · terms
1 pip unless noted; Elder and Venerable add 1 pip for the rider. One of each per dragon. The engine runs suite v0.3 (the locked parity pass); the suite doc still shows v0.2 text for most of these.

| Shard | Action | Suite text (effect · cost) | Engine variant in force |
|---|---|---|---|
| Snapping Jaw | Bite | Bite strikes 3/5 ticks sooner · recovery +3/+5, next slot winds up later by the debt, −3 damage | `borrow_dmg`: matches the doc's v0.3 text |
| Lockjaw | Bite | Landed Bite Pins · **[Open]** price | `clamp`: a jaw shut on a Pin can't Bite next slot; at Adult it may, but can't re-Pin |
| Gnashing Teeth | Bite | Bite crunches with itself · recovery +6 (+3 Adult); one crunch per exchange | as written |
| Hamstring Hooks | Claw | Landed Claw Staggers · Claw recovery +5 (+3 Adult) | as written |
| Scything Forelimbs | Claw | Claw arc +1 pace · Claw tests Accuracy at −3 | as written |
| Ratchet Claws | Claw | Each landed Claw link adds +1 to the next · final-link bonus −3 | `escalate`; also Claw recovery +3 |
| Raking Talons | Claw | Claw crunches with itself · recovery +6 (+3 Adult); one crunch per exchange | as written |
| Lance Throat · 2 pips | Breath | Line to Far's edge, pierces Affinity · strafes slip it | `pierce`: verbless line; Wyrmling pierces 3 at Far |
| Smoldering Maw | Breath | Area lingers: 3 points and the verb · initial hit −3 | `linger`: ground lasts longer; a groundless breath lays its verb as ground |
| Bellows Chest · 2 pips | Breath | Two-slot charge, +3/+6/double Potency · visible tell, interrupt burns it | `mobile`: the charge rides a Move (Retreat, then Strafe, then any) |
| Ash Gland | Breath | Landed Breath clings ash: Blinded, then a lasting cloud · full damage; Adult perk **[Open]** | `cloud`: matches the doc's v0.3 text |
| Stooping Pinions | Move | Dive from 3+ paces: +3 to an attack · next slot can't Leap | `nostack`: the +3 never adds to a stoop or hard landing |
| Sidewinder Spine | Move | Strafe also shifts along the line · strafe −1 pace | as written |
| Bounding Haunches | Move | Approach carries two bands · arrive with recovery +6 (+3 Adult) | as written |
| Thornscale | Guard | Attackers into Scales take 3 · Hardness −3 while guarding | `window`: the guard closes 3 ticks early (2 Adult) instead of losing Hardness |
| Riposte Talons | Guard | Successful dodge grants a 3-point claw · Dodge cooldown +1 | as written |
| Mantle Wings | Guard | +3 Affinity vs breath while guarding · Hardness −3 vs Bite and Claw | `verbguard`: Scales blocks the Breath's verb; −3 against Claw only |
| Sapping Bellow | Intimidate | Strips opponent's next chain bonus · no +3, you stay open | as written (`gland` variant has no text yet) |
| Goading Roar | Intimidate | Opponent retreating next slot takes 3 · no +3, you stay open | as written |
| Baleful Eye | Intimidate | Reveals opponent's slot 3 · no +3, you stay open | **cut** |

---

## Support · Uncommon · reach
Inert alone; acts along seams. Reach: Wyrmling 1 neighbor, Juvenile 2, Adult all seamed, Elder +1 hop, Venerable adds the rider.

| Shard | Verb | Effect on seamed shards | Venerable rider |
|---|---|---|---|
| Marrow Knot | Amplify | Body and Bloodstone count one grade higher | Wyrmling-grade shards count as Adult |
| Gizzard Stone | Hone | Techniques count one grade higher | Techniques use Adult terms at minimum |
| Tendon Weave | Catalyze | Two Techniques of different supertypes may compound (Juvenile+) | A compound counts as one chain link |
| Rootbone | Anchor | Can't be overwritten | Also shielded from the victor's picks |
| Bloodstone Artery | Infuse | Bite and Claw Techniques test Affinity and carry matchups | Infused hits apply the stone's breath verb |
| Ganglion | Quicken | Techniques wind up 2 ticks earlier | Also recover 2 ticks faster |

---

## Trait · Rare · commitment
Elder and Venerable only; 2 pips (Twin-Blooded 3). Venerable lightens the price.

| Shard | Group | Bend | Elder price | Venerable price |
|---|---|---|---|---|
| Unrelenting | Combat | Chains never break on Guard | Can't Dodge; blocked moves brace | Dodge cooldown +2 |
| Bloodrage | Combat | Below half Wounds, attacks +3 | Can't Guard below half | Can't use Scales below half |
| Cold Reader | Information | Revision may target slot 2 | Revised slot 2 winds up +3 ticks | Only when revising into an attack |
| Iron Will | Information | Unrevised chain-completing slot 3 gets +3 | Can't revise | May revise, forfeiting the bonus |
| Patient Hunter | Timing | Punishes +3 | Attacks never interrupt | Interrupts cancel but deal 0 |
| Hair Trigger | Timing | All wind-ups −3 ticks | All recoveries +5 | All recoveries +3 |
| Stoic | Status | Immune to Rattled and Pinned | Can't Intimidate | Intimidate once per bout |
| Dread Presence | Status | Intimidate also Rattles | Punishes vs your Intimidate +3 | Normal punish damage |
| Bloodline | Lineage | Heirlooms seat one grade higher | Reclaim one fewer on harvest | Waived at Venerable harvest |
| Hoardheart | Economy | One extra pick from your kills | Your killer picks one extra | Their extra pick comes from generated drops |
| Moltborn | Economy | Overwritten pips salvage double Ichor | Your shards can't be Anchored | Only covered shards lose Anchor |
| Twin-Blooded · 3 pips | Elemental | Breath may use a second element | Affinity −3 vs anything beating either | Only vs what beats the second |
| Sovereign Bearing | True Dragon | Bite and Claw alternate within a chain | Final-link bonus −3 | Only on mixed chains |
| Gallowsbarb | Wyvern | Dive attacks: target −3 Hardness next exchange | Hardness −3 while grounded | Only on the landing slot |
| Crushing Coils | Wyrm | Landed Bite Pins and holds | You're Pinned while holding | May Bite again while holding |
| Three Minds | Chimera | Triple crunch, 10 ticks each | Recovery +6 after | Recovery +3 |
| Spine Volley | Manticore | Spine breath Staggers | Breath cooldown +1 | Lifts when the volley lands |
| Regrowth | Hydra | Regain 3 after an undamaged exchange | Max Wounds −3 | Also after a graze-only exchange |
| Sky Coil | Feathered Serpent | Aloft: Evasion +3, strafes shift altitude | Hardness −3 aloft | Only above 6 paces |

**[Open]** No signature Trait yet for the Drake (Ravener) or the other newer morphs.

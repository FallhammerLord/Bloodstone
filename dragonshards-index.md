# Dragonshards: Full Index
*Every shard, one row each, for a manual refactor pass. Built from the suites at the repo root and the engine's in-force rules (`referee/src/shards.ts`, `referee/src/rules.ts`). Where the two differ, the engine column says what the ladder actually runs.*

**Suite v0.4** (2026-10-07). **Count:** 20 Body, 20 Bloodstone, 21 Technique, 6 Support, 19 Trait (12 general, 7 morph signatures).

**In the ladder today:** the 40 attribute shards and all 21 Techniques. Support and Trait shards are design-only so far, since everything measured is wyrmling.

---

## Body · Common · magnitude
Grades (v0.4): Wyrmling +2, Juvenile +3, Adult +4 (1 pip each); Elder +4 and a +3 rider (2 pips); Venerable adds +1 of a related attribute. Chips stack.

| Attribute | Wyrmling | Juvenile | Adult | Elder (rider) | Venerable (+1 related) |
|---|---|---|---|---|---|
| Wounds | Heartgrit | Thickblood | Deep Keel | Ironheart (+3 Scales at half Wounds or below) | Second Heart (+1 Scales) |
| Evasion | Coiled Sinew | Spring Haunch | Swept Pinions | Galewing (+3 more while aloft) | Skyvane (+1 Accuracy) |
| Scales | Pebblescale | Hornhide | Shalecoat | Bastion Plates (+3 more while Guarding) | Mountainback (+1 Wounds) |
| Accuracy | Slit Pupil | Hunter's Eye | Nictitating Lens | Ranging Eyes (+3 more vs a different altitude) | Farseer Eyes (+1 Evasion) |

Generated drop: True Dragon Wounds, Wyvern and Drake Evasion, Wyrm Scales.

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
1 pip unless noted; Elder and Venerable add 1 pip for the rider. One of each per dragon. **Free** marks the v0.4 Techniques whose only price is the pip.

| Shard | Action | Effect | Cost |
|---|---|---|---|
| Snapping Jaw | Bite | Bite strikes 3/5 ticks sooner | Recovery +3/+5; next slot winds up later by the debt; −3 damage |
| Lockjaw | Bite | Landed Bite Pins | Jaw clamps: no Bite next slot (Adult: that Bite can't Pin) |
| Gnashing Teeth | Bite | Bite crunches with itself | Recovery +6 after the pair (+3 Adult); one crunch per exchange |
| Elemental Jaws *(new)* | Bite | Bite + Affinity ÷ 3; a landed Bite readies Breath | Breath cooldown +1 |
| Hamstring Hooks | Claw | Landed Claw Staggers | Claw recovery +5 (+3 Adult) |
| Scything Forelimbs | Claw | Claw arc +1 pace | Claw tests Accuracy at −3 |
| Ratchet Claws | Claw | Each landed Claw link adds +1 to the next | Claw recovery +3 |
| Raking Talons | Claw | Claw crunches with itself | Recovery +6 after the pair (+3 Adult); one crunch per exchange |
| Lance Throat · 2 pips | Breath | Verbless line to Far's edge; pierces 3 Affinity at every grade | Strafes slip it easily |
| Smoldering Maw | Breath | Breath's ground lingers; a groundless breath lays its verb as ground | Initial hit −3 |
| Bellows Chest · 2 pips | Breath | Two-slot charge, +3/+6/double Potency, carried on a Move | Visible tell; interrupt burns it |
| Ashbreath *(was Ash Gland)* | Breath | Landed Breath Blinds for Affinity ÷ 3 slots, full damage | **Free** |
| Stooping Pinions | Move | Dive from 3+ paces: +3 to an attack | Next slot can't Leap; never stacks with a stoop |
| Sidewinder Spine | Move | Strafe also shifts along the line | Strafe −1 pace |
| Bounding Haunches | Move | Approach carries two bands | Arrive with recovery +6 (+3 Adult) |
| Thornscale | Defend (Guard) | Claw or Bite into a Guard takes 3 | **Free** |
| Riposte Talons | Defend (Dodge) | Successful dodge grants a 3-point claw | Dodge cooldown +1 |
| Elemental Mantle *(was Mantle Wings)* | Defend (Guard) | +3 Affinity against Breath while Guarding | **Free** |
| Sapping Bellow | Intimidate | Resets the opponent's chain | **Free** (keeps the +3); you stay open |
| Baleful Eye *(back)* | Intimidate | Reveals the opponent's slot 3 | **Free** (keeps the +3); you stay open |
| Goading Roar | Intimidate | Opponent retreating next slot takes 3 | **Free** (keeps the +3); you stay open |

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
| Unrelenting | Combat | Chains never break on Defend | Can't Dodge; blocked moves become a Guard | Dodge cooldown +2 |
| Bloodrage | Combat | Below half Wounds, attacks +3 | Can't Defend below half | Can't Guard below half |
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
| Gallowsbarb | Wyvern | Dive attacks: target −3 Scales next exchange | Scales −3 while grounded | Only on the landing slot |
| Crushing Coils | Wyrm | Landed Bite Pins and holds | You're Pinned while holding | May Bite again while holding |
| Three Minds | Chimera | Triple crunch, 10 ticks each | Recovery +6 after | Recovery +3 |
| Spine Volley | Manticore | Spine breath Staggers | Breath cooldown +1 | Lifts when the volley lands |
| Regrowth | Hydra | Regain 3 after an undamaged exchange | Max Wounds −3 | Also after a graze-only exchange |
| Sky Coil | Feathered Serpent | Aloft: Evasion +3, strafes shift altitude | Scales −3 aloft | Only above 6 paces |

**[Open]** No signature Trait yet for the Drake (Ravener) or the other newer morphs.

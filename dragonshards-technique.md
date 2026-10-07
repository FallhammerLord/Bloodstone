# Dragonshards: Technique Suite v0.4
Technique shards change how an action behaves. Most Techniques are sidegrades: each grade keeps a cost. **[Proposed] Suite v0.4** frees four: Thornscale, Elemental Mantle and Ashbreath carry no drawback, and the Intimidate Techniques keep the Intimidate's +3. Their pip is their price. `--rule SUITE_V03=on` restores suite v0.3.

## Rules

**No duplicates:** a dragon seats at most one of each Technique. (Attribute shards stack; Techniques don't.)

**Grade ladder**
- **Wyrmling:** narrow trigger, full cost.
- **Juvenile:** full effect, full cost.
- **Adult:** better terms (lighter cost or broader effect).
- **Elder:** as Adult, plus a rider.
- **Venerable:** as Elder, plus a wider rider.

**Pips [Settled budget]:** a Technique occupies its base pips (a 1-pip chip unless noted) from Wyrmling through Adult. The rider is a perk, so Elder and Venerable add 1 pip, becoming a splinter or spike.

**Overlap:** a covered pip strips the rider first, then the effect. A shard with no pips left is destroyed. **[Proposed]** Each covered pip salvages into Ichor.

**Seams [Proposed placeholder]:** each seam touching a Technique shard trims 1 tick from one of its timing costs.

**Units:** 3 points make one unit. A slot is 30 ticks of 100 ms. A band is 3 paces.

**Timing:** an action always totals 30 ticks. Wind-up and recovery shifts move the active window's edges: −3 wind-up and +5 recovery opens the window 3 ticks earlier and closes it 5 ticks earlier. **[Proposed]** The active window never drops below 3 ticks.

**Statuses**
- **Pinned:** can't Move next slot.
- **Staggered:** Evasion distance halved next slot.
- **Rattled:** next wind-up +3 ticks.
- **Blinded:** Accuracy −3 points next slot.

**Constants**
- No element alignment on shards.
- Breath keeps its cooldown floor of 2 and its reach limit of Far.
- Reach extends only to its band's outer edge.
- Crunching comes only from shards (and the Chimera's Aspect). Crunches carry no cooldown debt and no damage modifier; the price lives in the granting shard.
- Claw is a single hit with a short wind-up, long active window, and short recovery: the natural strafe punish.
- Intimidate takes effect only within Far. **[Proposed, v0.4]** Intimidate Techniques keep the Intimidate's +3. At Adult, punishes against you deal 3 less.
- Converted dodges (from blocked moves) never trigger dodge techniques.

---

## Bite

### Snapping Jaw · Timing
**[Proposed, suite v0.3]** Bite strikes earlier, borrowing the time: its active window comes sooner and keeps its length, recovery runs that much longer, and your next slot's action (unless it Holds) winds up later by the debt. A snapped Bite deals 3 less.
- **Wyrmling:** the Bite strikes 3 ticks sooner; recovery +3; debt 3
- **Juvenile:** 5 ticks sooner; recovery +5; debt 5
- **Adult:** 5 ticks sooner; recovery +5; debt 3
- **Elder:** as Adult; the Bite deals full damage, and a Bite that interrupts deals +3
- **Venerable:** as Elder; an interrupted Breath still triggers its cooldown

*Suite v0.2:* wind-up −3 / −5 / −5 ticks, recovery +5 / +5 / +3, no debt and no damage cost.

### Lockjaw · Control
A landed Bite Pins the target. **[Open]** Its price: the forced follow-up Bite was cut because it looped (each landed Bite re-locked the next slot). Lockjaw needs a new cost, such as Bite recovery +5 ticks (+3 from Adult), mirroring Hamstring Hooks.
- **Wyrmling:** triggers only on a chain's final link
- **Juvenile:** any landed Bite
- **Adult:** better terms once a price is set
- **Elder:** as Adult; the Pinned target tests Evasion at −3
- **Venerable:** as Elder; a Bite next slot gains +3

### Gnashing Teeth · Crunch
Bite can crunch with itself: two bites in one slot. Recovery after a crunched pair +6 ticks. **[Proposed]** One crunch per exchange; a crunch never lunges, pounces or stoops.
- **Wyrmling:** only after a landed Bite in the previous slot
- **Juvenile:** in any slot
- **Adult:** recovery +3 ticks
- **Elder:** as Adult; the second bite pierces 3 Scales
- **Venerable:** as Elder; if both land, the target is Rattled

### Elemental Jaws · Damage
**[Proposed, suite v0.4]** The Bite carries the stone. A Bite deals + Affinity ÷ 3, and a landed Bite readies your Breath for the next slot. Breath's cooldown runs one action longer.
- **All grades:** as written. **[Open]** a grade ladder.

---

## Claw

### Hamstring Hooks · Control
A landed Claw Staggers the target. Claw recovery +5 ticks.
- **Wyrmling:** triggers only on a chain's final link
- **Juvenile:** any landed Claw
- **Adult:** recovery +3 ticks
- **Elder:** as Adult; the target's next move also completes 3 ticks later
- **Venerable:** as Elder; a Staggered target can't Leap

### Scything Forelimbs · Coverage
The claw arc widens by 1 pace, catching strafes. Claw tests Accuracy at −3.
- **Wyrmling:** widens to one side, chosen when scripting
- **Juvenile:** widens both sides
- **Adult:** the Accuracy penalty applies only to the first claw of a crunch or chain
- **Elder:** as Adult; caught strafers test Evasion at −3
- **Venerable:** as Elder; the arc also reaches 1 pace higher

### Ratchet Claws · Chain
**[Proposed, suite v0.4]** Each landed Claw link adds +1 to the next Claw. Claw recovery +3 ticks. A different attack, or a chain that lapses, drops the ratchet.
- **Wyrmling:** the ratchet climbs to +3
- **Juvenile:** the ratchet climbs to +6
- **Adult:** the recovery cost applies only to an unratcheted Claw
- **Elder:** as Adult; the ratcheting chain holds through one hitless exchange
- **Venerable:** as Elder; a Claw ratcheted to +3 or more pierces 3 Scales

### Raking Talons · Crunch
Claw can crunch with itself: two claws in one slot. Recovery after a crunched pair +6 ticks. **[Proposed]** One crunch per exchange; a crunch never lunges, pounces or stoops.
- **Wyrmling:** only after a landed Claw in the previous slot
- **Juvenile:** in any slot
- **Adult:** recovery +3 ticks
- **Elder:** as Adult; the two claws may sweep in opposite directions
- **Venerable:** as Elder; a crunched pair counts as one link toward a chain

---

## Breath

### Lance Throat · Coverage · 2 pips
Breath narrows to a verbless line and reaches Far's outer edge. **[Proposed, v0.4]** It pierces 3 Affinity at every grade and range. Strafes slip it easily.
- **Wyrmling:** line, reach and the pierce
- **Juvenile:** as Wyrmling
- **Adult:** punches through one obstacle
- **Elder:** as Adult; the line widens slightly at its end
- **Venerable:** as Elder; pierces 6 Affinity at Far

### Smoldering Maw · Persistence
Breath's area lingers through the next slot; any dragon inside at slot's end takes 3 points and the element's verb. Initial hit −3.
- **Wyrmling:** lingers at the area's center only
- **Juvenile:** the full area lingers
- **Adult:** lingers two slots
- **Elder:** as Adult; the lingering area damages obstacles
- **Venerable:** as Elder; overlapping lingering areas stack

### Bellows Chest · Charge · 2 pips
Breath charges across two slots, with the charge slot's Guard defense. The charge shows a visible tell; an interrupt burns the breath and triggers its cooldown.
- **Wyrmling:** +3 Potency
- **Juvenile:** +6 Potency
- **Adult:** double Potency
- **Elder:** as Adult; the breath's area grows one step
- **Venerable:** as Elder; you may Move during the charge slot

### Ashbreath · Information
*Was Ash Gland.* **[Proposed, suite v0.4]** A landed Breath deals full damage and Blinds the target (Accuracy −3) for the breather's Affinity ÷ 3 slots, at least 1. No drawback.
- **All grades:** as written. **[Open]** a grade ladder.

*Suite v0.3 (the cloud):* the ash clung to the target, Blinding it through the exchange, then fell as a cloud that Blinded whoever ended a slot inside. `--rule TECH_ASH_GLAND=cloud`.
*Suite v0.2 (pulled):* Breath dealt no damage and locked the opponent's slot-3 revision next exchange.

---

## Move

### Stooping Pinions · Dive
A dive starting at least 3 paces up adds +3 to an attack in the same or next slot. Next slot can't Leap.
- **Wyrmling:** requires 6 paces up
- **Juvenile:** requires 3 paces up
- **Adult:** the Leap lockout lifts if the boosted attack lands
- **Elder:** as Adult; the dive completes 3 ticks earlier
- **Venerable:** as Elder; the +3 applies to both halves of a crunch

### Sidewinder Spine · Strafe
Strafe can also shift up to 1 pace along the line between dragons. Strafe distance −1 pace.
- **Wyrmling:** shifts away only
- **Juvenile:** shifts toward or away
- **Adult:** shifts up to 2 paces; the distance penalty applies only to shifting strafes
- **Elder:** as Adult; a strafe that escapes geometry speeds your next wind-up by 3 ticks
- **Venerable:** as Elder; chained Sidewinders test Evasion at +3

### Bounding Haunches · Approach
Approach can carry up to two bands. You arrive with recovery +6 ticks.
- **Wyrmling:** only from Far or beyond
- **Juvenile:** from any range
- **Adult:** recovery +3 ticks
- **Elder:** as Adult; a Bite or Claw next slot winds up 3 ticks faster
- **Venerable:** as Elder; you may crunch Approach into Bite (Pounce) without Tendon Weave

---

## Defend

### Thornscale · Guard
**[Proposed, suite v0.4]** Attackers landing a Claw or Bite into a Guard take 3 points. The Guard is unaffected: no Scales penalty, no shortened window.
- **Wyrmling:** the first attacker into each Guard
- **Juvenile:** every Claw or Bite into the Guard
- **Adult:** as Juvenile **[Open]**: its old perk lightened a cost that's gone
- **Elder:** as Adult; a Guard reversal also deals the thorns
- **Venerable:** as Elder; struck attackers are Rattled

### Riposte Talons · Dodge
A successful dodge grants a free claw for 3 points. Dodge cooldown +1.
- **Wyrmling:** only against Bite
- **Juvenile:** against any attack
- **Adult:** the cooldown penalty applies only after a failed dodge
- **Elder:** as Adult; the riposte counts as a punish, scaled by Acumen
- **Venerable:** as Elder; the riposte uses your full Claw Sharpness

### Elemental Mantle · Guard vs Breath
*Was Mantle Wings.* **[Proposed, suite v0.4]** Guarding grants +3 more Affinity against Breath, on top of the Guard's own +3. No tradeoff.
- **Wyrmling:** only against Breath at Melee or Close
- **Juvenile:** at any range
- **Adult:** as Juvenile **[Open]**: its old perk lightened a cost that's gone
- **Elder:** as Adult; your Guard blocks lingering areas
- **Venerable:** as Elder **[Open]**

---

## Intimidate

### Sapping Bellow · Debuff
**[Proposed, suite v0.4]** Intimidate resets the opponent's chain. The Intimidate's +3 holds; you remain open.
- **Wyrmling:** Claw chains only
- **Juvenile:** any chain
- **Adult:** punishes against you deal 3 less
- **Elder:** as Adult; also strips their pending Intimidate +3
- **Venerable:** as Elder; the target is Rattled

### Baleful Eye · Information
**[Proposed, suite v0.4]** Back in the pool (cut in parity pass 1). Intimidating in slot 1 or 2 reveals the opponent's scripted slot 3 during the revision window. The Intimidate's +3 holds; you remain open.
- **Wyrmling:** reveals only whether it's an attack
- **Juvenile:** reveals its category
- **Adult:** punishes against you deal 3 less
- **Elder:** as Adult; reveals the specific action
- **Venerable:** as Elder; also reveals its direction (strafe side or claw sweep)

### Goading Roar · Anti-turtle
If the opponent scripts a Retreat next slot, it takes 3 points, even when the leash converts that Retreat into a roar. **[Proposed, v0.4]** The Intimidate's +3 holds; you remain open.
- **Wyrmling:** only at Close or nearer
- **Juvenile:** anywhere within Far
- **Adult:** punishes against you deal 3 less
- **Elder:** as Adult; also triggers on Dodge
- **Venerable:** as Elder; goaded targets are Rattled

---

## Refactor Notes
- **v0.4:** attribute renames (Hardness is Scales; the Scales guard is Guard, under Defend); Thornscale, Elemental Mantle and Ashbreath freed; Lance Throat pierces at every grade; Sapping Bellow resets chains; Intimidate Techniques keep the +3; Baleful Eye returns; Elemental Jaws added.
- Cooldown debt removed; Gnashing Teeth now pays in recovery ticks.
- Timing in ticks; distances in paces; values in points.
- Lance Throat respects Breath's Far limit; Smoldering Maw carries each element's verb rather than fire alone; Ash Gland no longer hides revisions, which always flash.
- Baleful Eye's Venerable rider now reveals direction, since revisions are visible anyway.
- Bellows Chest inherits the base charge defense.

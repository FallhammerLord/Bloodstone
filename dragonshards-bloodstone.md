# Dragonshards: Bloodstone Suite v0.2
Bloodstone shards buff what the stone sets: Claw Sharpness, Bite Force, Breath Potency, and Affinity (derived from Breath − Scales at hatching; a chip adds to it directly). Common.

## Rules

**Grades [Settled]** (3 points make one unit)
| Grade | Shape | Pips | Effect |
|---|---|---|---|
| Wyrmling | Chip | 1 | +2 points |
| Juvenile | Chip | 1 | +3 points |
| Adult | Chip | 1 | +4 points |
| Elder | Splinter or spike | 2 | +4 points, plus a conditional rider (+3 under its condition) |
| Venerable | Splinter or spike | 2 | +4 points, the rider, plus 1 point of a related attribute |

**[Proposed] Suite v0.4:** every grade's base points rose by 1 (was +1, +2, +3, +3, +3). Riders and related points are unchanged. `--rule SUITE_V03=on` restores the old points.

**Pip budget [Open]:** was 1 pip per unit of value at Adult efficiency, 1 pip per perk. Under v0.4 an Adult chip carries +4 for 1 pip, so the budget needs restating. Lower grades still buy fewer points per pip.

**Points add directly, and chips stack.** Three Wyrmling chips, the same or different, make +6 points, two full units.

**Overlap [Settled]:** a covered pip strips perks first (the rider, then the related point), then attribute points. A shard with no pips left is destroyed. **[Proposed]** Each covered pip salvages into Ichor.

**Seams [Proposed placeholder]:** each seam touching the shard grants it +1 point.

**No alignment [Settled]:** shards carry no element. A shard is exactly what it says.

**Generated drop [Proposed]:** a slain dragon adds one Bloodstone shard of its stone's favored attribute to the pick pool, at its age grade: Water Affinity, Earth Bite Force, Fire Breath Potency, Air Claw Sharpness.

---

## Claw Sharpness · Claws
- **Whetted Nail** · Wyrmling · chip, 1 pip · +2 Claw Sharpness
- **Hooked Talon** · Juvenile · chip, 1 pip · +3 Claw Sharpness
- **Razor Talons** · Adult · chip, 1 pip · +4 Claw Sharpness
- **Reaver Hooks** · Elder · 2 pips · +4 Claw Sharpness; rider: +3 more on a chain's final link
- **Sundering Claws** · Venerable · 2 pips · +4 Claw Sharpness; rider: +3 more on a chain's final link; +1 Affinity

## Bite Force · Jaw
- **Milk Fang** · Wyrmling · chip, 1 pip · +2 Bite Force
- **Set Jaw** · Juvenile · chip, 1 pip · +3 Bite Force
- **Crushing Molars** · Adult · chip, 1 pip · +4 Bite Force
- **Vise Jaw** · Elder · 2 pips · +4 Bite Force; rider: +3 more when crunched with a different action
- **Sovereign Jaw** · Venerable · 2 pips · +4 Bite Force; rider: +3 more when crunched with a different action; +1 Affinity

## Breath Potency · Gland
- **Smolder Sac** · Wyrmling · chip, 1 pip · +2 Breath Potency
- **Bellows Lung** · Juvenile · chip, 1 pip · +3 Breath Potency
- **Furnace Gland** · Adult · chip, 1 pip · +4 Breath Potency
- **Cauldron Gullet** · Elder · 2 pips · +4 Breath Potency; rider: +3 more against targets at Far
- **Crucible Gland** · Venerable · 2 pips · +4 Breath Potency; rider: +3 more against targets at Far; +1 Affinity

## Affinity · Hide
- **Weathered Hide** · Wyrmling · chip, 1 pip · +2 Affinity
- **Tempered Hide** · Juvenile · chip, 1 pip · +3 Affinity
- **Mantled Hide** · Adult · chip, 1 pip · +4 Affinity
- **Wardskin** · Elder · 2 pips · +4 Affinity; rider: +3 more against elements that beat your stone
- **Allward Mantle** · Venerable · 2 pips · +4 Affinity; rider: +3 more against elements that beat your stone; +1 Breath Potency

---

## Generator Pattern
New shards come from three choices: attribute, Elder condition, Venerable related attribute.

| Attribute | Condition | Related |
|---|---|---|
| Claw Sharpness | on a chain's final link | Affinity |
| Bite Force | when crunched with a different action | Affinity |
| Breath Potency | against targets at Far | Affinity |
| Affinity | against elements that beat your stone | Breath Potency |

Venerable bonus points never feed Claw Sharpness or Bite Force; late spillover flows into Affinity.

# Dragonshards: Body Suite v0.4
Body shards buff what the egg sets: Wounds, Evasion, Scales, and Accuracy (derived from Claw − Evasion at hatching; a chip adds to it directly). Common.

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

**Generated drop [Proposed]:** a slain dragon adds one Body shard of its morph's favored attribute to the pick pool, at its age grade: True Dragon Wounds, Wyvern Evasion, Wyrm Scales.

---

## Wounds · Heart
- **Heartgrit** · Wyrmling · chip, 1 pip · +2 Wounds
- **Thickblood** · Juvenile · chip, 1 pip · +3 Wounds
- **Deep Keel** · Adult · chip, 1 pip · +4 Wounds
- **Ironheart** · Elder · 2 pips · +4 Wounds; rider: +3 Scales at half Wounds or below
- **Second Heart** · Venerable · 2 pips · +4 Wounds; rider: +3 Scales at half Wounds or below; +1 Scales

## Evasion · Wings and Haunches
- **Coiled Sinew** · Wyrmling · chip, 1 pip · +2 Evasion (was Hollow Bones; dropped by the Wyvern and the Drake)
- **Spring Haunch** · Juvenile · chip, 1 pip · +3 Evasion
- **Swept Pinions** · Adult · chip, 1 pip · +4 Evasion
- **Galewing** · Elder · 2 pips · +4 Evasion; rider: +3 more while aloft
- **Skyvane** · Venerable · 2 pips · +4 Evasion; rider: +3 more while aloft; +1 Accuracy

## Scales · Scales
- **Pebblescale** · Wyrmling · chip, 1 pip · +2 Scales
- **Hornhide** · Juvenile · chip, 1 pip · +3 Scales
- **Shalecoat** · Adult · chip, 1 pip · +4 Scales
- **Bastion Plates** · Elder · 2 pips · +4 Scales; rider: +3 more while Guarding
- **Mountainback** · Venerable · 2 pips · +4 Scales; rider: +3 more while Guarding; +1 Wounds

## Accuracy · Eyes
- **Slit Pupil** · Wyrmling · chip, 1 pip · +2 Accuracy
- **Hunter's Eye** · Juvenile · chip, 1 pip · +3 Accuracy
- **Nictitating Lens** · Adult · chip, 1 pip · +4 Accuracy
- **Ranging Eyes** · Elder · 2 pips · +4 Accuracy; rider: +3 more against a target at a different altitude
- **Farseer Eyes** · Venerable · 2 pips · +4 Accuracy; rider: +3 more against a target at a different altitude; +1 Evasion

---

## Generator Pattern
New shards come from three choices: attribute, Elder condition, Venerable related attribute.

| Attribute | Condition | Related |
|---|---|---|
| Wounds | at half Wounds or below (grants Scales) | Scales |
| Evasion | while aloft | Accuracy |
| Scales | while Guarding | Wounds |
| Accuracy | against a target at a different altitude | Evasion |

Acumen has no shards: it grows only through play, and its meter is visible to both players.

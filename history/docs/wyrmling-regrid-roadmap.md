# Wyrmling Regrid Roadmap

*Plan for the next block of referee work, agreed with Ken on 2026-10-06. Build in order; measure after each step. Each step ships with its tests, golden re-record, brain patch notes (`test/patch-knowledge.test.ts` and the README rule-to-brain table) and a findings round.*

## Settled decisions

### Movement
- Every primary move carries a full band (3 paces), with Evasion setting short or long (± Evasion ÷ 6 paces). This now includes Strafe.
- A Strafe travels 3 paces of **arc** around the opponent at its current separation.
- Claw's reach and width grow to match: it still reaches Melee's edge forward and into Close at the sides.

### The grid
Baselines: Wounds 36, Evasion 6, Scales (Hardness) 6; Claw 9, Bite 12, Breath 15.

| Morph | Wounds | Evasion | Scales | Peak | Valley | Prefers | Dislikes | Aspect |
|---|---|---|---|---|---|---|---|---|
| True Dragon | 42 | 3 | 6 | Wounds | Evasion | Fire | Earth | Stalwart |
| Wyvern | 36 | 9 | 3 | Evasion | Scales | Air | Fire | Talons |
| Wyrm | 30 | 6 | 9 | Scales | Wounds | Water | Air | Serpentine |
| Drake | 30 | 9 | 6 | Evasion | Wounds | Earth | Water | Ravener |

| Bloodstone | Claw | Bite | Breath | Peak | Valley | If preferred |
|---|---|---|---|---|---|---|
| Water | 9 | 9 | 18 | Breath | Bite | +3 Acumen |
| Earth | 9 | 15 | 12 | Bite | Breath | +3 Accuracy |
| Fire | 6 | 12 | 18 | Breath | Claw | +3 Affinity |
| Air | 12 | 9 | 15 | Claw | Bite | +3 Accuracy |

- **Disliked stone:** −6 Wounds. Neutral: no change.
- **Derived, after all base adds:**
  - Accuracy = Claw − Evasion (minimum 3) + preference
  - Affinity = Breath − Scales (minimum 3) + preference
  - Acumen = 10 × age category + preference (a wyrmling is 1)
- **Surge** (was the Acumen meter): starts at Acumen, fills by 9 + Affinity per trigger, full at 100. Its effects are unchanged.
- **Wheel:** the ±3 matchup on Breath and in verb contests stays. The design doc's "the element that beats you peaks where you're weakest" line is retired.
- Shared peaks and valleys are fine, for stones and morphs alike.

### The Drake
- A wingless, four-legged dragon. It prefers Earth and dislikes Water, filling the preference wheel.
- **Ravener (Aspect):**
  - An Approach or a hop that moves primes a lunge for the next 3 slots. The window carries across an exchange boundary, and a Retreat doesn't end it.
  - The Drake's first Bite in the window lunges 1 pace. While the window is live, its Bite tracks at Melee and Close.
  - The window ends at that first Bite, landed or missed. A landed Bite doesn't re-prime.
  - No wind-up change: that stays Snapping Jaw's job.
- **The hop (its Leap):** arcs 3 paces up and a full band forward (short or long by Evasion), then lands within the slot.
  - Timing: slow wind-up, normal travel, short recovery.
  - Clears floor zones and Stomp's quake while up. Breath and tracking still catch it.
  - It never reaches a flier; the Drake answers fliers with Breath and gravity.
- **Body shard:** Hollow Bones is renamed **Coiled Sinew** (Wyrmling, chip, 1 pip, +1 Evasion), dropped by both the Wyvern and the Drake.

### Techniques
- Sapping Bellow stays at base (Intimidate-borne).
- Ash Gland loses its −3 on the Breath.

## Steps

### 1. Strafe and Claw
1. **Audit** (read-only) everything that assumes Strafe distance scales with Evasion:
   - `plan.ts` move distance and `EVASION_STEP`; `ai.ts`
   - Sidewinder Spine's −1 pace and shifting strafes; Pounce's carry and stop
   - Claw's arc against strafes; Bite tracking; Serpentine against Breath
   - the leash, rim pillars and separation snap
   - brains: options (short and long strafes), value, lean, kite-focus, patch-knowledge
   - design doc lines 55 and 243; DIALS
2. **Change:** Strafe = band ± Evasion ÷ 6 as arc length; timing stays on Evasion. Claw reach and width scale up to match.
3. **Brains:** short and long strafes as options; a patch-knowledge case.
4. **Measure:** the omnibus, then the sheet half of the table. Watch the Wyvern (its lateral edge narrows) and Claw's strafe-catching role.

### 2. The regrid
1. **Engine:** `hatch.ts` to the new grid and formulas; Accuracy and Affinity derive after all base adds; the Surge rename (code, events, docs) and its Acumen start.
2. **Docs:** the design doc's attribute, swing and derivation sections; the swing table; retire the wheel-peak line and the [Open] on derivation.
3. **Re-tune dials if needed:** Accuracy now runs 3–9, mostly 3, so the aim-settle base (12) and phantom band may need a pass.
4. **Brains:** sheet tastes and measured drafting rebuild; patch-knowledge for Surge.
5. **Measure:** `measure --n 48` (full table), then omnibus and hatch. Watch the outliers: Wyrm + Earth (Affinity 3) and the Affinity-15 sheets (True Dragon + Fire, Wyvern + Water and Fire).

### 3. The Drake
1. **Engine:** the morph, Ravener, the hop, Coiled Sinew (rename Hollow Bones everywhere, spoils included).
2. **Docs:** the design doc's morph and Aspect sections; the Body shard file.
3. **Brains:** Ravener's window and the hop as options and values; patch-knowledge cases for both; the hatchery's 16 sheets.
4. **Measure:** a full table rebuild at 16 sheets; omnibus and hatch. Watch Drake against Wyvern.

### 4. Ash Gland
1. Remove the Breath's −3 at Wyrmling and Juvenile.
2. Measure: `measure --only "Ash Gland" --n 96`, merged into the table.

## Open
- The technique doc still shows v0.2 text for eight locked v0.3 variants (all but Snapping Jaw and Ash Gland). Fold in the parity-pass spec, or write the text from the code.
- True Dragon + Fire, Water as a stone and the Wyrm's thickness all need re-reading after the regrid; the old numbers no longer apply.
- Juvenile growth numbers, and Phase 9 (`referee/ROADMAP.md`).

# Referee cleanup and refactor roadmap

Status: plan only. No code has changed for this roadmap yet.
Baseline: commit `08a72ab` (Fire blast radius ¾). 139 tests pass; 20 scenarios run clean.

## Goals

1. **One canonical ruleset.** The rules the tournament plays are the rules the tests check.
2. **Rules as data.** Tunables pass in as an object; no module globals mutated at runtime.
3. **Readable resolver.** `referee.ts` (1,698 lines) split by concern, each piece small enough to hold in your head.
4. **Facts as events.** Tooling and brains read structured events, never note text.
5. **Brains track the rules.** Every rule change has an obvious place to update the brains.
6. **Ready for a game.** A clean seam between the headless Referee and a scripting UI.

Every phase must leave behavior identical unless it says otherwise. Phase 0 makes that checkable.

## Phase 0. Safety net (small, low risk)

Freeze current behavior so refactors prove themselves.

- **Golden bouts.** Run ~200 fixed-seed bouts across all morph × stone × style pairings; store a hash of each event log in `test/golden/`. A test reruns them and diffs.
- **Scenario snapshots.** Snapshot the event log of all 20 scenarios.
- **Golden tournament summary.** One small fixed-seed brains run (e.g. 2 bouts per pairing), stored as JSON.
- **Rule:** a refactor commit must keep goldens identical. A rule commit regenerates them in the same commit, with the diff named in the message.

## Phase 1. One canonical ruleset (small, medium risk)

The biggest debt: tournaments run `REFEREE_VARIANT=charge,lunge,pounce` while tests and scenarios run with all variants off.

- Fold `breathCharge`, `biteLunge` and `clawPounce` into the default rules. Delete the `VARIANT` object and the `REFEREE_VARIANT` env plumbing.
- Delete the `breathMandatory` path entirely (off, unused).
- Merge `variants.test.ts` into the topic test files; tests that assert "off" behavior go away.
- Replace the `REFEREE_FIRE_RADIUS` env read inside `BREATH` with a ruleset override (see Phase 2).
- Regenerate goldens once, deliberately. Expect test expectation churn; review each change as a rule check.

## Phase 2. Rules as an object (medium effort, low risk)

- Define `Rules` (every constant in `rules.ts`) and `DEFAULT_RULES`.
- `newBout(setup, rules = DEFAULT_RULES)`; the bout carries its rules; resolver functions read `bout.rules`.
- Tests and diagnostics pass overrides (`{ ...DEFAULT_RULES, BREATH: … }`) instead of mutating `R.*` and restoring.
- Keep the `[Assumed]` / `[Proposed]` tags as comments on the `DEFAULT_RULES` fields.
- Payoff: parallel tracks with different rules in one tournament run, with no env vars.

## Phase 3. Split `referee.ts` (large effort, low risk with goldens)

Pure moves first, no logic edits. Proposed modules under `src/referee/`:

| Module | Contents (current lines) |
|---|---|
| `state.ts` | Side, Statuses, Marks, Fighter, Bout, SlotRecord, buildSheet, newBout (22–198) |
| `events.ts` | event types and emit helpers (200–230) |
| `plan.ts` | Plan, category, guarding, phase, timing, makePlan (231–522) |
| `exchange.ts` | runExchange, snapSeparation, gravity, chain, runSlot, checkKO (523–754) |
| `tick.ts` | the per-tick loop (755–950) |
| `movement.ts` | traveling, evasionState, moveStep, stoop/lunge/pounce carry (951+, 1469–1553) |
| `damage.ts` | damage, applyHit, floor, swing (1042–1246) |
| `elements.ts` | shove, breathVerb, affinityAgainst, elementHolds, zones, slams, obstacles (1247–1468) |
| `meter.ts` | fillMeter and the spend path |
| `riders.ts` | eff, riderHolds, demoralize, intimidate |
| `techniques.ts` | techniqueOnHit, riposte, smolder |
| `index.ts` | public API re-exports, so imports outside don't change |

Then a second pass inside `tick.ts` and `damage.ts`, the two densest functions: extract named steps (aim, contact, resolve, apply) so each reads top to bottom.

Fix the stale header comment (line 11 lists crunch, charge and shards as unmodeled).

## Phase 4. Structured events (medium effort, low risk)

Today `brains-worker.ts` and parts of `brain.ts` classify outcomes by matching note text. Add typed events for:

charge broken, meter fill, meter spend, verb landed / held / contested, slam, gravity drop, demoralize, stoop, lunge, pounce, crunch capped, boulder shatter / shove, forced miss, near miss.

- Notes stay as human-readable text derived from events.
- The tournament's outcome table reads event types. Renaming a note can no longer silently zero a statistic.

## Phase 5. Brains (medium effort, medium risk)

- Split `brain.ts` (644 lines): `read.ts` (Read, prior, guess), `actions.ts` (legalActions, setups, depth), `value.ts` (value, positionValue, leverage), `styles.ts` (BRAIN_STYLES, FOCUS, styleValue), `controller.ts`.
- Move every magic weight into a named `WEIGHTS` table per style, with a one-line reason per weight.
- **Rule hooks checklist.** A short list in the README: for each rule area (movement, aim, meter, elements, aspects), the brain function that must change when that rule does. This makes "brains get the patch notes" a review step.
- Brain behavior tests: small fixed states where a style must pick a known action (a claw-focus at Melee claws; a kite-focus at Melee retreats; a full meter prefers a landing attack).

## Phase 6. Tooling (medium effort, low risk)

- Promote scratchpad diagnostics into `src/diagnostics/` with npm scripts: `diag:fire`, `diag:movement`, `diag:pairing`.
- A `ladder` script that runs the tournament across commits via worktrees (currently done by hand).
- Confidence intervals on win rates in the report, so a 3-point swing reads as noise or signal at a glance.
- `--json` output for every report, for diffing rounds.
- Rules tracks: `--rules fire-radius=1` style overrides, enabled by Phase 2.

## Phase 7. Docs (small effort)

- Update `push-and-shove.json` (written in Air's shove era).
- Consolidate `referee/README.md`: one section per rule area, each linking its design-doc section and its code module.
- Audit `[Assumed]` (29) and `[Proposed]` (20) tags: promote settled rules, list open questions in one place.
- First-principles checklist (hierarchy Geometry > Accuracy vs Evasion > Acumen; determinism; readable outcomes): one page, checked during each rule change.
- An index at the top of `referee-findings.md`: round, rule change, headline result.

## Phase 8. Tests (small–medium effort)

- Separate **rule tests** (what happens: a push and a pull cancel; Stalwart ignores its own zone) from **number tests** (exact damage values). Number tests read their values from `DEFAULT_RULES`, so a tuning change touches one place.
- Delete tests made redundant by goldens.
- Decide the fate of the crude AIs: retire `ai.ts` and `tourney.ts` (the brains supersede them), or keep one crude AI as a regression floor. Lean: keep `random` and `aggressive` as test fixtures, retire the tourney.

## Phase 9. Game-facing prep (medium effort, later)

- **Scripting phase module.** Owns the clock and lock-in: 30 s in PvP, unlimited in campaign. The phase ends when both sides lock in or the clock expires; an unlocked side's empty slots fill with a default (Guard, or the design's chosen rule).
- **Controller boundary.** Async `Controller` that returns a script or times out, so a UI, a network peer and a brain all plug in the same way.
- **Hot-seat.** Hide the first script while the second player enters theirs.
- **Reveal stream.** The event log replayed slot by slot for presentation.

## Order, effort and risk

| # | Phase | Effort | Risk | Depends on |
|---|---|---|---|---|
| 0 | Safety net | S | Low | none |
| 1 | Canonical ruleset | S | Medium (rule churn) | 0 |
| 2 | Rules object | M | Low | 1 |
| 3 | Split referee | L | Low with goldens | 0, 2 |
| 4 | Structured events | M | Low | 3 |
| 5 | Brains | M | Medium | 4 |
| 6 | Tooling | M | Low | 2, 4 |
| 7 | Docs | S | None | 1 (rolling) |
| 8 | Tests | S–M | Low | 2 |
| 9 | Game-facing | M | Low | 3 |

Suggested cut: Phases 0–2 as the first session (they change how every later tournament runs), then rerun the master tournament with ¾ Fire radius on the canonical rules. Phases 3–5 next; 6–9 as needed.

## Open questions for Ken

1. **Scripting clock early end.** The design doc says 30 s in PvP; the outline says hot-seat players each get "the full 30 seconds." Does the phase end as soon as both players lock in? (Lean: yes.)
2. **Unlocked slots at timeout.** Guard, repeat last action, or forfeit the slot?
3. **Crude AIs.** Keep as fixtures or retire?

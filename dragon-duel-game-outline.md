# Dragon Duel: Game Outline
*A plain-language map of the game's parts, screens, and the machinery underneath. Companion to `dragon-duel-design.md`. Nothing here is code yet.*

---

## 1. The Big Picture: Four Layers

Every part of the game falls into one of four layers. Keeping them apart is the single most important structural choice.

| Layer | Nickname | Job | Never does |
|---|---|---|---|
| Rules engine | **The Referee** | Takes two dragons and two scripts, works out exactly what happens, tick by tick. Pure math. | Draw anything, play sound, or know what screen it's on. |
| Presentation | **The Stage** | Reads the Referee's results and performs them: animation, camera, sound, UI. | Decide outcomes. If the Stage and Referee disagree, the Referee is right. |
| Records | **The Ledger** | Saves everything that persists: tamers, eggs, stones, dragons, shards, Ichor, ladder standing. | Run fights. |
| Networking | **The Courier** | Carries scripts between players and a server, and results back. Not needed while play is local. | Interpret anything it carries. |

**Why this split matters for this game specifically**
- **Replays are free.** A replay is two input logs plus a map seed. Feed them to the Referee and it reproduces the fight exactly. The design doc already wants this.
- **Balance testing needs no art.** The Referee can run ten thousand fights overnight in a text window. Ceilings, matchups, and degenerate builds show up as numbers.
- **Cheating gets hard.** In ranked, the server runs the Referee. A player's machine only sends a script and shows the result.
- **The browser mockup and the final game share a brain.** The mockup is a cheap Stage on top of the real Referee.

**The integer rule pays off here.** The design runs everything in whole-number points and ticks. Computers sometimes round decimal math differently from machine to machine, which breaks replays and online play. Whole numbers don't drift. Keep it that way.

---

## 2. The Things the Game Tracks

These are the nouns. Each is a record the Ledger stores or the Referee reads.

- **Tamer:** one save profile. Owns everything below, plus a lair (which caps how many dragons it can keep) and, later, MMR and ladder record. A machine can hold many tamers.
- **Egg:** a morph (True Dragon, Wyvern, Wyrm, and later extended morphs), an array shape, and structural cosmetics. Waits in the Weir until hatched.
- **Bloodstone:** an element, up to five memories (scars and lineage seams), carved seams, an optional shiny. Outlives its dragons.
- **Dragon:** an egg and a stone joined. Holds age, attributes, Acumen, its array, and its record. Can die.
- **Shard:** family, grade, shape, effect, and provenance (which bloodstone line it came from, for Bloodline).
- **Array:** a dragon's pip board: valences, pips, seams, and which shard sits where.
- **Stat Sheet:** a flattened summary of everything above (final attribute numbers, active rule bends, timing profiles), rebuilt whenever the array changes. The Referee reads only this.
- **Arena:** theme, threat rating, seed, and the obstacle layout the seed produces.
- **Bout:** two Stat Sheets, an arena, a ruleset (mode), and the running list of exchanges.
- **Script:** one player's three slots for one exchange, plus an optional slot-3 revision.
- **Event Log:** everything the Referee decided, in order, tick-stamped. The Stage performs it; the replay stores its inputs.

---

## 3. The Pipeline: Weir to Arena and Back

The core loop, as the player walks it. Each stage lists what the player does and what runs underneath.

### 3.0 Profile Select
- **Player:** picks which tamer (save profile) to play as, or makes a new one. For a local lobby bout, a second player picks a second profile.
- **Underneath:** the Ledger loads one or two save files.

### 3.1 The Weir (home)
- **Player:** sees their eggs, stones, living dragons, resting venerables, and Ichor. Chooses where to go. The lair shows how many dragons the tamer can keep.
- **Underneath:** the Ledger loads the tamer. Starter rules apply here: no dragon and no stone means a starter egg and stone; a stone with no dragon means an egg.

### 3.2 The Hatchery
- **Player:** picks an egg and a stone (or two adjacent stones to fuse, naming the primary). Sees a full preview of the dragon before confirming, Persona-style.
- **Underneath, the Hatching Engine runs in a fixed order:**
  1. Morph baseline from the egg.
  2. Fusion, if two stones: produce the intermediate, keep the primary's scars.
  3. Stone baseline.
  4. Elemental swing (preferred, disliked, or neutral).
  5. Scars from the stone's memories.
  6. Derive tertiaries: Accuracy, Affinity, Acumen's starting value.
  7. Cosmetics: egg sets structure, stone sets surface, attributes set proportions, scars set marks.
- **Out:** a new Dragon record at Wyrmling with 3 empty pips.

The preview and the real hatch must run the same engine. A preview that lies, even once, breaks trust in the whole system.

### 3.3 The Dragon Sheet and Array Board
- **Player:** inspects the dragon. Seats shards onto pips, carves seams with Ichor, reviews the stat sheet.
- **Underneath:**
  - **Array Engine:** checks a shard's shape fits, handles overlap (strip perks, then values, salvage Ichor), applies seams, applies Support reach.
  - **Stat Sheet Compiler:** turns the array into final numbers and a list of active rule bends.
  - **Growth Engine:** when all valences are full, offers age-up. Adds the new valence, grants weighted attribute points, refreshes carving allowance.
- Seating locks, so every placement gets a confirm step showing exactly what it will destroy.

### 3.4 Mode Select and Bout Setup
- **Player:** picks Campaign, Ranked, or Open Lobby, then an opponent or a queue.
- **Underneath:** a **Ruleset** gets attached to the bout. It's a short list of switches: permadeath on or off, spoils on or off, clock length, timeout rule, who counts as challenger. Every mode uses the same Referee with different switches (section 6).
- **Arena Generator** builds the map from the theme and a seed.

### 3.5 The Arena
The fight is a loop of exchanges, each with three phases:

1. **Scripting phase** (30 seconds in PvP, untimed in campaign). Both players fill three slots in the Scripter (section 4). Nothing moves.
2. **Resolution phase.** Slots 1 and 2 play out. Slot 3 stays live for one revision; a revision flashes on screen.
3. **Slot 3 resolves.** End-of-exchange effects fire: environment, lingering areas, rim pulses in the final three exchanges. KO check.

**Underneath, the Referee** runs 90 ticks per exchange (3 slots of 30). Each tick, in order:
1. Movement for both dragons.
2. Hit detection against active windows and attack shapes.
3. Near-miss checks; Surge meters update.
4. Damage and statuses, applied together.
5. KO checks.

Then the Stage performs the result. The outcome is decided before animation starts.

**Space inside the Referee.** The Referee thinks in a top-down map measured in paces, plus a height number for altitude and burrowing. Range bands, the leash, the orbit, and obstacle collisions all come from that map. The 3D view is painted on top by the Stage.

### 3.6 Aftermath
- **Victory:** the Spoils Engine builds the pick pool (two generated shards plus the loser's intact array) and the victor picks as many as the slain dragon's age category. Ichor is awarded.
- **Death:** the dragon record closes. The stone returns, scarred if Adult or older. Memories over five prompt a discard choice.
- **Timeout:** non-lethal; the challenger forfeits. No shards.
- **Ranked:** MMR and ladder position update.
- Back to the Weir.

### 3.7 Retirement (from the Weir)
- **Harvest:** reclaim shards and the stone; the dragon ends.
- **Rest:** a venerable stays, lays eggs, yields Ichor. Matching morph and stone lays an extended egg (the unlock tree).
- **Ascension:** a qualifying Wyrm becomes an Ouroboros.

---

## 4. The Action Scripter

The screen where the game is actually played. It needs to be fast at 30 seconds and deep when untimed.

### 4.1 Layout
- **Arena view (top or center):** a top-down tactical map. Both dragons, range-band rings drawn around the opponent, obstacles, lingering areas, the leash edge.
- **Slot rail (bottom):** three slot cards in a row, left to right. Each card shows its chosen action as an icon and its 30-tick bar split into wind-up, active, and recovery.
- **Opponent panel (side):** everything readable about the rival: cooldowns and which slot each returns in, statuses, Surge, chain progress, a charge in progress, the stone and silhouette.
- **Own panel (other side):** the same readout for your own dragon.

### 4.2 Filling a Slot
Four short steps, each a small menu:
1. **Category:** Attack, Move, Defend, Intimidate.
2. **Action:** Bite, Claw, Breath, Stomp; Approach, Retreat, Strafe, Leap, Dive; Dodge, Guard; Intimidate.
3. **Detail:** direction (clockwise or counterclockwise around the opponent), claw sweep side, crunch partner, and so on. Only options that exist appear.
4. **Confirm.**

Radial menus suit this well: the same thumb or mouse flick every time, and they work on a controller. Players will learn the flick patterns the way fighting-game players learn motions.

### 4.3 What the Scripter Shows Before You Commit
- **Ghost preview:** a translucent copy of your dragon walks through the slot on the arena map, and the attack's shape lights up where it will land.
- **Threat overlay:** the shapes of every attack the opponent *could* use next, given their position and cooldowns. Their script stays secret; their options don't. This is "visible state turns guesses into reads" made literal.
- **Timeline bars:** your bar under each slot, with the active window highlighted. Modifiers from shards or statuses visibly push the edges.
- **Locked options:** greyed out with the reason, such as "Breath returns in slot 2."
- **Chain counter** on repeated inputs, **crunch and charge** cards that span half or double a slot, so they read at a glance.

### 4.4 The Revision Window
- During resolution, the slot-3 card stays lit and editable. One tap opens the same menus.
- Revisions flash on both players' screens, as the design requires. The flash shows only that a revision happened; the new action stays hidden until it plays.
- Iron Will, Cold Reader, and the Yinglong Aspect change what this card allows; the Scripter should show those changes on the card itself.

### 4.5 Clock and Defaults
- A visible 30-second countdown. A "ready" button ends early when both players confirm.
- An unfilled slot holds position. An idle dragon is a dead dragon. (Intimidate is the alternative default; it also punishes inactivity, since it leaves the dragon open.)

### 4.6 Readability Rules
- Every category gets a color **and** a shape, so color is never the only signal.
- Icons first, short labels second, numbers on hover or hold.
- Campaign can offer a "step" mode that pauses at each tick of a resolution, which doubles as the tutorial's teaching tool.

### 4.7 Two Players, One Screen
Local PvP has to keep scripts secret on a shared screen. That's the hardest UI problem in the project.
- **Scripting by handoff.** Player 1 scripts while Player 2 looks away, then a blank "pass" screen, then Player 2 scripts. Each gets the full 30 seconds. Simple and reliable.
- **The revision window is live,** so a handoff doesn't fit. Two options:
  - **Blind flick:** each player holds their own controller. A revision is a radial flick with no menu drawn on screen; only the flash appears. This rewards learning the radial by feel, which suits the fighting-game DNA.
  - **Revision pause:** in local play only, a revision freezes the fight and hands the screen over briefly. Safer for new players; breaks the live feel.
- **[Open]** Blind flick, revision pause, or both as a lobby option.

---

## 5. Screen List

| Screen | Purpose |
|---|---|
| Title | Start, settings. |
| Profile Select | Pick one tamer, or two for a local lobby bout. |
| Weir | Home hub: eggs, stones, dragons, venerables, Ichor. |
| Hatchery | Pair egg and stone, preview, confirm. |
| Dragon Sheet | Attributes, Aspect, record, Acumen. |
| Array Board | Seat shards, carve seams, see the stat sheet change live. |
| Shard Vault | Inventory, melting into Ichor, provenance. |
| Stone Vault | Stones, their memories and seams, fusion previews. |
| Mode Select | Campaign, Ranked, Open Lobby. |
| Campaign Map | Rival tamers, hunts, the tutorial elder. |
| Ranked Queue (later) | Track, bracket, MMR, queue status. |
| Lobby | Two local profiles, any dragons, room settings, no stakes. |
| Arena | Scripter, resolution, revision window. |
| Aftermath | Spoils pick, scars, Ichor, ladder change. |
| Lineage | A stone's history: every dragon it held, how each died. |
| Replays | Saved fights, playback controls, step mode. |

The **Lineage** screen is cheap to build and does a lot of emotional work in a permadeath game. Every loss becomes part of a story the player keeps.

---

## 6. Modes Are Switches

One Referee, one Scripter, one Aftermath. Modes only flip switches.

| Switch | Tutorial | Campaign | Open Lobby (local) | Ranked (later) |
|---|---|---|---|---|
| Permadeath | Off | On | Off | On |
| Spoils | Off | On | Off | On |
| Ledger writes | Shiny only | Yes | No | Yes |
| Clock | None | None | Lobby option, default 30 s | 30 s |
| Opponent | Scripted elder | AI tamers | Second local profile | Matched player |
| Who runs the Referee | Your machine | Your machine | Your machine | Server |
| Timeout rule | n/a | Challenger forfeits | Lobby option | Challenger forfeits |

Local lobby bouts never kill or transfer anything, which keeps the collusion closure intact: two profiles on one machine can't feed each other shards.

**The AI opponent** is its own engine: it writes scripts. A brain reads the opponent's visible habits, imagines the exchange in the Referee, and chooses by its style's values (built in `referee/src/brain.ts`). Styles borrow boxing's vocabulary: swarmer, out-boxer, slugger, counterpuncher, boxer-puncher, plus the aerialist and the reader. Each keeps a tell a player can learn, and a skill level (novice, adept, master) sets how much it imagines and how often the tell shows. A campaign rival is a style, a loadout, a tell and a skill. The tutorial elder is a counterpuncher with a loud tell.

---

## 7. Online Play (Later)

The build is local-only for now. This section records why online play will be easy when it comes.

Simultaneous turns make online play much simpler than in a real-time fighter.
- **No rollback netcode needed.** Each player sends one script per exchange. A delay of a fraction of a second is invisible.
- **Flow:** both scripts go to the server, the server's Referee resolves, both players receive the same Event Log.
- **The revision window** is the one live moment. The server accepts a revision only before slot 3 starts.
- **Async play** falls out naturally: scripts can wait for hours instead of seconds. Thin ranked brackets stay alive this way.
- **Permadeath lives on the server.** If ranked dragons lived only on the player's machine, someone would edit the save to bring one back.

---

## 8. Engine and Tool Choices

A "game engine" is the toolkit that handles drawing, sound, input, and loading assets, so you don't build those yourself. The Referee doesn't need one at all.

| Option | What it's good at | Trade-off |
|---|---|---|
| **Browser (TypeScript, with a library such as Three.js or Phaser)** | Fastest to share a link and test with friends. Ideal for the mockup. | Polished 3D is harder; it's a prototype home, not a final one. |
| **Godot** | Free, open source, friendly to small teams, solid 2D and 3D. | Smaller ecosystem than Unity; top-end 3D trails Unreal. |
| **Unity** | Industry standard, huge library of tutorials and assets. | Licensing has shifted before; heavier than Godot. |
| **Unreal** | Best-in-class visuals and animation tools. | Steep learning curve; overkill for a small team. |

**Recommendation for a private PC and Linux build**
1. **Build the Referee first, as its own program, in TypeScript.** It runs anywhere, including a future server.
2. **Build the mockup in the browser** with a flat top-down view: circles for dragons, shapes for attacks, the real Scripter UI. It runs on Linux with nothing to install, and saves can live in local files.
3. **Godot is the likely production engine.** It exports natively to Linux and Windows, and its 2D tools suit hand-drawn art. Moving the Referee into Godot is a known porting job; choose when the combat is fun in flat shapes.

---

## 9. Art Direction

**Hand-drawn watercolor, ink-blot, and ink-stamp.** The brief for artists and animators. It also shapes the technical side.

**How it maps onto the game**
- **Elements as pigments.** Each element owns an ink: indigo water, ochre earth, vermilion fire, a pale wash for air, with the intermediates as mixes on the wheel. Breath becomes a wash thrown across the page.
- **Lingering areas bleed.** Burning zones, corrosive pools, and caustic clouds read naturally as ink spreading into wet paper.
- **The bloodstone as an ink-blot.** Blots are symmetrical, like the chest crater. Seams and scars can be drawn as lines and cracks in the blot.
- **Seating a shard is pressing a seal.** The array board becomes a page of chops: each shard a stamp, overlap a stamp pressed over another. Locked seating feels right when it's ink.
- **Revisions flash as fresh, wet ink** on the slot card.
- **Cosmetic parts are separate brush layers** (head, wings, tail, ridges), which fits the per-part detail roster.

**What it means for animation**
- The design doc's animation plan assumes 3D models. Watercolor art usually goes one of two ways:
  - **2D cutout rigs:** painted parts on a skeleton, like a puppet. Cheap to vary per body part, and Godot handles it well. Altitude and orbiting need clever staging.
  - **Painted dragons in a 3D space:** flat painted figures or painterly shaders in a 3D arena. Keeps the orbiting camera; harder to make look hand-made.
- References to bring to artists: Ōkami (sumi-e brushwork), Gris (watercolor), Hollow Knight (hand-drawn 2D animation).
- **[Open]** 2D cutout or painted 3D. The artists should weigh in before the production engine gets chosen.

---

## 10. Suggested Build Order

Each step is playable or testable before the next starts.

1. **Referee, text only:** two fixed dragons, one exchange, printed tick by tick. Proves the timeline, hit detection, and damage.
2. **Full bout in text:** exchanges until KO, the leash, range bands, cooldowns, chains.
3. **Browser Scripter:** the real slot UI over a top-down map. Two players at one screen, using the handoff.
4. **Hatchery and Stat Sheet:** make any core morph and stone pairing and fight with it.
5. **Simple AI:** a pattern-based opponent, then the tutorial elder.
6. **Aftermath and Ledger:** death, scars, multiple save profiles, a saved Weir, local lobby bouts between profiles.
7. **Arrays and shards:** start with Body and Bloodstone chips, then Techniques.
8. **Balance harness:** the Referee running thousands of AI-vs-AI fights and reporting pick and win rates.
9. **Online (later):** server Referee, two machines, then async.

Steps 1 to 4 match the vertical slice in the design doc: the three core morphs, the four core elements, shards later.

---

## 11. Settled and Open

**Settled**
- Platform: PC and Linux, private, local play first.
- Team: solo with AI help for the mockup. If the project grows, contract programmers and artists, with the designer as project manager. The design doc and this outline become the brief.
- Unfilled slots hold position.
- One dragon per bout; the lair caps total dragons.
- Local PvP between save profiles, in lobby bouts.
- Art: hand-drawn watercolor, ink-blot, ink-stamp.

**Open**
- Revision input in local PvP: blind flick, revision pause, or both (section 4.7).
- 2D cutout or painted 3D (section 9).
- Lair size and how it grows.

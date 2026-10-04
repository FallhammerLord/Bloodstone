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
| Networking | **The Courier** | Carries scripts between players and a server, and results back. | Interpret anything it carries. |

**Why this split matters for this game specifically**
- **Replays are free.** A replay is two input logs plus a map seed. Feed them to the Referee and it reproduces the fight exactly. The design doc already wants this.
- **Balance testing needs no art.** The Referee can run ten thousand fights overnight in a text window. Ceilings, matchups, and degenerate builds show up as numbers.
- **Cheating gets hard.** In ranked, the server runs the Referee. A player's machine only sends a script and shows the result.
- **The browser mockup and the final game share a brain.** The mockup is a cheap Stage on top of the real Referee.

**The integer rule pays off here.** The design runs everything in whole-number points and ticks. Computers sometimes round decimal math differently from machine to machine, which breaks replays and online play. Whole numbers don't drift. Keep it that way.

---

## 2. The Things the Game Tracks

These are the nouns. Each is a record the Ledger stores or the Referee reads.

- **Tamer:** the player's account. Owns everything below, plus MMR and ladder record.
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

### 3.1 The Weir (home)
- **Player:** sees their eggs, stones, living dragons, resting venerables, and Ichor. Chooses where to go.
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
3. Near-miss checks; Acumen meters update.
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
- **Opponent panel (side):** everything readable about the rival: cooldowns and which slot each returns in, statuses, Acumen meter, chain progress, a charge in progress, the stone and silhouette.
- **Own panel (other side):** the same readout for your own dragon.

### 4.2 Filling a Slot
Four short steps, each a small menu:
1. **Category:** Attack, Move, Guard, Intimidate.
2. **Action:** Bite, Claw, Breath, Stomp; Approach, Retreat, Strafe, Leap, Dive; Dodge, Scales; Intimidate.
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
- Revisions flash on both players' screens, as the design requires.
- Iron Will, Cold Reader, and the Yinglong Aspect change what this card allows; the Scripter should show those changes on the card itself.

### 4.5 Clock and Defaults
- A visible 30-second countdown. A "ready" button ends early when both players confirm.
- **[Open]** What an unfilled slot becomes at timeout. Options: repeat last exchange's slot, Guard with Scales, or hold position. Holding position is the most honest default; a Scales default quietly rewards stalling.

### 4.6 Readability Rules
- Every category gets a color **and** a shape, so color is never the only signal.
- Icons first, short labels second, numbers on hover or hold.
- Campaign can offer a "step" mode that pauses at each tick of a resolution, which doubles as the tutorial's teaching tool.

---

## 5. Screen List

| Screen | Purpose |
|---|---|
| Title | Start, settings, account. |
| Weir | Home hub: eggs, stones, dragons, venerables, Ichor. |
| Hatchery | Pair egg and stone, preview, confirm. |
| Dragon Sheet | Attributes, Aspect, record, Acumen. |
| Array Board | Seat shards, carve seams, see the stat sheet change live. |
| Shard Vault | Inventory, melting into Ichor, provenance. |
| Stone Vault | Stones, their memories and seams, fusion previews. |
| Mode Select | Campaign, Ranked, Open Lobby. |
| Campaign Map | Rival tamers, hunts, the tutorial elder. |
| Ranked Queue | Track, bracket, MMR, queue status. |
| Lobby | Room settings, invites, any dragon, no stakes. |
| Arena | Scripter, resolution, revision window. |
| Aftermath | Spoils pick, scars, Ichor, ladder change. |
| Lineage | A stone's history: every dragon it held, how each died. |
| Replays | Saved fights, playback controls, step mode. |

The **Lineage** screen is cheap to build and does a lot of emotional work in a permadeath game. Every loss becomes part of a story the player keeps.

---

## 6. Modes Are Switches

One Referee, one Scripter, one Aftermath. Modes only flip switches.

| Switch | Tutorial | Campaign | Ranked | Open Lobby |
|---|---|---|---|---|
| Permadeath | Off | On | On | Off |
| Spoils | Off | On | On | Off |
| Ledger writes | Shiny only | Yes | Yes | No |
| Clock | None | None | 30 s | Host's choice |
| Opponent | Scripted elder | AI tamers | Matched player | Invited player |
| Who runs the Referee | Your machine | Your machine | Server | Server or host |
| Timeout rule | n/a | Challenger forfeits | Challenger forfeits | Host's choice |

**The AI opponent** is its own engine: it writes scripts. Campaign tamers can start simple, with fixed patterns and a few "if they're at Far, breathe" rules. The tutorial elder is the simplest case: a readable pattern by design. Smarter AI can come much later; the Referee already lets you test it by running AI against AI.

---

## 7. Online Play

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

**Recommendation**
1. **Build the Referee first, as its own program, in TypeScript.** It runs in a browser for the mockup and on a server for ranked play.
2. **Build the mockup in the browser** with a flat top-down view: circles for dragons, shapes for attacks, the real Scripter UI. This is where the combat gets proven.
3. **Pick the production engine later**, once the combat is fun in flat shapes. Godot is the likely fit. The Referee stays on the server either way; the production game would need its own copy for previews, which is a known porting job.

---

## 9. Suggested Build Order

Each step is playable or testable before the next starts.

1. **Referee, text only:** two fixed dragons, one exchange, printed tick by tick. Proves the timeline, hit detection, and damage.
2. **Full bout in text:** exchanges until KO, the leash, range bands, cooldowns, chains.
3. **Browser Scripter:** the real slot UI over a top-down map. Two players at one screen.
4. **Hatchery and Stat Sheet:** make any core morph and stone pairing and fight with it.
5. **Simple AI:** a pattern-based opponent, then the tutorial elder.
6. **Aftermath and Ledger:** death, scars, a saved Weir.
7. **Arrays and shards:** start with Body and Bloodstone chips, then Techniques.
8. **Balance harness:** the Referee running thousands of AI-vs-AI fights and reporting pick and win rates.
9. **Online:** server Referee, two browsers, then async.

Steps 1 to 4 match the vertical slice in the design doc: the three core morphs, the four core elements, shards later.

---

## 10. Decisions Needed Before Building

- **Timeout default** for unfilled slots (section 4.5).
- **Platform target:** PC, console, mobile, or browser first. It changes the Scripter's input design more than anything else.
- **Team:** solo with AI help, or with collaborators. It decides how much the engine choice should favor ease over power.
- **Art direction for the mockup:** plain shapes are enough to prove combat; the question is when real dragons need to appear for playtesters to care.

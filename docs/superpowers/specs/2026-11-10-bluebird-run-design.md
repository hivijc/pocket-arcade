# Bluebird Run — Design Spec (one-slope slice)

Date: 2026-11-10
Status: Approved in brainstorming, pending written review
Arcade slot: game #4 in Pocket Arcade (after Backyard Mini-Golf, Paper Route and the trick-shot
basketball game)

## 1. Summary

A sunny-day isometric pixel-art snowboarding game for desktop and iPhone browsers. ("Bluebird" is
skier slang for a cloudless day after fresh snow.) You ride one hand-designed slope, **Pinecone
Bowl**, from the start hut down to the finish banner. On the way you carve through slalom gates,
dodge trees, rocks, snowmen and slower riders, launch off kickers for spins and grabs, and pick up
golden snowflakes. A run takes about 60–75 s and ends with a score made up of gates, tricks,
snowflakes and a time bonus. The best score is saved.

It shares the Pocket Arcade look: a 360×270 buffer scaled up in whole pixels, a 32-colour palette,
code-baked dithered ground with a fringe, and chunky 32 px PixelLab sprites with dark outlines.

**Original work.** Only the downhill-snowboard genre and its common mechanics are used. No name,
character, course, UI or signature feature comes from an existing game. In particular there is **no
chasing monster**. The other riders on the slope are friendly and slow.

## 2. Goals and non-goals

**Goals (this slice)**
- One hand-authored slope, Pinecone Bowl, played from the title card to the end card. The best score
  is saved in `localStorage`.
- The core loop works and feels good: carving with speed control, gates and streaks, ollies,
  kicker jumps with spin and grab tricks, clean and failed landings, hazards, crashes, snowflakes and
  the finish time bonus.
- Keyboard on desktop and thumb-drag touch on iPhone. The layout must fit an iPhone in both
  portrait and landscape.
- Daytime only: one bright sunny grade, with no time-of-day cycle. The page background matches the
  canvas backdrop, so the game sits on one seamless colour.
- Sound effects only, generated in code. **No music and no ambience.**
- Self-contained under `games/bluebird-run/`, with a card on the Pocket Arcade hub.

**Non-goals (later)**
- More slopes, seeded or daily slopes, a ghost of the best run, named trick combos and multipliers,
  tilt steering, online leaderboards, and weather or time-of-day changes (daytime only, always).

## 3. Platform and stack

- Desktop browsers (keyboard) and iPhone Safari (touch). Other touch phones should work too but
  aren't a target.
- TypeScript and Canvas 2D, with no game framework. Vite 6, Vitest 5, Playwright and Node 22.
- Engine code is **copied** from Paper Route (and the canvas-scale helper from mini-golf) into the
  game folder and adapted. Nothing outside `games/bluebird-run/` is imported or edited, apart from the
  root wiring in §6.

## 4. World and camera

- **Grid:** the same 2:1 iso projection (`TILE_W = 32`, `TILE_H = 16`, `Z_PX = 16`).
- **Slope axes:** the downhill coordinate `d` (tiles from the start) is grid `x`, and the across
  coordinate `c` maps to grid `y = 16 − c`. Riding downhill (`d` increasing) moves the rider
  **down-right (↘)** on screen. Across, `c = 0` is the **screen-left** edge (down-left on screen) and
  `c = 16` is the **screen-right** edge (up-right on screen). Turning right (→) always heads towards
  screen-right (larger `c`), even though that's the rider's own left when they face the camera, so
  the controls match what the player sees. Depth = `d + (16 − c)`, so a larger value is closer and
  drawn later.
- **Cross-section** (16 tiles across):

  | `c` range | strip |
  |---|---|
  | 0–2 | left powder edge, lined with pines |
  | 2–14 | groomed piste (corduroy), with packed-trail patches |
  | 14–16 | right powder edge, lined with pines |

- **Length:** about 360 tiles. That's a 10-tile start apron at the hut, about 340 tiles of course,
  and at least a 12-tile run-out past the finish line (`d = finish`, which the loader enforces) where
  the rider brakes to a stop. Crossing the line in the air settles the landing (and the trick) there.
- **Camera:** follows the rider's `d` and a heavily damped `c`. The rider is held about one third from
  the top-left of the buffer (anchor near (130, 85)), so the slope below and ahead stays in view.
  Camera motion is smoothed and then rounded to whole buffer pixels, so the scroll never shimmers.
- **Terrain bake:** the ground is baked in **16-tile chunks** along `d` with Paper Route's chunk
  cache, Bayer dither and fringe code. Surfaces are *groomed* (a faint diagonal corduroy dither),
  *packed trail* (greyer, smoother), *powder* (brighter, with a lumpy fringe where it meets groomed
  snow) and *shade* (ice-blue, under tree clusters). Chunks are baked lazily as they come into view
  and evicted once they are behind the camera. The slope is a floating diorama strip with snowy-rock
  sides along its two long edges.
- **Carve tracks:** the board leaves a live trail of about the last 90 positions, drawn as 1 px
  darker-blue lines, which are deeper on hard carves. They are not baked into the chunks.

## 5. Gameplay

All numbers are starting values and live in `sim/constants.ts`.

**Board (on the ground)**
- The board has a heading `θ` in degrees from straight downhill, clamped to −75…+75. ←/A and →/D
  turn it at 150°/s. With no input it slowly straightens towards 0 at 40°/s.
- Speed: the downhill pull accelerates the rider by `5·cos θ` tiles/s², and drag is `0.625·v`, which
  gives a top speed of 8 tiles/s pointing straight down. Carving (|θ| > 45°) adds braking of
  `4·(|θ| − 45°)/30°` tiles/s². The rider moves along `θ`, so carving across the hill is both how you
  steer and how you slow down. The start speed is 0 and there is a minimum speed of 1 tile/s once
  rolling, so you never stall.
- Powder edge (`c < 2` or `c > 14`): drag ×3. The rider is clamped to `c` 0.4–15.6.
- `θ > 0` heads towards larger `c` (screen-right). Sprite direction: the facing angle (`θ`, plus any
  spin in the air) is turned into a screen angle of `45° − facing`, and the nearest of the 8
  directions is used. Straight down is SE. Carving right goes E and then NE at the hardest carve, and carving left goes S and then SW. A
  spray particle burst comes off the board when |θ| > 45° at speed.

**Ollie and air**
- Space (or a tap on touch) on the ground does an **ollie**: 0.45 s of air with a peak height of
  0.5 tiles. It can be used again once landed, after a 0.15 s grace period.
- A **kicker ramp** (2×3 tiles) launches the rider when they cross its lip. Airtime is
  `0.5 + 0.1·v` s, so about 0.8–1.3 s, with a peak of `0.25·airtime·v` tiles. Ramps are drawn as
  raised sprites and their footprint is never a crash.
- In the air, `d` and `c` keep moving with the take-off velocity, and the shadow is drawn on the
  snow.

**Tricks**
- **Spin:** holding ←/→ (or dragging on touch) while in the air rotates the rider at 540°/s, and the
  sprite steps through all 8 directions. The accumulated rotation is tracked.
- **Grab:** a fresh press of Space held in the air (the ollie's own press doesn't count until it's
  released and pressed again), or on touch a finger held still (within 12 px of its anchor) or a
  second finger held, plays the grab pose, and grab time builds up. Dragging spins instead.
- **Landing:** a landing is clean if the final spin is within ±35° of any multiple of 180°. Landing
  backwards (switch) is fine and the board flips to face downhill. Otherwise the rider wipes out.
- **Trick score (clean landings only):** +150 per 180° of spin, plus +200 if the grab was held for at
  least 0.3 s. A trick of 360° or more with a grab gets a ×1.5 "style" bonus. The trick name ("360",
  "Grab", "540 Grab", …) pops up in the HUD.

**Gates**
- Pairs of flags, alternating blue and red, sit 2–6 tiles apart across the slope (most gates use 4). Crossing a gate's
  `d` line between its two flags scores +100, plus +50 for each earlier gate in the current
  unbroken streak. Missing a gate resets the streak and costs nothing else. Touching a flag pole
  counts as passing through and doesn't crash you.

**Hazards (all are crashes on contact unless stated)**
- **Pine tree:** footprint radius 0.35.
- **Rock:** small (radius 0.3, can be ollied over, since a rider at height ≥ 0.3 clears it) and big
  (radius 0.5, cannot be cleared).
- **Snowman:** radius 0.35. It bursts into a puff of snow (one-off particles), but still crashes you.
- **Other riders:** 3–4 friendly skiers and riders in different colours, each following an authored
  slalom path down a section of the slope at 3–4.5 tiles/s. Touching one is a crash for you, and they
  carry on. Each one wakes when the player comes within 30 tiles above its start, then rides its path to the end and leaves the slope.
- Overlaps are tested between the rider's radius (0.3) and each hazard's footprint circle, only while
  the rider's height is below the hazard's clear height: small rock 0.3, big rock 0.6, snowman 1.0,
  other rider 1.2 and pine 2.0 tiles. An ollie clears only small rocks, and a fast kicker jump can
  sail over almost anything.

**Crash**
- A 1.2 s tumble with the speed falling to 0, after which the rider stands up where they fell, facing
  downhill, with 1.5 s of blinking invulnerability. There are no lives, so a crash only costs time.
  A failed landing is a crash.

**Snowflakes**
- Golden snowflakes (radius 0.4) are worth +25 each and are placed in lines that hint at good routes
  and ramp lines. They can be collected on the ground or in the air.

**Finish**
- Crossing `d = finish` stops the clock. Time bonus = `max(0, 75 − time) × 40`, rounded.
- **End card:** score, time, gates (n/N), the best trick, snowflakes (n/N), the best score, and
  "Enter / tap to ride again".

**Run flow:** title → countdown (3, 2, 1, the rider drops in) → riding ⇄ air → (crash tumble) →
finish run-out → end card.

**Keyboard**
| key | action |
|---|---|
| ← / A , → / D | turn the board (spin when in the air) |
| Space | ollie on the ground; grab while held in the air |
| Enter (or Space on a card) | start / continue |
| R | restart the run |
| Esc | pause and resume (pause shows a small overlay) |

**Touch (iPhone)**
- **Turn:** a finger that goes down anywhere on the game sets an anchor. Dragging left or right of the
  anchor turns the board, with a horizontal offset of ±48 CSS px mapping to full turn input
  (proportional, not just on/off). Releasing returns the input to 0.
- **Jump:** a quick tap (shorter than 180 ms and moving less than 8 px) does an ollie. A second finger
  touching down while the first is steering also does an ollie.
- **In the air:** the drag offset spins. A finger held still near its anchor, or a second finger
  held down, grabs (see Grab above).
- On-screen buttons in the HUD for pause and retry. Tapping the title and end cards starts or
  continues.
- A small hint on the title card ("drag to carve · tap to jump") appears on touch devices, and the
  keyboard hint appears otherwise.
- Pinch-zoom, double-tap zoom, text selection and scroll bounce are disabled on the game page
  (`touch-action: none`, a viewport meta with `user-scalable=no`, and `preventDefault` on touch
  events over the game).

**Sound effects** (Web Audio, made in code, no files)
| event | sound |
|---|---|
| carving | a filtered-noise swish whose volume and cutoff follow the lean and speed (continuous while carving, faded out otherwise) |
| ollie / ramp launch | a short pop |
| clean landing | a soft thud, plus a sparkle on a scored trick |
| wipeout / crash | a crunchy noise burst |
| gate passed | a chime that steps up in pitch with the streak (resetting with it) |
| snowflake | a high tick |
| countdown | beep, beep, beep, then a higher "go" beep |
| finish | a short rising sting (three notes, not music) |

Audio starts on the first user gesture, as iOS requires. A mute toggle in the HUD is stored in
`localStorage`.

## 6. Architecture

```
games/bluebird-run/
  index.html                Vite entry (title "Bluebird Run", "← Pocket Arcade" back link, viewport meta)
  src/
    main.ts                 boot: load slope + assets, start loop, error banner on failure
    style.css               page background = canvas backdrop; phone layout
    core/
      geometry.ts           copied
      loop.ts               copied (fixed 60 Hz sim step, rAF render)
      input.ts              adapted: keys + touch → { turn: −1…1, jumpHeld, jumpPressed, start, restart, pause }
      touch.ts              pure touch gesture interpreter (anchor, drag offset, tap, second finger)
    render/
      iso.ts                adapted: slope axes (d → x, c → y), depth
      palette.ts            copied; loads the snow palette
      post.ts               palette snap + one fixed sunny grade
      dither.ts             copied
      slope-bake.ts         snow surfaces, chunk bake, powder fringe, corduroy
      chunks.ts             copied chunk cache
      camera.ts             adapted: rider anchor, damped across-follow
      tracks.ts             carve-track ring buffer → line segments (pure)
      particles.ts          spray and snow-puff particles (pure step, seeded)
      assets.ts             copied loader
      renderer.ts           chunks + tracks + depth-sorted sprites + shadows + particles
    world/
      slope.ts              Slope type + loader/validator (fails loudly on bad data)
      slopes/pinecone-bowl.json
      manifest.ts           sprite manifest types + validation
    sim/
      constants.ts          every tunable number from §5
      board.ts              stepBoard(board, input, dt, surface) → new board (pure)
      air.ts                ollie, ramp launch, air step, landing check (pure)
      tricks.ts             spin/grab accumulation, landing verdict, trick score and name (pure)
      gates.ts              gate crossing and streaks (pure)
      hazards.ts            hazard overlaps, other riders along their paths (pure)
    game/
      state.ts              pure reducer: (state, input, dt) → { state, events }
      score.ts              scoring totals, time bonus, best-score storage wrapper
      events.ts             event union for sfx and HUD
    ui/
      layout.ts             canvasScale (copied from mini-golf)
      hud-text.ts           pure formatters (time, trick names, end-card lines)
      hud.ts                DOM overlay: score, time, streak, trick pop-up, title, pause, end card, touch buttons
    audio/
      sfx.ts                Web Audio sfx
      sfx-math.ts           pure parameter maths (swish level, chime pitch)
  assets/
    palette.json            the "Bluebird" snow palette (32 colours)
    manifest.json           frames, anchor, footprint per sprite
    sprites/*.png           PixelLab output, palette-snapped
    raw/                    PixelLab downloads (gitignored)
  scripts/
    ingest.ts               copied from Paper Route, with paths relative to the game folder
    lib/sprite-tools.ts     copied
  tests/
    unit/*.test.ts          Vitest
    helpers/                slope builders, a headless bot
    e2e/bluebird-run.spec.ts    desktop flow
    e2e/bluebird-touch.spec.ts  iPhone 13 profile flow
```

**Root wiring**
- `vite.config.ts`: add `bluebirdRun: at('./games/bluebird-run/index.html')` to the rollup inputs.
- `package.json`: `"dev:bluebird-run": "vite --open /games/bluebird-run/"` and
  `"ingest:bluebird-run": "vite-node games/bluebird-run/scripts/ingest.ts"`.
- `vitest.config.ts`: the include already covers `games/*/tests/unit`. The coverage include adds
  `games/bluebird-run/src/{sim,game,world}/**` plus `core/touch.ts`, `render/tracks.ts` and
  `render/particles.ts`.
- `playwright.config.ts`: add a `bluebird-run` project (testDir `games/bluebird-run/tests/e2e`). Because
  of the port gotcha in Paper Route's hand-over, set `reuseExistingServer: false`. If another
  worktree already holds port 5199, `--strictPort` then fails loudly instead of the tests quietly
  hitting another branch's game.
- `.gitignore`: `games/bluebird-run/assets/raw/`.
- Hub: a card in the root `index.html`, its styles in `src/hub/hub.css`, a real screenshot in
  `public/hub/`, and the hub e2e test extended.

**Boundaries**
- The sim modules are pure and never touch the DOM, canvas or audio.
- The slope is pure data: a new slope is a JSON file, not new code.
- The renderer reads state and never changes it.
- `post.ts` is the single place that defines the final look.
- `touch.ts` turns raw pointer and touch samples into the same input shape as the keyboard, so the sim
  never knows which device is in use.

**Data flow per frame:** keys and touches → input snapshot → the reducer steps the sim at a fixed
60 Hz and emits events → sfx and HUD consume the events → the camera follows the rider → the
renderer draws visible chunks, tracks, sorted sprites and particles into the 360×270 buffer → post
pass (palette snap + sunny grade) → upscale (whole pixels on desktop, fit on a small touch screen) →
HUD update.

## 7. Slope data format

```json
{
  "name": "Pinecone Bowl",
  "length": 360,
  "finish": 350,
  "par": 75,
  "surfaces": [ { "kind": "packed", "rect": [5, 40, 4, 30] }, { "kind": "shade", "rect": [2, 100, 3, 8] } ],
  "gates": [ { "d": 30, "c": [6, 10], "color": "blue" } ],
  "ramps": [ { "d": 80, "c": 8 } ],
  "hazards": [
    { "kind": "tree", "at": [3, 55] },
    { "kind": "rock-s", "at": [9, 60] },
    { "kind": "rock-l", "at": [12, 64] },
    { "kind": "snowman", "at": [7, 120] }
  ],
  "riders": [ { "look": "skier-red", "speed": 3.5, "path": [[8, 90], [5, 110], [11, 130]] } ],
  "flakes": [ [8, 70], [8, 72], [8, 74] ]
}
```

- Coordinates are `[c, d]` in tiles. A `rect` is `[c0, d0, w, h]`. Gate `c` is the two flag
  positions. The pine borders along the powder edges are generated by the loader from a seeded
  pattern, so they aren't listed by hand. Listed trees are the ones out on the piste.
- The loader checks that everything is within bounds, that `finish < length`, that gate flags are
  2–6 tiles apart and that gates are in increasing `d`, that hazard kinds and rider looks are known,
  that rider paths are increasing in `d`, and that no hazard sits on a ramp, inside a gate, or within
  2 tiles of the start. It throws an error that names the bad field.
- A unit test with the headless bot checks that a scripted "careful line" can finish Pinecone Bowl
  with no crashes, which proves the course can be ridden.

## 8. Look and art

- **Palette "Bluebird" (32 colours):** snow whites and pale blue-greys for lit snow, soft periwinkle
  and ice-blue for shadows, packed-trail greys, two pine greens and a dark pine, bark brown, rock
  greys, the sky-blue backdrop, flag blue and flag red, gold for snowflakes, the rider's jacket
  accent colours and a near-black outline. Tested for distinct LUT entries, as in Paper Route.
- **Grade:** one fixed, bright and slightly cool sunny grade baked into the LUT, with warm
  highlights. No phases.
- **Page background:** `postColor(backdrop)`, set on `<html>`, as the other games do.
- **Sprites (PixelLab):** chunky 32 px with dark outlines, and props kept small relative to the
  32 px rider.
  - **Style-lock step (gate):** generate the **snowboarder** (8 directions, bright jacket and beanie,
    board visible) and **one pine tree**, show both in-game on the baked slope, and get the user's
    approval **before** any other art is generated.
  - Then the rider animations: carve lean (if the 8 static directions don't read well enough), an
    air/crouch pose, a grab pose and a tumble. After that come the props: small and big rocks, a
    snowman, blue and red gate flags, the kicker ramp, a golden snowflake (spin frames), the start hut,
    the finish banner, 2–3 other riders (palette-swapped variants where possible), and a few pine
    variants for the borders.
  - Budget about 150 generations, out of about 9,200 available.
- Until art arrives, every sprite has a coloured placeholder box, so the game is playable from day
  one.

## 9. Phone layout

- The canvas uses `canvasScale` from mini-golf: whole-pixel scaling on desktop, and a fractional fit
  on touch screens where the fit is below 2×. The canvas is centred, and the page background fills
  the rest seamlessly.
- In portrait, the canvas sits in the upper middle and the HUD buttons sit below it, in the thumb
  zone. In landscape, the canvas fills the height and the buttons go at the side edges. Safe-area
  insets are respected.
- The whole page is a touch surface for steering, not just the canvas, so the thumb can sit below the
  game in portrait.

## 10. Error handling

- The slope and manifest loaders validate their input and throw named errors. On a boot failure,
  `main.ts` shows an on-page message instead of a blank canvas.
- A runtime error in the loop stops the loop and shows the same banner.
- A missing sprite image falls back to its placeholder and logs a single warning.
- `localStorage` access is wrapped in try/catch. If it fails, the best score and mute setting just
  aren't saved.
- If audio can't start, the game runs silently without errors.

## 11. Testing

- **TDD** for every pure module: the slope loader/validator, `stepBoard` (acceleration, top speed,
  carve braking, powder drag, clamp, auto-straighten), air (ollie, ramp launch timing and height,
  landing), tricks (spin accumulation, clean versus failed landing at the ±35° edges, switch
  landings, scores, names), gates (crossing, streaks, misses), hazards (overlaps, ollie clearance,
  rider paths), the reducer (countdown, ride, crash and invulnerability, finish, run-out, end,
  restart, pause), scoring and best-score storage, the touch gesture interpreter (anchor, drag
  mapping, tap versus drag thresholds, second finger, air grab), carve tracks, particles, the camera,
  the chunk cache, the palette, the post pass, the HUD formatters and the sfx maths.
- Coverage of at least 80% on `sim/`, `game/`, `world/` and the pure input and render helpers.
- **Headless bot:** a scripted run finishes Pinecone Bowl without crashing, and a straight-down run
  is faster but hits something. This proves the slope is ridable and that the hazards matter.
- **Playwright, desktop:** load `/games/bluebird-run/`, start, hold → for a moment, press Space, check
  that the HUD time advances and the score element exists, check the back link, and check there are
  no console errors.
- **Playwright, iPhone 13 profile** (Chromium with CDP touches, as in the mini-golf touch work): tap
  to start, drag to steer (checking that the rider's heading changes through a debug hook on
  `window`), tap to ollie, check that the canvas fits the viewport with no page scroll, and check
  there are no console errors. Run in both portrait and landscape.
- **Hub e2e:** extended to check the Bluebird Run card, its thumbnail and its link.
- **By-eye check** in the browser at the style-lock step and at the end of the slice, on desktop and
  phone-sized viewports.
- All the existing tests and the build for the other games must stay green.

## 12. Arcade hub fit

- Everything lives under `games/bluebird-run/`. Its only root touch points are listed in §6.
- Hub card: **Bluebird Run**, "Carve Pinecone Bowl on a bluebird day. Gates, kickers and a clean
  landing." The thumbnail is a real in-game screenshot.

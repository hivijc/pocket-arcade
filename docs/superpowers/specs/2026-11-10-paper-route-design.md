# Paper Route — Design Spec (one-street slice)

Date: 2026-11-10
Status: Approved in brainstorming, pending written review
Arcade slot: game #2 (game #1 is Backyard Mini-Golf)

## 1. Summary

A cozy isometric pixel-art arcade game for desktop web browsers. On a sunny morning, you ride a bike
up a tiny suburban street. You toss newspapers onto subscribers' porches and into their mailboxes, and
dodge parked cars, puddles, sprinklers and one excitable dog. Runs are short (about 45–70 s), with a
score chase for the best total.

It shares the look of Backyard Mini-Golf: a 360×270 buffer scaled up in whole pixels, a 32-colour
palette, code-baked dithered ground with a grass fringe, and chunky 32 px PixelLab sprites with dark
outlines.

Original work: the newspaper-delivery genre and mechanics only. No name, characters, art, levels or
layout are taken from any existing game.

## 2. Goals and non-goals

**Goals (this slice)**
- One hand-authored street, **Maple Lane**, played from title card to end card. The best score is
  saved in `localStorage`.
- The core loop works and feels good: steering, timed throws, porch and mailbox hits, hazards,
  crashes, paper pickups, and a perfect-delivery bonus.
- Look: daytime only, with one fixed morning grade, no time-of-day cycle and no lamps. The page
  background matches the canvas backdrop, so the game sits on one seamless colour.
- Sound effects only, generated in code. **No music and no ambience.**
- Self-contained under `games/paper-route/`, ready for the arcade hub restructure.

**Non-goals (later)**
- Touch controls (to be borrowed from the mini-golf touch branch), more streets, random or daily
  streets, turns at intersections, subscriber gain and loss across runs, online leaderboards, and a
  hub page.

## 3. Platform and stack

- Desktop web browsers (keyboard).
- TypeScript, Canvas 2D, no game framework. Vite 6, Vitest 5, Playwright, Node 22.
- Engine code is **copied** from mini-golf into the game folder and adapted. Mini-golf's `src/` is not
  moved or edited. The coordinating session will pull out shared engine code after the hub
  restructure.

## 4. World and camera

- **Grid:** the same 2:1 iso projection as mini-golf (`TILE_W = 32`, `TILE_H = 16`, `Z_PX = 16`).
- **Street axes:** the along-street coordinate `s` (tiles from the start) maps to grid
  `y = length − s`, and the across coordinate `c` maps to grid `x`. Riding forward (`s` increasing)
  therefore moves the bike **up-right (↗)** on screen. "Left" means smaller `c` (up-left yards) and
  "right" means larger `c` (down-right yards).
- **Cross-section** (14 tiles across):

  | `c` range | strip |
  |---|---|
  | 0–4 | left lawns (houses, porches, mailboxes at the kerb) |
  | 4–5 | left sidewalk |
  | 5–9 | road (two lanes, centre dashes) |
  | 9–10 | right sidewalk |
  | 10–14 | right lawns |

- **Length:** 12 lots per side, each 10 tiles along, plus a 12-tile run-up and an 8-tile finish:
  140 tiles in total.
- **Camera:** follows the bike so it sits about one third from the bottom-left of the buffer, which
  leaves room to see ahead. Camera motion is smoothed and then rounded to whole buffer pixels, so the
  scroll never shimmers.
- **Terrain bake (approach A, chosen):** the ground is baked in **16-tile chunks** along `s` with the
  mini-golf Bayer and fringe code, adapted to the surfaces road, kerb, sidewalk, lawn and driveway.
  There are 2 wind frames per chunk. Chunks are baked lazily as they come into view and evicted once
  they are behind the camera, so memory stays flat whatever the street length. The street is a
  floating diorama strip with earth sides along its two long edges, like a mini-golf island.

## 5. Gameplay

**Bike**
- Rolls forward on its own. Cruise speed 3 tiles/s, W/↑ speeds up to 4.5, S/↓ slows to 2.
  Acceleration is eased, not instant.
- A/← and D/→ drift across at 4 tiles/s. The bike is clamped to the sidewalks and road (`c` 4–10).
- The sprite uses the 8-direction rider: NE when riding straight, with N or E while drifting.

**Papers**
- 10 papers to start, with a maximum of 15. **Bundles** on the road add 5 each.
- J/Q tosses to the left and K/E tosses to the right. There is a 0.35 s cooldown between tosses.
  With no papers left, a toss plays a "dry" sound and nothing is thrown.
- Flight: a ballistic arc lasting 0.6 s that lands 3.5 tiles to the side of the bike's `c` at the
  moment of the throw, carried forward at the bike's speed. Aiming is therefore all about timing.
  The paper spins (4-frame sprite) and casts a shadow.
- **Mailbox:** the paper hits if it passes through the mailbox footprint (circle, r 0.35) while its
  height is below 1 tile, at any time during the flight.
- **Porch:** the paper hits if it lands inside a house's porch rectangle.

**Houses**
- Each lot has a house, a porch zone and a kerbside mailbox. **Subscriber** houses have a bright
  doormat and a red flag mailbox. Non-subscriber houses have a grey mailbox.
- The slice has 16 subscribers out of 24 houses, set in the street data.

**Scoring** (starting values, tunable in one constants file)
| event | points |
|---|---|
| porch delivery (subscriber) | +250 |
| mailbox delivery (subscriber) | +500 |
| any hit on a non-subscriber house or mailbox | −100 (with a "hey!" bark sfx) |
| dog distracted by a paper | +50 |
| perfect delivery (every subscriber served) at the finish | +2000 |
| papers left at the finish | +25 each |

Each house is served at most once. Its first hit counts and later hits score nothing.

**Hazards**
- **Parked car** (static, on the road's edge lanes): touching it is a crash.
- **Puddle** (static): slows the bike to 2 tiles/s for 1 s and splashes. Not a crash.
- **Sprinkler** (on a lawn, with a spray arc over the sidewalk that is on 1.5 s and off 1.5 s): while
  the spray is on, it slows the bike and wobbles it. Not a crash.
- **Dog** (one per slice): when the bike comes within 6 tiles along of its yard, the dog runs toward
  the bike at 3.8 tiles/s for up to 4 s, then trots home. Touching it is a crash. A paper that lands
  within 0.6 tiles of the dog makes it sit happily for the rest of the run (+50).
- **Crash:** the bike loses 1 of 3 helmets, wobbles for 1.2 s with no steering and no throws, then
  has 1.5 s of blinking invulnerability. Losing the third helmet ends the run.

**Run flow:** title → riding → (crash wobble) → finished or wiped out → end card. The end card shows
deliveries (n/16), accuracy (hits / throws), score, best score, and "R to ride again".

**Keys**
| key | action |
|---|---|
| A/← , D/→ | drift left / right |
| W/↑ , S/↓ | pedal faster / brake |
| J or Q | toss left |
| K or E | toss right |
| Enter or Space | start / continue |
| R | restart run |
| Esc | pause and resume (pause shows a small overlay) |

## 6. Architecture

```
games/paper-route/
  index.html                Vite entry (title "Paper Route")
  src/
    main.ts                 boot: load street + assets, start loop, error banner on failure
    style.css               page background = canvas backdrop (one seamless colour)
    core/
      geometry.ts           copied
      loop.ts               copied (fixed 60 Hz sim step, rAF render)
      input.ts              adapted: held-key set for steer and pedal, edge events for toss, start, restart, pause
    render/
      iso.ts                copied; adds a camera-based View
      palette.ts            copied
      post.ts               simplified: palette snap + one fixed daylight grade (no phases, no lamp bands)
      terrain-bake.ts       adapted: street surfaces, chunked bake
      chunks.ts             chunk cache: which chunks are visible, bake on demand, evict behind the camera
      camera.ts             follow the bike, smoothed, rounded to whole pixels
      wind.ts               copied (8 fps step)
      assets.ts             copied loader for the game's manifest
      renderer.ts           visible chunks + depth-sorted sprites (houses, props, bike, papers, shadows)
    world/
      street.ts             Street type + loader/validator (fails loudly on bad data)
      streets/maple-lane.json
      manifest.ts           sprite manifest types + validation
    sim/
      constants.ts          every tunable number from §5
      bike.ts               stepBike(bike, input, dt) → new bike (pure)
      paper.ts              throwPaper, stepPaper, hit tests (pure)
      hazards.ts            dog and sprinkler steps, overlap tests (pure)
    game/
      state.ts              pure reducer: (state, event | tick) → state
      score.ts              scoring rules, end-of-run totals, best-score storage wrapper
    ui/hud.ts               DOM overlay: score, papers, helmets, title, pause, end card
    audio/sfx.ts            Web Audio sfx: toss, thwack, ding, bark, splash, crash, pickup, dry
  assets/
    palette.json            the "Maple Lane" palette (32 colours)
    manifest.json           frames, anchor, footprint per sprite
    sprites/*.png           PixelLab output, palette-snapped
  scripts/
    ingest.ts               copied from mini-golf, with paths relative to the game folder
    lib/sprite-tools.ts     copied
  tests/
    unit/*.test.ts          Vitest
    e2e/paper-route.spec.ts Playwright smoke test
```

**Root wiring (does not break mini-golf)**
- `vite.config.ts` (new): multi-page `build.rollupOptions.input` = `{ main: 'index.html', paperRoute: 'games/paper-route/index.html' }`.
- `package.json`: `"dev:paper-route": "vite --open /games/paper-route/"` and
  `"ingest:paper-route": "vite-node games/paper-route/scripts/ingest.ts"`.
- `vitest.config.ts`: include adds `games/*/tests/unit/**/*.test.ts`. Coverage include adds
  `games/paper-route/src/{sim,game,world}/**`.
- `tsconfig.json`: include adds `games`.
- `playwright.config.ts`: becomes two projects, `minigolf` (testDir `tests/e2e`, unchanged) and
  `paper-route` (testDir `games/paper-route/tests/e2e`), sharing the existing web server.

**Boundaries**
- The sim modules are pure and never touch the DOM or canvas.
- The street is pure data: a new street is a JSON file, not new code.
- The renderer reads state and never changes it.
- `post.ts` is the single place that defines the final look.

**Data flow per frame:** held keys + edge events → reducer ticks the sim at a fixed 60 Hz → the
camera follows the bike → the renderer draws visible chunks and sorted sprites into the 360×270
buffer → post pass (palette snap + daylight grade) → whole-pixel upscale → HUD update.

## 7. Street data format

```json
{
  "name": "Maple Lane",
  "length": 140,
  "lots": [
    { "side": "L", "s": 12, "house": "house-a", "subscriber": true, "porch": [1, 3, 2, 3], "mailbox": [3.6, 5] }
  ],
  "props": [ { "kind": "tree", "at": [2, 30] } ],
  "hazards": [
    { "kind": "car", "at": [5.5, 40] },
    { "kind": "puddle", "at": [7, 55] },
    { "kind": "sprinkler", "at": [11, 70], "spray": [9, 68, 10, 72] },
    { "kind": "dog", "home": [12, 90] }
  ],
  "bundles": [ [6.5, 48] ]
}
```

- Coordinates are `[c, s]` in tiles. Lot `porch` (`[c0, s0, w, h]`) and `mailbox` (`[c, s]`) are relative to
  the lot origin: `c = 0` for side L, `c = 10` for side R, and `s` = the lot's `s`. Everything else is absolute.
- The loader checks that everything lies within the street's bounds, that lots don't overlap, that
  hazard kinds are known, that there is exactly one dog, and that `length` is at least the last lot's
  end. It throws an error that names the bad field.

## 8. Look and art

- **Palette:** start from Backyard's 32 colours and swap its two night purples (`#2a2450`, `#4b3f7a`)
  for concrete greys (`#8a8a96`, `#b8b8c4`) for sidewalks and kerbs. Asphalt uses the existing dark
  greys.
- **Grade:** one fixed, slightly warm morning grade, baked into the LUT. No phases.
- **Page background:** `postColor(backdrop)`, set on `<html>`, as in mini-golf's `matchPageToCanvas`.
- **Sprites (PixelLab):** chunky 32 px with dark outlines, small props relative to the 32 px rider.
  - **Style-lock step (gate):** generate the **rider on a bike** (8 directions) and **one house**,
    show both in-game on the baked street, and get the user's approval **before** any other art is
    generated.
  - Then: 2 more house variants, subscriber and non-subscriber mailboxes, the paper (4-frame spin), a
    bundle, a car, a puddle, a sprinkler (+ spray frames), the dog (run and sit), a hedge, a tree and
    a picket fence.
  - Budget about 150 generations, out of about 9,400 available.
- Raw PixelLab output goes to `games/paper-route/assets/raw/` (gitignored). The ingest script snaps
  it to the palette, trims it and packs it into sheets.
- Until art arrives, every sprite has a coloured placeholder box, so the game is playable from day one.

## 9. Error handling

- Street and manifest loaders validate their input and throw named errors. On a boot failure,
  `main.ts` shows an on-page message instead of a blank canvas.
- A runtime error in the loop stops the loop and shows the same banner. Mini-golf does the same.
- A missing sprite image falls back to its placeholder and logs a single warning.
- `localStorage` access is wrapped in try/catch. If it fails, the best score just isn't saved.

## 10. Testing

- **TDD** for every pure module: street loader/validator, `stepBike`, paper flight and hit tests,
  dog and sprinkler steps, crash and invulnerability timing, the reducer (start, toss, pickup, crash,
  wipe-out, finish, restart, pause), scoring and best-score storage, the camera, and the chunk cache
  (visible range, bake once, eviction).
- Coverage of at least 80% on `sim/`, `game/` and `world/`.
- **Playwright smoke test:** load `/games/paper-route/`, start a run, toss a paper, and check that
  the papers count in the HUD goes down and that there are no console errors.
- **By-eye check** in the browser at the style-lock step and at the end of the slice.
- Mini-golf's existing tests and build must stay green.

## 11. Arcade hub fit

- Everything lives under `games/paper-route/`. Its only root touch points are the four config lines
  in §6.
- The game reads nothing outside its own folder, so the hub restructure can move or rename it freely.
- Hub card text (for later): **Paper Route**, "Deliver the morning paper down Maple Lane. Mind the dog."

## 12. Slice as built (deviations recorded after implementation)

- **Deferred to a later plan:** driveway surface (§4), picket-fence prop (§8), multi-frame art for the paper spin, the sprinkler spray and the dog run. The renderer already supports frame strips, so these only need art.
- **Doormat:** the subscriber doormat is drawn in code as a flat yellow decal at the centre of the porch (the target), not as part of the house sprite. House sprites are shared by subscribers and non-subscribers.
- **Dog:** it only bites while chasing, and after one bite it trots home (one bite per chase).
- **Riding band:** the bike is clamped to c 4.3–9.7 (spec's 4–10 minus the bike radius).
- **Crash wobble speed:** 1.5 tiles/s, below the normal minimum of 2.
- **Accuracy** = subscriber deliveries ÷ throws.
- **Finish bonus:** papers still in the air count as papers left.

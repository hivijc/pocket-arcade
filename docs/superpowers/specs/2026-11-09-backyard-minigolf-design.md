# Backyard Mini-Golf — Design Spec (3-hole slice)

Date: 2026-11-09
Status: Approved in brainstorming, pending written review

## 1. Summary

A cozy isometric pixel-art mini-golf game for desktop web browsers. Each hole is a small diorama island in the spirit of [iso-hoops](https://vladsez.github.io/iso-hoops/) (a low-res canvas scaled up in whole pixels, dithered ground, grass fraying at the edges, time-of-day lighting, a calm "one more shot" mood). The first slice is one course, **Backyard** (summer afternoon), with **3 holes**.

Art: terrain is drawn by code; the golfer, props, decorations, logo and font come from **PixelLab**. One shared palette and a per-frame post pass make the two sources look like one world.

Inspiration only: no code, art, or assets are copied from iso-hoops. The game, its renderer and its art are original.

## 2. Goals and non-goals

**Goals (this slice)**
- 3 playable Backyard holes, from title card through scorecard, with best total saved in the browser.
- Feel: precise mouse aim, readable slopes, satisfying cup drop and sounds.
- Look: unified palette, dithered code-drawn terrain, PixelLab golfer and props, time-of-day grading, stepped 8 fps wind sway.
- Runs with `npm run dev`; `npm run build` produces static files any host can serve.

**Non-goals (later)**
- More holes or courses, phone/touch controls, multiplayer, online leaderboards, music beyond the ambient loop, hole editor.

## 3. Platform and stack

- Desktop web browsers (mouse + keyboard), plus phones and tablets by touch (added later; see "Touch controls" below).
- TypeScript, Canvas 2D, no game framework.
- Vite (dev server and build), Vitest (unit tests), Playwright (one end-to-end test).

## 4. Architecture

```
src/
  main.ts              boot: load assets, start loop
  core/
    loop.ts            fixed 120 Hz physics step; render on requestAnimationFrame
    input.ts           mouse aim, hold-to-charge (mouse button or Space), R = retry, Esc = menu
  world/
    hole.ts            Hole type + loader/validator (fails loudly on bad data)
    holes/01.json, 02.json, 03.json
  physics/
    terrain.ts         height at a point, slope gradient, surface → friction/bounce
    ball.ts            step(ball, hole, dt) → new ball state (pure, immutable)
  game/
    state.ts           title → intro → aiming → charging → rolling → holed → next / scorecard
    score.ts           strokes, par, labels (Birdie, Par, Bogey...), stroke cap, best total
  render/
    iso.ts             grid ↔ screen projection (2:1 isometric)
    assets.ts          loads sprite sheets from assets/manifest.json
    terrain-draw.ts    code-drawn ground, island sides, fringe; cached once per hole
    renderer.ts        cached terrain + depth-sorted sprites into a 360×270 buffer
    post.ts            palette snap, time-of-day grade, banded light pools
  ui/hud.ts            HTML overlay: hole name, par, strokes, power meter, scorecard
  audio/sfx.ts         sounds generated in code (Web Audio) + ambient loop
assets/
  manifest.json        frames, anchor point, footprint per sprite
  *.png                PixelLab output, palette-snapped
  palette.json         the Backyard palette (~32 colours)
```

**Data flow per frame:** input → game state → `physics.step` (fixed rate, pure) → renderer draws world to the 360×270 buffer → post pass grades and palette-snaps → buffer scaled up to the screen in whole pixels → HUD updates.

**Boundaries**
- Physics never touches rendering; it reads the hole grid and returns new ball state.
- Holes are pure data: a new hole is a JSON file (plus any new prop sprite), not new code.
- The renderer reads state and never changes it.
- `post.ts` is the single place that defines the final look.

## 5. Hole data format

```json
{
  "name": "Gnome Alley",
  "par": 2,
  "size": [12, 8],
  "height": [[0, 0, 0, "..."], "..."],
  "surface": ["GGGGRR...", "..."],
  "walls": [[[x0, y0], [x1, y1]], "..."],
  "tee": [1.5, 4.5],
  "cup": [10.5, 4.5],
  "props": [{ "sprite": "gnome", "at": [6, 2] }]
}
```

- `size`: [width, depth] in tiles.
- `height`: a (depth+1) × (width+1) grid of tile-corner heights, in quarter-tile steps; ramps are tiles whose corners differ. The renderer and physics interpolate the height between corners.
- `surface` letters: `G` green, `R` rough, `S` sand, `W` water, `X` solid (out of play).
- `walls`: line segments on tile edges (fences, borders). The island outer edge is always a wall unless it borders water.
- Props are solid if their manifest entry gives a footprint (circle or box, in tiles).

**Loader validation** (each with a clear error message): `surface` is depth rows × width columns and `height` is (depth+1) × (width+1); only known surface letters; tee and cup on `G` tiles; tee and cup not inside a wall or prop footprint; every prop sprite exists in the manifest; par between 1 and 5.

## 6. Gameplay

**Controls**
- Move the mouse to aim. A dotted aim line runs from the ball toward the cursor, shown for the first ~2 tiles only.
- Hold the left mouse button or Space to charge. The power meter rises to full, then falls back (ping-pong). Release to putt.
- R: retry the hole (+1 stroke penalty). Esc: menu (resume / restart course).

**Golfer**
- A PixelLab character standing beside the ball, facing the nearest of 8 directions to the aim.
- Animations: idle, backswing (while charging), stroke (on release), small celebration (on holed).

**Flow**
1. Title card: "Backyard · 3 holes" and Play.
2. Hole intro: name and par show for ~1.5 s.
3. Play: aim → charge → roll, repeated until the ball is in the cup.
4. Holed: plink, popup with the score label against par, ~1.5 s pause, next hole.
5. After hole 3: scorecard (strokes and par for each hole, total, best total) and Play again.

**Rules**
- A hole is capped at 6 strokes. On reaching 6 without holing, the hole ends and scores 6.
- Water: splash, +1 stroke, ball returns to where it was last struck.
- A ball leaving the island for any reason is treated like water.

## 7. Physics

- Fixed 120 Hz step; the same inputs always give the same results.
- Ball state: position (x, y in tiles), height z, velocity (vx, vy, vz), airborne flag.
- **Rolling:** acceleration from the terrain slope (gravity along the slope); friction per surface: green low, rough high, sand very high.
- **Ramps and hops:** when the ground falls away faster than the ball's path, the ball becomes airborne under gravity and lands with a small bounce that loses most of its vertical speed.
- **Walls:** reflect velocity about the wall normal, keeping ~70% of speed. Prop footprints collide the same way.
- **Cup:** captured if the ball passes within the cup radius below a capture speed. Above it, the ball's path bends slightly (lip-out) and it rolls on.
- **Stop:** below a minimum speed on ground that is flat enough, velocity is zeroed and the next stroke begins.
- Tuning constants (friction, restitution, capture speed, max putt speed) live in one `physics/constants.ts`.

## 8. The three Backyard holes

| # | Name | Par | Idea |
|---|---|---|---|
| 1 | Gnome Alley | 2 | Straight lane with a gentle slope. Teaches aim and power. |
| 2 | Picket Bank | 3 | L-shaped hole; a garden gnome blocks the corner. Bank off the picket fence. |
| 3 | Pool Hop | 3 | A ramp launches over the kiddie pool to a raised green, or take the long way through the rough. |

Each hole fits in the 360×270 buffer with room for the grass fringe and props (about 12×8 tiles at 32 px tile width).

## 9. Rendering and look

- Internal buffer 360×270, scaled to the largest whole-number multiple that fits the window, centred, with crisp pixel scaling.
- **Terrain (code):**
  - Each surface has a shade ramp from the palette; shading comes from slope, a 4×4 Bayer dither and value noise.
  - Banded edges where surfaces meet; island side walls in earth tones.
  - A dithered grass fringe frays the island into the page background.
  - Water is drawn by code and shimmers on wind steps.
  - Terrain is cached to an offscreen canvas once per hole.
- **Sprites:** drawn on top of the terrain cache, sorted by the isometric depth of their anchor point (ball, golfer, props, flag).
- **Wind:** leaves and grass tufts sway in steps at 8 fps.
- **Time of day (post pass):**
  - Phase comes from the local clock: morning 5–10, day 10–17, dusk 17–20, night 20–5.
  - Each phase sets a colour grade (multiply and add per channel) and a shadow direction.
  - At night, lamp posts and string lights add light pools in hard bands.
- **Palette snap:** after grading, every pixel is mapped to the nearest colour in the phase's palette (Backyard palette plus graded variants), which unifies code art and PixelLab art.

## 10. Art pipeline (PixelLab)

**Palette and style lock first**
1. Define the Backyard palette (~32 colours) in `assets/palette.json`.
2. Generate the golfer and gnome; the user approves them before more assets are generated. The approved gnome becomes the style reference for later object jobs.

**Asset list**

| Asset | Tool | Size |
|---|---|---|
| Golfer: 8 directions; idle, backswing, stroke, celebrate | `create_character` (high top-down) + `animate_character` | ~48 px |
| Garden gnome | `create_map_object` or `create_object_pro_flash` | 24–32 px |
| Picket fence: straight, corner, post, in 2 grid orientations | same | 32 px |
| Kiddie pool (water drawn by code inside it) | same | ~64 px |
| Watering can, hose reel, flower pots, bird bath | same | 16–32 px |
| Tree, hedge bush, lamp post, string-light pole | same | 32–96 px |
| Flag, pin, cup rim | `pixelart_workbench` (drawn by hand) | tiny |
| Title logo, pixel font | `create_ui_asset`, `create_font` | — |

Budget: ~80–150 generations, including retries.

**Ingest**
- Every asset is snapped to the palette with `reduce_colors`, saved as a PNG in `assets/`, and added to `manifest.json` with its frames, anchor point and optional footprint.
- The game never calls PixelLab while running; assets are committed to the repo.
- `npm test` includes an asset check: the manifest matches the files on disk, and every pixel is a palette colour or transparent.

## 11. Audio

- All sounds are generated in code with Web Audio: putter tap (pitch scales with power), rolling on grass (volume scales with speed), cup plink, splash, wall tick.
- Ambient bed: birds by day, crickets by night.
- Audio starts after the first user click (a browser rule). The game works muted.

## 12. Error handling

- Asset or hole load failure: an in-game message ("Couldn't load the Backyard — try refreshing"), with details in the console. Never a blank canvas.
- Browser storage unavailable: best scores aren't saved, and play is unaffected.
- Physics escape (ball off the island or a non-finite value): treated like water.
- The hole validator rejects bad data at load with a message naming the file and field.

## 13. Testing

- **Unit tests (Vitest), written before the code they test:**
  - **Physics, using small hand-built test holes:** flat stopping distance, downhill acceleration, wall reflection angle and speed loss, cup capture versus lip-out, water penalty and reset, ramp hop and landing, determinism.
  - **Hole loader:** valid files load; each invalid case fails with the expected message.
  - **Game state and score:** state transitions, score labels against par, the stroke cap, best total persistence (with storage mocked and with storage failing).
  - **Render helpers:** isometric projection round-trip, depth sort order, phase from clock.
  - **Asset check:** manifest against files, palette compliance.
- **End-to-end (Playwright):** load the game, play hole 1 with a scripted aim and release, assert the ball is holed and the HUD stroke count updates.
- **Visual check:** a debug page renders each hole at every time of day for eyeballing.
- **Coverage:** 80%+ on `physics/`, `world/`, `game/`.

## 14. Performance

- Terrain and island cached once per hole. Each frame only redraws the moving parts (ball, golfer, swaying leaves, water shimmer), then the post pass.
- The post pass uses a precomputed lookup table from colour to palette index for each phase, so snapping costs little per pixel at 360×270.
- Target: steady 60 fps on a typical laptop. Total download under 1 MB.

## 15. Definition of done

- All 3 holes playable start to finish; scorecard shown; best total saved.
- PixelLab golfer and props integrated; palette unified; time of day and sound working.
- All tests pass; coverage target met; `npm run build` output runs from a static host.

## Touch controls (added 2026-11-10)

- **Slingshot:** touch or pen pointers (`pointerType`) drag anywhere on the stage. The shot aims opposite the drag on screen. Power runs from 0 at a 14 CSS-px dead zone to 1 at 150 CSS px (`src/game/drag.ts`, `dragShot`). Releasing putts. Dragging back inside the dead zone cancels, with no stroke.
- **State:** a `dragging` phase (`{ kind: 'dragging', power }`) and a `drag` action set the aim and power. `release` putts from `dragging` just as it does from `charging`, and `cancel` and pause drop the drag. The mouse keeps hover-aim and hold-to-charge.
- **Feedback:** the aim dots stay. An orange pull band behind the ball grows with power, the power bar follows the drag, and the golfer's backswing frame tracks the power.
- **Layout:** on coarse-pointer devices below 2× the canvas uses a fractional scale to fill the limiting side (`src/ui/layout.ts`). On-screen Retry and Pause buttons appear only for `(pointer: coarse)`. The stage sets `touch-action: none` and `user-select: none`, the page sets `overscroll-behavior: none`, and the viewport meta disables user zoom.
- **Audio:** the graph is built on the first press and resumed on the first event browsers count as user activation (a touch `pointerup`/`touchend`, not `pointerdown`).

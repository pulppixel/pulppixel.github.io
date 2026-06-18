# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Game Client Engineer portfolio site — Astro static build + Three.js 3D scene + Canvas-2D minigames. Two entry points (`/` classic portfolio, `/explore/` 3D world) share the same project data. Fully static, no backend. Deployed to GitHub Pages via Actions.

`README.md` is the long-form design doc (~1500 lines, Korean) — read it for any non-trivial change to the 3D world, performance system, or minigames. `src/scripts/PROP_GUIDE.md` is mandatory reading before adding voxel landmarks.

## Commands

```bash
npm run dev          # astro dev → http://localhost:4321
npm run build        # static output → ./dist/
npm run preview
```

No test suite, no linter. Verification = `npm run build` succeeds + manual play in the browser. Node 20+ (CI uses Node 22). No env vars, no backend, no secrets.

Debug the 3D scene's perf tier with `?perf=low|medium|high` on `/explore/` — bypasses GPU detection and the FPS auto-downgrade.

## Architecture

### Two entry points, one data source

- `src/pages/index.astro` — classic portfolio. Almost no JS. Project list duplicated here as a local const (Astro-rendered cards).
- `src/pages/explore.astro` — fullscreen Three.js scene; does NOT use `BaseLayout`. Bootstraps `src/scripts/main.ts`.
- `src/pages/projects/{slug}.astro` (×11) — project detail pages, use `ProjectLayout`.
- `src/pages/play/[key].astro` — single Astro file → 6 prerendered minigame routes via `getStaticPaths`. Dynamically imports just the requested minigame module so each page ships only its own game code.

The 3D scene's project cubes (`PROJECTS` in `src/scripts/core/data.ts`) are the canonical definition: zone assignment, position offset, and `minigame` slug mapping all live there. The classic portfolio's project list in `index.astro` is a separate hand-maintained array — **changes to project copy must be made in both places.**

### `src/scripts/` directory split (3D world + minigames)

```
main.ts            entry point + game loop (camera, physics, dispatch)
core/              data, performance tiers, input, helpers, collision, palette
world/             scene graph: terrain, sky, ocean, zones, time/weather/seasons,
                   particles, wind, environment, landmarks/
entity/            character (5 skins), npcs (FSM), animals, interactions
system/            audio (Web Audio synth), postfx, ui, collectibles
minigames/         base.ts (abstract), spody/maze/ruby/circles/nomads/haul
```

Build pipeline in `world/scene.ts` runs in two phases: Phase-1 essentials always built; Phase-2 decorations skipped entirely when `perf.phase2Decor === false`.

### Performance tier system (load-bearing)

`src/scripts/core/performance.ts` exports a global `perf` object set once by `initPerf(gl)` at startup. Every renderer/system reads from it — there is no `isMobile` boolean to branch on. Tiers: `high` / `medium` / `low`. Mobile UA → always `low`. After init, `startFpsMonitor()` samples for ~6s and downgrades one step if avg < 22 FPS, persisting to `sessionStorage`.

When adding any expensive system, branch on `perf.tier` / `perf.shadows` / `perf.particleMul` / `perf.throttleSkip` rather than re-detecting the device. For animation frequency, multiply spawn counts by `perf.particleMul` and gate per-frame work behind `frame % perf.throttleSkip === 0` with `dt *= perf.throttleSkip` to keep lerp speeds constant.

### Draw-call batching is the perf contract

Mobile target was draw calls < 100 over the whole platformer. The mechanism:

- `terrain.ts` accumulates static props into an `_ib` map keyed by `geo+mat`, then `flushInstances(scene)` emits one `InstancedMesh` per group.
- `helpers.ts::stdMat(color, roughness)` is a cached factory — same `(color, roughness)` returns the same `MeshStandardMaterial`. **Never `new MeshStandardMaterial` directly for static props** or instancing breaks.
- Voxel landmarks merge same-color voxels via `mergeGeometries` (see `PROP_GUIDE.md`).

Things deliberately NOT instanced (because per-frame transforms differ): leaves/hedges/flower-heads (wind shakes them), rocks (per-instance random geometry), platforms, fence rails. If you add a new static prop type, decide which side it falls on before writing the loop.

### Time / Weather / Season are independent

`world/timeweather.ts` drives lighting/sky/fog/water-color from a 4-preset interpolation (dawn/day/sunset/night). `world/seasons.ts` independently retints leaf/flower/grass meshes by traversing all materials and matching against `LEAF_HEX/FLOWER_HEX/GRASS_HEX` palettes. `hasTaggedAncestor` (with `userData.isCharacter` / `isAnimal`) excludes characters and animals from seasonal tinting. The two systems compose freely (e.g. "winter + snow + night").

### Audio is fully synthesized

`system/audio.ts` — zero asset files. Web Audio API only. AudioContext starts suspended and resumes on first user input (keydown/click/touch). `getSurface(x, z)` reads platform width to pick `grass / stone / wood` for footstep tone.

### Minigames share `MinigameBase`

All games extend `src/scripts/minigames/base.ts`. Subclasses implement `resetGame / updateGame / renderGame / onClickAt`; the base owns canvas + DPR + input routing + mobile virtual controls + particle/popup pools + audio hooks. Canvas uses logical (CSS) size for game logic with a separate DPR-scaled buffer — read `this.W`/`this.H`, never `canvas.width/height`. (`startLeaderboard / drawLeaderboard / isLeaderboardBusy` remain as no-op stubs after the Supabase removal — games still call them; the result-screen Top10 slot is intentionally empty pending the UI restyle.)

DPR cap is 2.5 (higher than the 3D scene's 1.0 mobile cap — Canvas-2D has the headroom).

### No backend (Supabase removed)

The site was previously backed by Supabase (guestbook + minigame leaderboard via raw REST `fetch`). That was fully removed — the project is now 100% static. There is no DB, no `supabase/` dir, no keep-alive workflow, no client API keys. The guestbook + leaderboard pages and the guestbook minigame were deleted; the leaderboard plumbing in `base.ts` is now no-op stubs (see "Minigames share `MinigameBase`"). Minigames run offline with no score persistence.

When adding a new minigame: extend `MinigameBase`, add the `minigame` slug to the matching `PROJECTS` entry in `data.ts`, add a `getStaticPaths` row in `pages/play/[key].astro`, and add the slug to `MG_KEYS` + the dispatch switch in `main.ts`.

## Conventions worth knowing

- Comments and most identifiers in `src/scripts/` are written in Korean. Keep that consistent when editing nearby code.
- `output: 'static'` in `astro.config.mjs` — no SSR. `getStaticPaths` is the only way to add dynamic routes.
- `tsconfig.json` extends `astro/tsconfigs/base` only. No path aliases — imports are relative.
- Pretendard + JetBrains Mono are loaded from CDN in each layout `<head>`.

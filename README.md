# University of Birmingham — Interactive Campus Map

A polished, interactive 3D digital-twin map of the University of
Birmingham's Edgbaston campus — an orbit/pan/zoom overview you explore by
hovering and clicking buildings, with a dedicated 360° detail viewer for
the campus's hero landmarks. This is a map/digital-twin experience, not a
game: no first-person controls, no HUD, no game mechanics.

Phase 1 vertical slice: **Old Joe** (the Joseph Chamberlain Memorial Clock
Tower) and the **Aston Webb / Great Hall** are fully modelled landmarks
with a dedicated "Explore in 3D" viewer; the wider campus around
Chancellor's Court (Muirhead Tower, the Main Library, the Guild of
Students, Munrow Sports Centre, the Vale Village and others) is
represented with simpler but still fully interactive massing, so the map
reads as a real campus rather than two buildings in a field.

Built with Vite + TypeScript + Three.js. No game engine, no UI framework —
every texture is generated procedurally on a `<canvas>` at startup, and
every building is generated procedurally from plain data.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, hot-reloading dev server
npm run build    # type-checks with tsc, then produces dist/
npm run preview  # serves the production build locally
```

## Using it

- **Drag** to orbit, **scroll** to zoom, **right-drag** to pan (standard
  Three.js OrbitControls scheme).
- **Hover** a building to see its name and a soft highlight ring.
- **Click** a building to fly the camera to it and open its info panel.
- **Explore in 3D** (on the info panel, where available) opens a dedicated
  360° viewer for that building — drag to rotate, scroll to zoom, "Reset
  View" to return to the default framing, "Back to Campus" to return to
  the map.
- **Locations** / **Layers** (bottom-left) list every building for
  quick navigation, and let you toggle whole categories (Academic, Sport,
  Accommodation, ...) on and off.

## File structure

```
src/
  main.ts                      entry point — boots App
  App.ts                       top-level orchestrator: renderer, camera,
                                overview/detail mode switching, wiring

  core/
    CameraTransition.ts        dependency-free eased camera fly-to tween

  world/
    campusData.ts               real-world-derived positions/sizes — the
                                 single source of truth for Old Joe/Aston Webb
    buildings.ts                 the building registry: id, name, category,
                                  description, camera framing, model factory
    CampusScene.ts                assembles terrain + landscaping + every
                                   registered building, tags meshes for picking
    Lighting.ts                   sky, sun, ambient — one polished preset
    Terrain.ts, Landscaping.ts    ground, paths, paving, trees, lamp posts
    ArchitectureKit.ts             reusable procedural building components
    OldJoe.ts, AstonWebb.ts         the two bespoke, fully-modelled landmarks
    GenericBuilding.ts               cheap massing generator for the rest
                                      of the campus (plinth + punched-window
                                      facade + cornice + parapet)

  interaction/
    PickingController.ts        raycasting hover/click against tagged
                                 meshes, hover ring + lift feedback, cursor

  viewer/
    DetailViewer.ts             isolated studio scene + OrbitControls for
                                 "Explore in 3D"

  ui/
    Tooltip.ts                  hover name label
    InfoPanel.ts                 click info card + "Explore in 3D"
    ViewerUI.ts                   Back to Campus / Reset View overlay
    ExplorePanel.ts                Locations list + Layers category toggle

  materials/
    proceduralTextures.ts       CanvasTexture generators (brick, stone,
                                 grass, sky+clouds, window-grid facades, ...)
    materials.ts                 shared MeshStandardMaterial instances
```

**Adding a new building is one entry in `buildings.ts`** — an id, name,
category, description, ground position, camera framing, and a
`buildModel()` factory (either a bespoke module like `OldJoe.ts`, or
`createGenericBuilding(...)` for simple massing). Nothing in the picking,
hover, info panel, Locations list, Layers toggle, or camera-transition code
needs to change.

## Architectural approach

- **1 world unit = 1 metre.** World origin `(0,0,0)` is the ground centre of
  Old Joe. `+X` = east, `+Z` = south. Nothing outside `campusData.ts`
  contains a hand-guessed coordinate — see that file's header for the
  lat/lon → local-metres conversion.
- **One renderer, two scenes.** `App` owns a single `THREE.WebGLRenderer`
  and swaps between the campus overview scene and the `DetailViewer`'s
  isolated studio scene — cheaper and simpler than a second WebGL context.
- **Picking is data-driven.** `CampusScene` tags every mesh belonging to a
  building with `userData.buildingId`; `PickingController` raycasts only
  against that tagged set (never trees/lamps/terrain), so it stays cheap
  as the campus grows and reads results straight back to a
  `BuildingDefinition` — no per-building special-casing anywhere.
- **Procedural geometry kit** (`ArchitectureKit.ts`): `createBrickWall`,
  `createArchedPassageWall`, `createArchedWindow`, `createMullionedWindow`,
  `createDome`, `createTurret`, `createCornice`, `createFrieze`,
  `createStairs`, `createEntranceRecess`, plus a texture-tiling helper
  (`tiledMaterial`) so brick/stone coursing reads at a consistent scale
  regardless of how big or small a wall is. Old Joe and Aston Webb are
  built entirely from these; `GenericBuilding.ts` reuses the same pieces
  for the simplified campus buildings.
- **Instancing**: trees, lamp posts and their glow spheres are drawn with
  `InstancedMesh` — hundreds of them cost only a handful of draw calls.
- **Textures** are all generated at runtime with `CanvasTexture` — no
  downloaded or scraped imagery, so there are no licensing concerns.

## Source / accuracy notes

This is a **real-scale approximation**, not a survey model.

- Old Joe and Aston Webb's anchor coordinates and massing follow public
  map imagery and Historic England's listing descriptions ([Great Hall /
  Quadrant Range](https://historicengland.org.uk/listing/the-list/list-entry/1076133),
  [Chamberlain Tower](https://historicengland.org.uk/listing/the-list/list-entry/1210306)),
  reasoned into procedural geometry — not a photogrammetry scan.
- The wider campus buildings (Muirhead Tower, the Main Library, the Guild
  of Students, the School of Engineering, Computer Science, Munrow Sports
  Centre, the Vale Village, the Bramall Music Building, the Barber
  Institute) are placed at **plausible relative positions**, not surveyed
  footprints, and modelled as simplified massing rather than their real
  architecture — they exist so the map reads as a real campus, not as
  precise reconstructions.
- No University photographs or copyrighted imagery were used anywhere.
- Any future footprint data pulled from OpenStreetMap must be attributed
  "© OpenStreetMap contributors" and comply with the ODbL — none is used
  yet.

## What's deliberately not here yet

- Building interiors (everything is an exterior shell).
- A dedicated detail viewer for the simplified campus buildings — only
  Old Joe and Aston Webb have "Explore in 3D" today; adding it to another
  building is a one-line `detailFraming` addition in `buildings.ts`.
- Search, wayfinding/routing, opening hours, accessibility info.

## Future features this is architected for

- **Search**: `BUILDINGS` is already a flat, fully-described array —
  search is a filter over `name`/`category`/`description`.
- **"Find my way to..."**: `groundPosition` on every building is already
  plain world-space data; routing would path over that plus the existing
  `PATHS` network in `campusData.ts`.
- **More buildings**: one `buildings.ts` entry each, as above.
- **Multiple campus areas**: `CampusScene` doesn't assume a single
  cluster — a second area is another set of `buildings.ts` entries plus a
  camera-framing "jump to area" affordance.
- **Mobile/touch**: OrbitControls already handles touch gestures
  (one-finger rotate, two-finger pinch/pan); the UI panels would need
  responsive breakpoints.
- **Open Day / prospective-student mode**: a filtered `BUILDINGS` subset
  plus a guided sequence of `flyToBuilding` calls — both already exist.

## Known limitations of this pass

- Camera fly-to transitions and CSS panel transitions are driven by
  `requestAnimationFrame`/CSS transitions, which browsers throttle for a
  backgrounded or not-currently-rendered tab — normal in any real,
  focused browser tab.
- Terrain elevation is a small procedural undulation, not survey contour
  data — see `TERRAIN.elevation` in `campusData.ts` to retune it.

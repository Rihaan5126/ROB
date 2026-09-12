// ============================================================================
// materials.ts
//
// Shared, reused material instances. Everything is created once here and
// referenced by geometry across the scene — never re-created per mesh — to
// keep draw calls and GPU memory sane. Per-wall texture tiling (so a huge
// wall and a small pilaster don't share the same brick scale) is applied
// on top of these bases by ArchitectureKit.tiledMaterial().
// ============================================================================

import * as THREE from "three";
import {
  createBrickTexture,
  createBrickNormalTexture,
  createStoneTexture,
  createStoneNormalTexture,
  createTerracottaTexture,
  createDomeMetalTexture,
  createCopperPatinaTexture,
  createPavingTexture,
  createGrassTexture,
  createDarkMetalTexture,
  createRoofSlateTexture,
  createBarkTexture,
  createWindowFacadeTexture,
} from "./proceduralTextures";

// Old Joe is famously deep, dense Accrington brick — near-blood-red and
// almost blue-black in shadow. Aston Webb's brick is a warmer, lighter
// orange-red laid with buff terracotta dressings. Giving them visibly
// different brick tones (sharing one normal map, since the coursing
// geometry is identical) is a big part of each building reading as
// itself rather than a generic red-brick block.
const brickMap = createBrickTexture({ baseColor: "#7a2a1e" });
const brickMapWarm = createBrickTexture({ baseColor: "#a1432b" });
const brickMapRecess = createBrickTexture({ baseColor: "#5c2016" });
const brickNormalMap = createBrickNormalTexture();
const copperPatinaMap = createCopperPatinaTexture();
const stoneMapAshlar = createStoneTexture({ baseColor: "#ded2b8", blockScale: 3 });
const stoneNormalAshlar = createStoneNormalTexture(1024, 3);
const stoneMapDarley = createStoneTexture({ baseColor: "#e6dcc4", blockScale: 5 });
const stoneNormalDarley = createStoneNormalTexture(1024, 5);
const terracottaMap = createTerracottaTexture();
const domeMetalMap = createDomeMetalTexture();
const pavingMap = createPavingTexture();
const grassMap = createGrassTexture();
const darkMetalMap = createDarkMetalTexture();
const roofSlateMap = createRoofSlateTexture();
const barkMap = createBarkTexture();

// Simplified "rest of campus" buildings use a punched-window facade
// texture instead of individually modelled windows — three broad
// material languages covering academic/red-brick, modern glass-and-stone,
// and warm accommodation brick.
const facadeAcademicMap = createWindowFacadeTexture({ wallColor: "#8a3d2a", glassColor: "#3b4550" });
const facadeModernMap = createWindowFacadeTexture({
  wallColor: "#b7bcc0",
  glassColor: "#38516b",
  cols: 8,
  rows: 7,
});
const facadeHallMap = createWindowFacadeTexture({
  wallColor: "#9c5a3a",
  glassColor: "#caa06a",
  cols: 5,
  rows: 6,
});

// Ground/paving get a fixed real-world-ish tiling density up front since
// they're each only used once (not cloned-and-resized per instance like
// the building walls are).
grassMap.repeat.set(80, 80);
pavingMap.repeat.set(22, 22);

export const Materials = {
  brickRed: new THREE.MeshStandardMaterial({
    map: brickMap,
    normalMap: brickNormalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.85,
    metalness: 0.02,
  }),
  brickRedFine: new THREE.MeshStandardMaterial({
    map: brickMap,
    normalMap: brickNormalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.85,
    metalness: 0.02,
  }),
  // Aston Webb's warmer, lighter brick — visibly distinct from Old Joe's
  // deep Accrington red above.
  brickWarm: new THREE.MeshStandardMaterial({
    map: brickMapWarm,
    normalMap: brickNormalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.85,
    metalness: 0.02,
  }),
  // Darker in-shadow brick for recessed blind-arch panels, so the recess
  // reads as genuinely set back rather than just an outlined rectangle.
  brickRecess: new THREE.MeshStandardMaterial({
    map: brickMapRecess,
    normalMap: brickNormalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.9,
    metalness: 0.02,
  }),
  stoneAshlar: new THREE.MeshStandardMaterial({
    map: stoneMapAshlar,
    normalMap: stoneNormalAshlar,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.78,
    metalness: 0.0,
  }),
  stoneDarleyDale: new THREE.MeshStandardMaterial({
    map: stoneMapDarley,
    normalMap: stoneNormalDarley,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.72,
    metalness: 0.0,
  }),
  terracotta: new THREE.MeshStandardMaterial({
    map: terracottaMap,
    roughness: 0.65,
    metalness: 0.05,
  }),
  domeMetal: new THREE.MeshStandardMaterial({
    map: domeMetalMap,
    roughness: 0.32,
    metalness: 0.8,
  }),
  // Weathered green copper — Aston Webb's actual, highly recognisable
  // dome material. Copper patina is a rougher, non-metallic-reading
  // oxide layer, not shiny metal, so roughness is high and metalness low.
  domeCopperPatina: new THREE.MeshStandardMaterial({
    map: copperPatinaMap,
    roughness: 0.75,
    metalness: 0.25,
  }),
  roofSlate: new THREE.MeshStandardMaterial({
    map: roofSlateMap,
    roughness: 0.5,
    metalness: 0.5,
  }),
  paving: new THREE.MeshStandardMaterial({
    map: pavingMap,
    roughness: 0.92,
    metalness: 0.0,
  }),
  grass: new THREE.MeshStandardMaterial({
    map: grassMap,
    roughness: 1.0,
    metalness: 0.0,
  }),
  darkMetal: new THREE.MeshStandardMaterial({
    map: darkMetalMap,
    roughness: 0.45,
    metalness: 0.65,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1b232b"),
    roughness: 0.1,
    metalness: 0.4,
    envMapIntensity: 1.2,
  }),
  // Lighter, sky-reflective glazing for large showcase windows (the Great
  // Hall window) so mullions read clearly instead of merging into a dark
  // blob against the brick — real glass under overcast UK sky looks pale
  // blue-grey, not black.
  glassBright: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#9fb3bd"),
    roughness: 0.08,
    metalness: 0.6,
    envMapIntensity: 1.4,
  }),
  glassWarm: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2a2620"),
    roughness: 0.2,
    metalness: 0.2,
  }),
  clockFace: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#f2ead2"),
    roughness: 0.55,
  }),
  clockHand: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a1a1a"),
    roughness: 0.4,
    metalness: 0.3,
  }),
  trunk: new THREE.MeshStandardMaterial({
    map: barkMap,
    color: new THREE.Color("#8a7256"),
    roughness: 0.95,
  }),
  canopy: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#4f7a3a"),
    roughness: 0.85,
  }),
  canopyAutumn: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#8a6a2f"),
    roughness: 0.9,
  }),
  shrub: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3e6b32"),
    roughness: 0.95,
  }),
  redStack: new THREE.MeshStandardMaterial({
    color: new THREE.Color("#b23a2e"),
    roughness: 0.6,
    metalness: 0.1,
  }),
  facadeAcademic: new THREE.MeshStandardMaterial({
    map: facadeAcademicMap,
    roughness: 0.8,
  }),
  facadeModern: new THREE.MeshStandardMaterial({
    map: facadeModernMap,
    roughness: 0.55,
    metalness: 0.15,
  }),
  facadeHall: new THREE.MeshStandardMaterial({
    map: facadeHallMap,
    roughness: 0.82,
  }),
};

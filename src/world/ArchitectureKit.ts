// ============================================================================
// ArchitectureKit.ts
//
// Reusable procedural building components shared by Old Joe and Aston Webb
// (and available to any future building). Every function returns a
// THREE.Object3D positioned so its local origin sits at the base-centre of
// the element, ready to be placed with .position.set(...).
// ============================================================================

import * as THREE from "three";
import { Materials } from "../materials/materials";

// How many metres of real-world surface one full texture tile represents,
// per base material. Without this, a huge wall (Old Joe's shaft) and a
// small pilaster would show identically-scaled brick, which reads as
// either giant bricks on the small piece or a blurry smear on the big one.
const TILE_METERS = new Map<THREE.Material, number>([
  [Materials.brickRed, 3.2],
  [Materials.brickRedFine, 3.2],
  [Materials.brickWarm, 3.2],
  [Materials.brickRecess, 3.2],
  [Materials.stoneAshlar, 4.5],
  [Materials.stoneDarleyDale, 3.8],
  [Materials.terracotta, 2.8],
  [Materials.roofSlate, 3.2],
  [Materials.facadeAcademic, 20],
  [Materials.facadeModern, 22],
  [Materials.facadeHall, 18],
]);

// A hard ceiling on repeat count regardless of surface size: past this,
// a canvas-generated texture's fine detail (brick coursing especially)
// starts to alias into moire noise on tall/distant surfaces no matter how
// good the tile scale is, so very large surfaces trade a little coursing
// realism for a clean, non-aliased look.
const MAX_REPEAT = 16;

/**
 * Clones a material and its maps with a repeat scaled to the surface's
 * real-world size, so brick/stone coursing reads at a consistent scale
 * regardless of how big or small the surface is. No-op for materials
 * without a texture map (e.g. flat-colour glass).
 */
export function tiledMaterial(
  material: THREE.Material,
  worldWidth: number,
  worldHeight: number
): THREE.Material {
  const std = material as THREE.MeshStandardMaterial;
  if (!std.map) return material;

  const tileMeters = TILE_METERS.get(material) ?? 2.5;
  const repeatX = Math.min(MAX_REPEAT, Math.max(1, worldWidth / tileMeters));
  const repeatY = Math.min(MAX_REPEAT, Math.max(1, worldHeight / tileMeters));

  const mat = std.clone();
  const tex = std.map.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeatX, repeatY);
  mat.map = tex;

  if (std.normalMap) {
    const nTex = std.normalMap.clone();
    nTex.needsUpdate = true;
    nTex.repeat.set(repeatX, repeatY);
    mat.normalMap = nTex;
  }

  return mat;
}

/** Plain brick (or any material) wall slab. Origin at base-centre. */
export function createBrickWall(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material = Materials.brickRed
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, tiledMaterial(material, width, height));
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A wall panel with a real, walkable arched opening cut through it, built
 * as an extruded 2D outline (no boolean/CSG required). Origin at
 * base-centre; the opening is centred horizontally.
 */
export function createArchedPassageWall(
  width: number,
  height: number,
  archWidth: number,
  archHeight: number,
  thickness: number,
  material: THREE.Material = Materials.stoneAshlar
): THREE.Mesh {
  const halfW = width / 2;
  const archHalfW = archWidth / 2;
  const springHeight = Math.max(0.1, archHeight - archHalfW);

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(-halfW, height);
  shape.lineTo(halfW, height);
  shape.lineTo(halfW, 0);
  shape.lineTo(archHalfW, 0);
  shape.lineTo(archHalfW, springHeight);
  shape.absarc(0, springHeight, archHalfW, 0, Math.PI, false);
  shape.lineTo(-archHalfW, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, tiledMaterial(material, width, height));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Decorative round-arched window applied to a wall surface (not a hole). */
export function createArchedWindow(
  width: number,
  height: number,
  frameMaterial: THREE.Material = Materials.stoneDarleyDale,
  glassMaterial: THREE.Material = Materials.glass
): THREE.Group {
  const group = new THREE.Group();
  const halfW = width / 2;
  const archHalfW = halfW;
  const springHeight = Math.max(0.05, height - archHalfW);

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(-halfW, springHeight);
  shape.absarc(0, springHeight, archHalfW, Math.PI, 0, true);
  shape.lineTo(halfW, 0);
  shape.closePath();

  // Local convention throughout this group: -Z is "outward" (toward the
  // viewer standing outside the building), +Z is "inward" (into the
  // wall). The stone surround must sit further inward than the glass, or
  // — being both larger and nearer the camera — it would fully hide the
  // glass and any mullions behind it.
  const glassGeo = new THREE.ShapeGeometry(shape);
  const glass = new THREE.Mesh(glassGeo, glassMaterial);
  glass.position.z = -0.02;
  group.add(glass);

  const frameGeo = new THREE.EdgesGeometry(glassGeo);
  const frame = new THREE.LineSegments(
    frameGeo,
    new THREE.LineBasicMaterial({ color: 0x000000 })
  );
  frame.position.z = -0.03;
  group.add(frame);

  // Stone surround, recessed slightly behind the glass plane so its
  // oversized outline reads as a frame rather than an occluding backplate.
  const surroundGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 16,
  });
  const surround = new THREE.Mesh(surroundGeo, frameMaterial);
  surround.scale.set(1.08, 1.05, 1);
  surround.position.z = 0.1;
  surround.castShadow = true;
  group.add(surround);

  return group;
}

/** Large round-arched window subdivided by vertical mullions (Great Hall). */
export function createMullionedWindow(
  width: number,
  height: number,
  mullionCount: number,
  frameMaterial: THREE.Material = Materials.stoneDarleyDale,
  glassMaterial: THREE.Material = Materials.glass
): THREE.Group {
  const group = createArchedWindow(width, height, frameMaterial, glassMaterial);

  // Dark glazing-bar tone so the mullions read clearly against the glass
  // instead of blending into the (similarly pale) stone surround.
  const mullionMat = Materials.darkMetal;
  for (let i = 1; i < mullionCount; i++) {
    const t = i / mullionCount;
    const x = -width / 2 + t * width;
    const mullionHeight = height * 0.98;
    const geo = new THREE.BoxGeometry(0.14, mullionHeight, 0.1);
    const mullion = new THREE.Mesh(geo, mullionMat);
    mullion.position.set(x, mullionHeight / 2, -0.05);
    group.add(mullion);
  }

  // A horizontal transom about a third of the way up.
  const transomGeo = new THREE.BoxGeometry(width * 0.98, 0.14, 0.1);
  const transom = new THREE.Mesh(transomGeo, mullionMat);
  transom.position.set(0, height * 0.35, -0.05);
  group.add(transom);

  return group;
}

/** Drum + dome + lantern. Origin at base-centre (bottom of the drum). */
export function createDome(
  drumRadius: number,
  drumHeight: number,
  domeHeight: number,
  options?: {
    drumMaterial?: THREE.Material;
    domeMaterial?: THREE.Material;
    lanternHeight?: number;
    segments?: number;
  }
): THREE.Group {
  const group = new THREE.Group();
  const drumMaterial = options?.drumMaterial ?? Materials.stoneAshlar;
  const domeMaterial = options?.domeMaterial ?? Materials.domeMetal;
  const segments = options?.segments ?? 16;

  const drumGeo = new THREE.CylinderGeometry(drumRadius, drumRadius * 1.03, drumHeight, segments);
  const circumference = 2 * Math.PI * drumRadius;
  const drum = new THREE.Mesh(drumGeo, tiledMaterial(drumMaterial, circumference, drumHeight));
  drum.position.y = drumHeight / 2;
  drum.castShadow = true;
  drum.receiveShadow = true;
  group.add(drum);

  const domeRadius = drumRadius * 1.05;
  const domeScaleY = domeHeight / domeRadius;
  const domeGeo = new THREE.SphereGeometry(
    domeRadius,
    Math.max(segments, 12),
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  domeGeo.scale(1, domeScaleY, 1);
  const dome = new THREE.Mesh(domeGeo, domeMaterial);
  dome.position.y = drumHeight;
  dome.castShadow = true;
  group.add(dome);

  const lanternHeight = options?.lanternHeight ?? domeHeight * 0.35;
  if (lanternHeight > 0) {
    const lanternGeo = new THREE.CylinderGeometry(
      domeRadius * 0.12,
      domeRadius * 0.16,
      lanternHeight,
      8
    );
    const lantern = new THREE.Mesh(lanternGeo, drumMaterial);
    lantern.position.y = drumHeight + domeHeight + lanternHeight / 2;
    lantern.castShadow = true;
    group.add(lantern);

    const capGeo = new THREE.ConeGeometry(domeRadius * 0.18, lanternHeight * 0.5, 8);
    const cap = new THREE.Mesh(capGeo, domeMaterial);
    cap.position.y = drumHeight + domeHeight + lanternHeight + (lanternHeight * 0.5) / 2;
    group.add(cap);
  }

  return group;
}

/** Square tapering corner turret with its own small dome. */
export function createTurret(
  size: number,
  shaftHeight: number,
  domeRadius: number,
  domeHeight: number,
  material: THREE.Material = Materials.brickRed,
  domeMaterial: THREE.Material = Materials.domeMetal
): THREE.Group {
  const group = new THREE.Group();

  const shaftGeo = new THREE.BoxGeometry(size, shaftHeight, size);
  const shaft = new THREE.Mesh(shaftGeo, tiledMaterial(material, size, shaftHeight));
  shaft.position.y = shaftHeight / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // A projecting stone band partway up breaks the shaft into two visual
  // stages, the way real turrets read as more than a single brick box.
  const bandY = shaftHeight * 0.55;
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(size * 1.1, 0.3, size * 1.1),
    Materials.stoneDarleyDale
  );
  band.position.y = bandY;
  band.castShadow = true;
  group.add(band);

  const capGeo = new THREE.BoxGeometry(size * 1.08, 0.4, size * 1.08);
  const cap = new THREE.Mesh(capGeo, Materials.stoneDarleyDale);
  cap.position.y = shaftHeight + 0.2;
  cap.castShadow = true;
  group.add(cap);

  const dome = createDome(domeRadius, 0.6, domeHeight, {
    drumMaterial: Materials.stoneDarleyDale,
    domeMaterial,
    lanternHeight: domeHeight * 0.3,
  });
  dome.position.y = shaftHeight + 0.4;
  group.add(dome);

  return group;
}

/** Projecting cornice band running the length of a wall. */
export function createCornice(
  width: number,
  depth: number,
  thickness: number = 0.5,
  material: THREE.Material = Materials.stoneDarleyDale
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, thickness, depth);
  const mesh = new THREE.Mesh(geo, tiledMaterial(material, width, depth));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Decorative frieze band with a row of subtle dentil blocks. */
export function createFrieze(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material = Materials.terracotta
): THREE.Group {
  const group = new THREE.Group();
  const bandGeo = new THREE.BoxGeometry(width, height, depth);
  const band = new THREE.Mesh(bandGeo, tiledMaterial(material, width, height));
  band.castShadow = true;
  band.receiveShadow = true;
  group.add(band);

  const dentilCount = Math.max(4, Math.round(width / 1.2));
  const dentilGeo = new THREE.BoxGeometry(0.35, height * 0.4, 0.15);
  const dentilMat = Materials.stoneDarleyDale;
  for (let i = 0; i < dentilCount; i++) {
    const t = (i + 0.5) / dentilCount - 0.5;
    const dentil = new THREE.Mesh(dentilGeo, dentilMat);
    dentil.position.set(t * width, height * 0.1, depth / 2 + 0.08);
    group.add(dentil);
  }

  return group;
}

/** Simple straight flight of steps, origin at base-centre-front. */
export function createStairs(
  width: number,
  totalRise: number,
  totalRun: number,
  stepCount: number = 5,
  material: THREE.Material = Materials.stoneAshlar
): THREE.Group {
  const group = new THREE.Group();
  const stepHeight = totalRise / stepCount;
  const stepDepth = totalRun / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const stepWidth = width;
    const h = stepHeight * (i + 1);
    const geo = new THREE.BoxGeometry(stepWidth, h, stepDepth);
    const mesh = new THREE.Mesh(geo, tiledMaterial(material, stepWidth, stepDepth));
    mesh.position.set(0, h / 2, -i * stepDepth);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/** A recessed (but not pierced) arched entrance loggia, purely visual. */
export function createEntranceRecess(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material = Materials.stoneAshlar
): THREE.Group {
  const group = new THREE.Group();

  const backWall = createBrickWall(width, height, 0.3, Materials.glassWarm);
  backWall.position.z = -depth;
  group.add(backWall);

  const sideGeo = new THREE.BoxGeometry(0.4, height, depth);
  const left = new THREE.Mesh(sideGeo, tiledMaterial(material, depth, height));
  left.position.set(-width / 2, height / 2, -depth / 2);
  left.castShadow = true;
  left.receiveShadow = true;
  const right = left.clone();
  right.position.x = width / 2;
  group.add(left, right);

  const lintel = createArchedPassageWall(
    width + 0.8,
    height + 1.5,
    width,
    height,
    0.5,
    material
  );
  lintel.position.z = 0.25;
  group.add(lintel);

  return group;
}

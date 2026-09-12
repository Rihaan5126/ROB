// ============================================================================
// GenericBuilding.ts
//
// Extrudes a building's REAL footprint polygon (from campusBuildings.ts,
// sourced from OpenStreetMap) into a simple massed volume — a punched-
// window facade on the real plan shape, a flat roof cap, a thin cornice
// trace, and a paved apron. Not architectural detail, but the *shape* and
// *position* are the real building's, not a generic box — which is what
// actually makes the wider campus map read as accurate.
// ============================================================================

import * as THREE from "three";
import { Materials } from "../materials/materials";
import { tiledMaterial } from "./ArchitectureKit";
import type { RealBuildingSpec, RealBuildingCategory } from "./campusBuildings";

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic per-building seed from its id, so roof clutter is
 * stable across reloads without needing to store anything. */
function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}

function facadeForBuilding(spec: RealBuildingSpec): THREE.Material {
  if (spec.height > 24) return Materials.facadeModern;
  const byCategory: Record<RealBuildingCategory, THREE.Material> = {
    hall: Materials.facadeHall,
    sport: Materials.facadeModern,
    amenity: Materials.facadeAcademic,
    academic: Materials.facadeAcademic,
  };
  return byCategory[spec.category];
}

/** Builds a closed THREE.Shape from a footprint polygon. The z-negation
 * here cancels out the rotateX(-90°) used to lay the extrusion flat below
 * — without it the footprint (and its winding, which determines which
 * way the wall faces point) comes out mirrored north-south. */
function footprintShape(footprint: [number, number][]): THREE.Shape {
  const shape = new THREE.Shape();
  footprint.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  return shape;
}

/** The footprint scaled about its own centroid — used for a solid plinth
 * slab that stands slightly proud of the facade above it. */
function scaledShape(footprint: [number, number][], scale: number): THREE.Shape {
  const shape = new THREE.Shape();
  footprint.forEach(([x, z], i) => {
    const sx = x * scale;
    const sz = -z * scale;
    if (i === 0) shape.moveTo(sx, sz);
    else shape.lineTo(sx, sz);
  });
  shape.closePath();
  return shape;
}

/** A thin hollow border ring around a footprint — the outer boundary
 * scaled out, the same footprint scaled in as a hole, so extruding it
 * yields a genuine thin trim instead of a solid duplicate slab. */
function ringShape(footprint: [number, number][], outerScale: number, innerScale: number): THREE.Shape {
  const outer = new THREE.Shape();
  footprint.forEach(([x, z], i) => {
    const ox = x * outerScale;
    const oz = -z * outerScale;
    if (i === 0) outer.moveTo(ox, oz);
    else outer.lineTo(ox, oz);
  });
  outer.closePath();

  const hole = new THREE.Path();
  footprint.forEach(([x, z], i) => {
    const ix = x * innerScale;
    const iz = -z * innerScale;
    if (i === 0) hole.moveTo(ix, iz);
    else hole.lineTo(ix, iz);
  });
  hole.closePath();
  outer.holes.push(hole);

  return outer;
}

/** Boxy HVAC/plant units, a lift-overrun housing and the odd vent stack
 * — the rooftop clutter every real flat-roofed building has, and the
 * single biggest thing missing when this scene is viewed from directly
 * overhead: a bare, perfectly clean roof plane reads as obviously fake
 * in a way it doesn't from any other angle. Positions are jittered
 * inward from the footprint's bounding box, which is only approximate
 * for a very non-rectangular footprint but is never far enough off to
 * float clutter visibly past a real edge. */
function addRoofClutter(
  group: THREE.Group,
  spec: RealBuildingSpec,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): void {
  if (spec.height < 9) return; // small buildings read cleaner without it

  const rng = mulberry32(seedFromId(spec.id) ^ 0x9e3779b9);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  // Shrink well inside the bounding box — real plant units sit clear of
  // the parapet edge, and this also hedges against non-rectangular
  // footprints where the true edge cuts in closer than the bbox implies.
  const halfW = (bounds.maxX - bounds.minX) * 0.28;
  const halfD = (bounds.maxZ - bounds.minZ) * 0.28;
  if (halfW < 1.5 || halfD < 1.5) return; // footprint too slender for this to read well

  const unitCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < unitCount; i++) {
    const w = 1.6 + rng() * 2.4;
    const d = 1.4 + rng() * 2.0;
    const h = 0.9 + rng() * 1.1;
    const x = cx + (rng() * 2 - 1) * halfW;
    const z = cz + (rng() * 2 - 1) * halfD;

    const unit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Materials.roofPlant);
    unit.position.set(x, spec.height + h / 2, z);
    unit.rotation.y = rng() * Math.PI * 2;
    unit.castShadow = false;
    group.add(unit);

    // A louvred grille band on one face reads as an actual air-handling
    // unit rather than a plain box from a closer/angled view.
    const louvre = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.5, 0.05), Materials.roofPlantLouvre);
    louvre.position.set(0, -h * 0.15, d / 2 + 0.03);
    unit.add(louvre);
  }

  // The occasional vent pipe / stack, taller and thinner than the plant
  // boxes.
  if (rng() < 0.7) {
    const vh = 1.4 + rng() * 1.3;
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, vh, 8), Materials.roofPlantLouvre);
    vent.position.set(cx + (rng() * 2 - 1) * halfW, spec.height + vh / 2, cz + (rng() * 2 - 1) * halfD);
    vent.castShadow = false;
    group.add(vent);
  }
}

export function createRealBuilding(spec: RealBuildingSpec): THREE.Group {
  const group = new THREE.Group();
  const shape = footprintShape(spec.footprint);

  const facade = tiledMaterial(facadeForBuilding(spec), 18, spec.height) as THREE.MeshStandardMaterial;
  const facadeClone = facade.clone();
  facadeClone.map = facade.map;
  facadeClone.normalMap = facade.normalMap;
  facadeClone.side = THREE.DoubleSide; // safety net against footprint winding surprises

  // Tiled at a consistent real-world scale (matching the facade/stone
  // treatment) rather than one image stretched across the whole roof —
  // stretching a single 512px tile over a 70m+ footprint is extreme
  // minification, which is exactly what turns fine texture detail into a
  // "glitchy" shimmer from directly overhead.
  let footMinX = Infinity;
  let footMaxX = -Infinity;
  let footMinZ = Infinity;
  let footMaxZ = -Infinity;
  for (const [fx, fz] of spec.footprint) {
    if (fx < footMinX) footMinX = fx;
    if (fx > footMaxX) footMaxX = fx;
    if (fz < footMinZ) footMinZ = fz;
    if (fz > footMaxZ) footMaxZ = fz;
  }
  const roofMat = tiledMaterial(
    Materials.roofSlate,
    footMaxX - footMinX,
    footMaxZ - footMinZ
  ) as THREE.MeshStandardMaterial;
  roofMat.side = THREE.DoubleSide;

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  // ExtrudeGeometry's two material groups are, perhaps counter-intuitively,
  // group 0 = the top+bottom caps and group 1 = the extruded side walls
  // (verified directly against the generated normals) — the reverse of
  // the "sides first" order it's easy to assume.
  const body = new THREE.Mesh(bodyGeo, [roofMat, facadeClone]);
  // Deliberately no shadow casting/receiving here: the sun's shadow
  // camera frustum is sized for the Chancellor's Court core (see
  // Lighting.ts), and these buildings are scattered across a ~1km real
  // campus — anything outside that frustum samples the shadow map's
  // clamped edge and renders pitch black. Old Joe, Aston Webb and the
  // landscaping near the court still cast/receive shadows normally.
  body.castShadow = false;
  body.receiveShadow = false;
  group.add(body);

  // A thin cornice trace around the roofline: a proper hollow border ring
  // (outer edge scaled out, inner edge scaled in, as a shape hole) rather
  // than a solid duplicate slab — a filled slab would sit on top of and
  // completely hide the actual roof material underneath it.
  const corniceShape = ringShape(spec.footprint, 1.045, 0.98);
  const corniceGeo = new THREE.ExtrudeGeometry(corniceShape, { depth: 0.25, bevelEnabled: false, curveSegments: 1 });
  corniceGeo.rotateX(-Math.PI / 2);
  const cornice = new THREE.Mesh(corniceGeo, Materials.stoneDarleyDale);
  cornice.position.y = spec.height - 0.02;
  cornice.castShadow = false;
  group.add(cornice);

  // A projecting stone plinth at ground level — the base course real
  // institutional buildings almost always have, standing slightly proud
  // of the brick/facade above it.
  const plinthHeight = Math.min(1.3, spec.height * 0.12);
  const plinthShape = scaledShape(spec.footprint, 1.035);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: plinthHeight,
    bevelEnabled: false,
    curveSegments: 1,
  });
  plinthGeo.rotateX(-Math.PI / 2);
  const plinth = new THREE.Mesh(plinthGeo, [Materials.stoneAshlar, Materials.stoneAshlar]);
  plinth.castShadow = false;
  group.add(plinth);

  addRoofClutter(group, spec, { minX: footMinX, maxX: footMaxX, minZ: footMinZ, maxZ: footMaxZ });

  // Paved apron sized to the footprint's real extent.
  let maxR = 6;
  for (const [x, z] of spec.footprint) maxR = Math.max(maxR, Math.hypot(x, z));
  const apronGeo = new THREE.CircleGeometry(maxR + 3, 28);
  apronGeo.rotateX(-Math.PI / 2);
  const apron = new THREE.Mesh(apronGeo, Materials.paving);
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  group.add(apron);

  // No rotation applied here deliberately: the footprint polygon is
  // already in true local (x, z) space (converted directly from real
  // lat/lon), so it's correctly oriented as extruded — rotating the
  // group again would double-rotate it.
  return group;
}

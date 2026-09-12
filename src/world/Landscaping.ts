// ============================================================================
// Landscaping.ts
//
// Procedural trees, lamp posts and shrubs — scattered across the whole
// real campus extent (not just Chancellor's Court), with foundation
// planting (a shrub border) around every one of the 60 registered
// buildings. Trees/shrubs/lamps are all drawn with InstancedMesh so
// hundreds of them cost only a handful of draw calls.
// ============================================================================

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Materials } from "../materials/materials";
import { TREES, LAMP_POSTS, ALL_PATHS, type PathSegment } from "./campusData";
import { BUILDINGS } from "./buildings";

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

/** Bakes a top-lit colour gradient onto a canopy geometry — dark/cool at
 * the shaded base rising to light/warm at the sunlit crown — so
 * per-instance tinting has real shading to multiply against instead of a
 * flat blob of colour. Shared across every tree species. */
function colorizeCanopyByHeight(
  geo: THREE.BufferGeometry,
  darkHex: string,
  lightHex: string,
  gamma = 1.4
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const range = Math.max(0.001, maxY - minY);
  const dark = new THREE.Color(darkHex);
  const light = new THREE.Color(lightHex);
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow((pos.getY(i) - minY) / range, gamma);
    tmp.copy(dark).lerp(light, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildTrunkGeometry(height: number, leanBranches: boolean): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.11 + height * 0.006, 0.22 + height * 0.018, height, 8);
  trunk.translate(0, height / 2, 0);
  const parts: THREE.BufferGeometry[] = [trunk];

  if (leanBranches) {
    const branchA = new THREE.CylinderGeometry(0.05, 0.11, height * 0.45, 6);
    branchA.rotateZ(Math.PI / 3.4);
    branchA.translate(0.7, height * 0.84, 0.15);
    const branchB = new THREE.CylinderGeometry(0.05, 0.1, height * 0.39, 6);
    branchB.rotateZ(-Math.PI / 2.7);
    branchB.rotateY(1.4);
    branchB.translate(-0.6, height * 0.9, -0.35);
    parts.push(branchA, branchB);
  }

  return mergeGeometries(parts);
}

/** Irregular multi-lobe rounded broadleaf canopy — the general "park
 * tree" silhouette, the current default made into one species among
 * several. */
function buildRoundedCanopy(): THREE.BufferGeometry {
  const lobes: [number, number, number, number][] = [
    [0, 4.8, 0, 2.5],
    [1.3, 4.0, 0.7, 1.8],
    [-1.2, 4.2, -0.6, 1.9],
    [0.5, 5.6, -0.9, 1.7],
    [-0.7, 5.3, 0.9, 1.6],
    [1.4, 5.0, -1.3, 1.4],
    [-1.5, 4.6, 1.2, 1.5],
    [0.2, 6.1, 0.3, 1.3],
  ];
  const parts = lobes.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, y, z);
    return g;
  });
  return colorizeCanopyByHeight(mergeGeometries(parts), "#2f5024", "#84a855");
}

/** Tall, narrow, columnar canopy (poplar/conifer-like) — stacked
 * tapering lobes rather than one wide blob, reading as a distinctly
 * different silhouette from across the lawn, not just a recoloured
 * clone. */
function buildConicalCanopy(): THREE.BufferGeometry {
  const lobes: [number, number, number, number][] = [
    [0, 3.6, 0, 1.9],
    [0.3, 5.0, -0.2, 1.7],
    [-0.25, 6.2, 0.2, 1.45],
    [0.2, 7.3, -0.15, 1.15],
    [-0.1, 8.2, 0.1, 0.8],
    [0, 8.9, 0, 0.45],
  ];
  const parts = lobes.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 1.25, 1);
    g.translate(x, y, z);
    return g;
  });
  return colorizeCanopyByHeight(mergeGeometries(parts), "#233d1f", "#5f8a4a", 1.1);
}

/** Wide, flat spreading canopy (oak/plane-like) — lower and broader than
 * the rounded species, dominated by horizontal spread rather than
 * height. */
function buildSpreadingCanopy(): THREE.BufferGeometry {
  const lobes: [number, number, number, number][] = [
    [0, 3.6, 0, 2.6],
    [2.1, 3.3, 1.0, 2.0],
    [-2.0, 3.4, -0.8, 2.1],
    [1.1, 4.3, -1.9, 1.9],
    [-1.3, 4.1, 1.9, 1.8],
    [2.3, 3.0, -1.2, 1.5],
    [0.3, 4.8, 0.4, 1.6],
  ];
  const parts = lobes.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 0.8, 1);
    g.translate(x, y, z);
    return g;
  });
  return colorizeCanopyByHeight(mergeGeometries(parts), "#33501f", "#8fa855", 1.5);
}

interface TreeSpecies {
  name: string;
  weight: number;
  trunkHeight: number;
  leanBranches: boolean;
  buildCanopy: () => THREE.BufferGeometry;
}

const TREE_SPECIES: TreeSpecies[] = [
  { name: "rounded", weight: 0.55, trunkHeight: 4.4, leanBranches: true, buildCanopy: buildRoundedCanopy },
  { name: "conical", weight: 0.2, trunkHeight: 3.8, leanBranches: false, buildCanopy: buildConicalCanopy },
  { name: "spreading", weight: 0.25, trunkHeight: 3.4, leanBranches: true, buildCanopy: buildSpreadingCanopy },
];

function pickSpecies(rng: () => number): number {
  const total = TREE_SPECIES.reduce((s, sp) => s + sp.weight, 0);
  let t = rng() * total;
  for (let i = 0; i < TREE_SPECIES.length; i++) {
    t -= TREE_SPECIES[i].weight;
    if (t <= 0) return i;
  }
  return TREE_SPECIES.length - 1;
}

/** A rounded, slightly flattened shrub blob — smaller/denser than the
 * tree canopy so it reads as clipped foundation planting, not a sapling. */
function buildShrubGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(0.65, 1);
  geo.scale(1, 0.75, 1);
  geo.translate(0, 0.5, 0);
  return geo;
}

function distancePointToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const lenSq = abx * abx + abz * abz;
  let t = lenSq > 0 ? (apx * abx + apz * abz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

function distanceToPath(px: number, pz: number, path: PathSegment): number {
  let min = Infinity;
  for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i];
    const b = path.points[i + 1];
    min = Math.min(min, distancePointToSegment(px, pz, a.x, a.z, b.x, b.z));
  }
  return min;
}

interface PathBounds {
  path: PathSegment;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// With the real OSM path network (400+ segments) added on top of the
// hand-tuned court paths, a full point-to-segment scan of every path for
// every candidate placement (scattering ~1000 trees, each trying up to
// 60 spots) would run the expensive distance math millions of times. A
// cheap bounding-box precheck — computed once — skips the vast majority
// of paths that aren't anywhere near the candidate point.
const PATH_BOUNDS: PathBounds[] = ALL_PATHS.map((path) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of path.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { path, minX, maxX, minZ, maxZ };
});

function isClearOfObstacles(x: number, z: number, minPathClearance: number): boolean {
  for (const b of BUILDINGS) {
    const dist = Math.hypot(x - b.groundPosition.x, z - b.groundPosition.z);
    if (dist < b.footprintRadius + 3) return false;
  }
  for (const pb of PATH_BOUNDS) {
    if (
      x < pb.minX - minPathClearance ||
      x > pb.maxX + minPathClearance ||
      z < pb.minZ - minPathClearance ||
      z > pb.maxZ + minPathClearance
    ) {
      continue;
    }
    if (distanceToPath(x, z, pb.path) < minPathClearance) return false;
  }
  return true;
}

export interface LandscapingResult {
  group: THREE.Group;
  lampGlowMaterial: THREE.MeshStandardMaterial;
}

export function buildLandscaping(heightAt: (x: number, z: number) => number): LandscapingResult {
  const group = new THREE.Group();

  // ---- Trees, scattered across the whole real campus extent ------------
  const rng = mulberry32(TREES.scatterSeed);
  const placements: { x: number; z: number; scale: number; species: number }[] = TREES.specimen.map(
    (t) => ({ x: t.x, z: t.z, scale: t.scale, species: pickSpecies(rng) })
  );

  let minX = -80;
  let maxX = 80;
  let minZ = -20;
  let maxZ = 120;
  for (const b of BUILDINGS) {
    minX = Math.min(minX, b.groundPosition.x - 40);
    maxX = Math.max(maxX, b.groundPosition.x + 40);
    minZ = Math.min(minZ, b.groundPosition.z - 40);
    maxZ = Math.max(maxZ, b.groundPosition.z + 40);
  }

  let attempts = 0;
  const targetCount = TREES.specimen.length + TREES.scatterCount;
  while (placements.length < targetCount && attempts < targetCount * 60) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    if (!isClearOfObstacles(x, z, 4.5)) continue;
    let tooClose = false;
    for (const p of placements) {
      if (Math.hypot(p.x - x, p.z - z) < TREES.minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    placements.push({ x, z, scale: 0.8 + rng() * 0.5, species: pickSpecies(rng) });
  }

  // One InstancedMesh pair per species (each has its own geometry, so
  // they can't share a single InstancedMesh) — trees are grouped by
  // species rather than all sharing one silhouette, so the canopy/lawn
  // reads as a real mixed planting instead of one tree cloned hundreds
  // of times.
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let s = 0; s < TREE_SPECIES.length; s++) {
    const species = TREE_SPECIES[s];
    const speciesPlacements = placements.filter((p) => p.species === s);
    if (speciesPlacements.length === 0) continue;

    const trunkGeo = buildTrunkGeometry(species.trunkHeight, species.leanBranches);
    const canopyGeo = species.buildCanopy();
    // canopyGeo bakes a real per-vertex light/dark colour attribute (see
    // colorizeCanopyByHeight), so vertexColors=true is legitimate here —
    // it multiplies with the per-instance instanceColor tint below for
    // both a shaded/sunlit gradient AND per-tree hue variance.
    const canopyMat = Materials.canopy.clone();
    canopyMat.vertexColors = true;
    // The visible colour now comes entirely from the baked vertex
    // gradient times the per-instance tint (both applied in the shader)
    // — leave the material's own base colour white so it doesn't
    // multiply everything a third time and go too dark.
    canopyMat.color.set(0xffffff);

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, Materials.trunk, speciesPlacements.length);
    const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, speciesPlacements.length);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;

    for (let i = 0; i < speciesPlacements.length; i++) {
      const p = speciesPlacements[i];
      const y = heightAt(p.x, p.z);
      const rotY = rng() * Math.PI * 2;
      // Slight non-uniform stretch per axis so instances of the same
      // canopy geometry don't all read as identical silhouettes.
      const sx = p.scale * (0.9 + rng() * 0.25);
      const sy = p.scale * (0.9 + rng() * 0.3);
      const sz = p.scale * (0.9 + rng() * 0.25);

      dummy.position.set(p.x, y, p.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      canopyMesh.setMatrixAt(i, dummy.matrix);

      // Vertex colours already encode the light/dark canopy gradient, so
      // this instance tint stays close to white — a gentle per-tree hue
      // drift (some cooler/bluer, some warmer/olive) rather than a
      // second full recolour on top of the baked gradient.
      const hueDrift = (rng() - 0.5) * 0.06;
      const brightness = 0.9 + rng() * 0.25;
      color.setHSL(0.29 + hueDrift, 0.45, 0.5 * brightness);
      canopyMesh.setColorAt(i, color);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;

    group.add(trunkMesh, canopyMesh);
  }

  // ---- Lamp posts -----------------------------------------------------
  const lampPositions: { x: number; z: number; rotY: number }[] = [];
  for (const path of ALL_PATHS) {
    const pts = path.points.map((p) => new THREE.Vector2(p.x, p.z));
    const curve = new THREE.SplineCurve(pts);
    const length = curve.getLength();
    const count = Math.max(1, Math.floor(length / LAMP_POSTS.spacingAlongPath));
    const spaced = curve.getSpacedPoints(count);
    for (let i = 1; i < spaced.length - 0; i++) {
      const t = i / count;
      if (t >= 1) continue;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const side = i % 2 === 0 ? 1 : -1;
      const offset = path.width / 2 + 1.1;
      lampPositions.push({
        x: p.x + normal.x * offset * side,
        z: p.y + normal.y * offset * side,
        rotY: Math.atan2(tangent.x, tangent.y),
      });
    }
  }

  const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, LAMP_POSTS.height, 8);
  poleGeo.translate(0, LAMP_POSTS.height / 2, 0);
  const armGeo = new THREE.BoxGeometry(0.5, 0.06, 0.06);
  armGeo.translate(0.25, LAMP_POSTS.height - 0.1, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, Materials.darkMetal, lampPositions.length);
  const armMesh = new THREE.InstancedMesh(armGeo, Materials.darkMetal, lampPositions.length);
  poleMesh.castShadow = true;
  armMesh.castShadow = true;

  const lampGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff2c9,
    emissive: 0xffd98a,
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  const glowGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const glowMesh = new THREE.InstancedMesh(glowGeo, lampGlowMaterial, lampPositions.length);

  for (let i = 0; i < lampPositions.length; i++) {
    const lp = lampPositions[i];
    const y = heightAt(lp.x, lp.z);
    dummy.position.set(lp.x, y, lp.z);
    dummy.rotation.set(0, lp.rotY, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    armMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lp.x + Math.cos(lp.rotY) * 0.5, y + LAMP_POSTS.height - 0.1, lp.z - Math.sin(lp.rotY) * 0.5);
    dummy.updateMatrix();
    glowMesh.setMatrixAt(i, dummy.matrix);
  }
  poleMesh.instanceMatrix.needsUpdate = true;
  armMesh.instanceMatrix.needsUpdate = true;
  glowMesh.instanceMatrix.needsUpdate = true;

  group.add(poleMesh, armMesh, glowMesh);

  // ---- Foundation planting: a shrub border around every building -------
  const shrubRng = mulberry32(71);
  const shrubGeo = buildShrubGeometry();
  const shrubPlacements: { x: number; y: number; z: number; scale: number }[] = [];

  for (const b of BUILDINGS) {
    const ringR = b.footprintRadius + 1.8;
    const count = Math.max(5, Math.min(20, Math.round(b.footprintRadius * 0.9)));
    for (let i = 0; i < count; i++) {
      const t = (i + shrubRng() * 0.4) / count;
      const angle = t * Math.PI * 2;
      const jitter = 0.5 + shrubRng() * 0.6;
      const x = b.groundPosition.x + Math.cos(angle) * (ringR + jitter);
      const z = b.groundPosition.z + Math.sin(angle) * (ringR + jitter);
      shrubPlacements.push({ x, y: heightAt(x, z), z, scale: 0.75 + shrubRng() * 0.6 });
    }
  }

  const shrubMesh = new THREE.InstancedMesh(shrubGeo, Materials.shrub, shrubPlacements.length);
  shrubMesh.castShadow = false;
  shrubMesh.receiveShadow = false;
  for (let i = 0; i < shrubPlacements.length; i++) {
    const s = shrubPlacements[i];
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, shrubRng() * Math.PI * 2, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    shrubMesh.setMatrixAt(i, dummy.matrix);
  }
  shrubMesh.instanceMatrix.needsUpdate = true;
  group.add(shrubMesh);

  return { group, lampGlowMaterial };
}

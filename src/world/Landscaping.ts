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
import { TREES, LAMP_POSTS, PATHS, type PathSegment } from "./campusData";
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

function buildTrunkGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.14, 0.32, 4.4, 8);
  trunk.translate(0, 2.2, 0);

  const branchA = new THREE.CylinderGeometry(0.05, 0.11, 2.0, 6);
  branchA.rotateZ(Math.PI / 3.4);
  branchA.translate(0.7, 3.7, 0.15);

  const branchB = new THREE.CylinderGeometry(0.05, 0.1, 1.7, 6);
  branchB.rotateZ(-Math.PI / 2.7);
  branchB.rotateY(1.4);
  branchB.translate(-0.6, 3.95, -0.35);

  return mergeGeometries([trunk, branchA, branchB]);
}

/** Irregular multi-lobe canopy with a baked top-lit colour gradient (dark,
 * cool at the shaded base rising to a lighter, warmer sunlit crown) so
 * per-instance tinting has real shading to multiply against instead of a
 * flat blob of green. */
function buildCanopyGeometry(): THREE.BufferGeometry {
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
  const geo = mergeGeometries(parts);

  const pos = geo.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const range = Math.max(0.001, maxY - minY);
  const dark = new THREE.Color("#2f5024");
  const light = new THREE.Color("#84a855");
  const colors = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow((pos.getY(i) - minY) / range, 1.4);
    tmp.copy(dark).lerp(light, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geo;
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

function isClearOfObstacles(x: number, z: number, minPathClearance: number): boolean {
  for (const b of BUILDINGS) {
    const dist = Math.hypot(x - b.groundPosition.x, z - b.groundPosition.z);
    if (dist < b.footprintRadius + 3) return false;
  }
  for (const path of PATHS) {
    if (distanceToPath(x, z, path) < minPathClearance) return false;
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
  const placements: { x: number; z: number; scale: number }[] = [
    ...TREES.specimen.map((t) => ({ x: t.x, z: t.z, scale: t.scale })),
  ];

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
    placements.push({ x, z, scale: 0.8 + rng() * 0.5 });
  }

  const trunkGeo = buildTrunkGeometry();
  const canopyGeo = buildCanopyGeometry();
  // canopyGeo now bakes a real per-vertex light/dark colour attribute
  // (see buildCanopyGeometry), so vertexColors=true is legitimate here —
  // it multiplies with the per-instance instanceColor tint below for both
  // a shaded/sunlit gradient AND per-tree hue variance.
  const canopyMat = Materials.canopy.clone();
  canopyMat.vertexColors = true;
  // The visible colour now comes entirely from the baked vertex gradient
  // times the per-instance tint (both applied in the shader) — leave the
  // material's own base colour white so it doesn't multiply everything
  // a third time and go too dark.
  canopyMat.color.set(0xffffff);

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, Materials.trunk, placements.length);
  const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, placements.length);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  canopyMesh.castShadow = true;
  canopyMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
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
    // drift (some cooler/bluer, some warmer/olive) rather than a second
    // full recolour on top of the baked gradient.
    const hueDrift = (rng() - 0.5) * 0.06;
    const brightness = 0.9 + rng() * 0.25;
    color.setHSL(0.29 + hueDrift, 0.45, 0.5 * brightness);
    canopyMesh.setColorAt(i, color);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;

  group.add(trunkMesh, canopyMesh);

  // ---- Lamp posts -----------------------------------------------------
  const lampPositions: { x: number; z: number; rotY: number }[] = [];
  for (const path of PATHS) {
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

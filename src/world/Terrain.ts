// ============================================================================
// Terrain.ts
//
// Ground plane with subtle, configurable elevation, plus the paved paths
// and forecourt/plaza surfaces that sit on top of it. All height data comes
// from one deterministic function so gameplay collision, tree placement and
// the visual mesh always agree.
// ============================================================================

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TERRAIN, ALL_PATHS, PAVING, OLD_JOE, ASTON_WEBB, type PathSegment } from "./campusData";
import { Materials } from "../materials/materials";

function noise2D(x: number, z: number, seed: number): number {
  return (
    Math.sin(x * 0.08 + seed) * Math.cos(z * 0.11 + seed * 0.7) * 0.6 +
    Math.sin(x * 0.19 - seed * 1.3) * Math.cos(z * 0.15 + seed) * 0.4
  );
}

/** The single source of truth for ground height, in metres, at any (x,z). */
export function sampleTerrainHeight(x: number, z: number): number {
  const { amplitude, frequency, seed } = TERRAIN.elevation;
  const raw = noise2D(x * frequency * 10, z * frequency * 10, seed);
  const n = raw * amplitude;

  const distOldJoe = Math.hypot(x - OLD_JOE.position.x, z - OLD_JOE.position.z);
  const distAstonWebb = Math.hypot(x - ASTON_WEBB.position.x, z - ASTON_WEBB.position.z);
  const minDist = Math.min(distOldJoe, distAstonWebb);

  const flattenRadius = 24;
  const blendRadius = 70;
  const t = Math.max(0, Math.min(1, (minDist - flattenRadius) / (blendRadius - flattenRadius)));
  const smooth = t * t * (3 - 2 * t);

  return n * smooth;
}

export class Terrain {
  readonly group = new THREE.Group();

  constructor() {
    this.group.add(this.buildGround());
    this.group.add(this.buildAllPaths());
    this.group.add(this.buildRadialPaving(OLD_JOE.position.x, OLD_JOE.position.z, PAVING.oldJoeRadius));
    this.group.add(this.buildForecourtPaving());
  }

  heightAt(x: number, z: number): number {
    return sampleTerrainHeight(x, z);
  }

  private buildGround(): THREE.Mesh {
    const { size, segments } = TERRAIN;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, sampleTerrainHeight(x, z));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, Materials.grass);
    mesh.receiveShadow = true;
    return mesh;
  }

  /** All ~440 real + hand-tuned path segments merged into one static mesh
   * — a separate draw call per segment would be wasteful when none of
   * them ever move or need independent picking. */
  private buildAllPaths(): THREE.Mesh {
    const geometries = ALL_PATHS.map((path) => this.buildPathGeometry(path));
    const merged = mergeGeometries(geometries);
    const mesh = new THREE.Mesh(merged, Materials.paving);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildPathGeometry(path: PathSegment): THREE.BufferGeometry {
    const pts = path.points.map((p) => new THREE.Vector2(p.x, p.z));
    const curve = new THREE.SplineCurve(pts);
    const sampleCount = Math.max(10, pts.length * 12);
    const samples = curve.getPoints(sampleCount);

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfWidth = path.width / 2;

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const prev = samples[Math.max(0, i - 1)];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      const tangent = new THREE.Vector2().subVectors(next, prev).normalize();
      const normal = new THREE.Vector2(-tangent.y, tangent.x);

      const leftX = p.x + normal.x * halfWidth;
      const leftZ = p.y + normal.y * halfWidth;
      const rightX = p.x - normal.x * halfWidth;
      const rightZ = p.y - normal.y * halfWidth;

      const y = 0.03;
      positions.push(leftX, sampleTerrainHeight(leftX, leftZ) + y, leftZ);
      positions.push(rightX, sampleTerrainHeight(rightX, rightZ) + y, rightZ);
      uvs.push(0, i / samples.length);
      uvs.push(1, i / samples.length);

      if (i > 0) {
        const a = (i - 1) * 2;
        const b = a + 1;
        const c = i * 2;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildRadialPaving(cx: number, cz: number, radius: number): THREE.Mesh {
    const segs = 32;
    const geo = new THREE.CircleGeometry(radius, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      pos.setY(i, sampleTerrainHeight(x, z) + 0.025);
    }
    geo.translate(cx, 0, cz);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, Materials.paving);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildForecourtPaving(): THREE.Mesh {
    const { astonWebbForecourtDepth, astonWebbForecourtWidth } = PAVING;
    const geo = new THREE.PlaneGeometry(astonWebbForecourtWidth, astonWebbForecourtDepth, 20, 10);
    geo.rotateX(-Math.PI / 2);
    const cx = ASTON_WEBB.position.x;
    const cz = ASTON_WEBB.position.z - astonWebbForecourtDepth / 2 - 4;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      pos.setY(i, sampleTerrainHeight(x, z) + 0.02);
    }
    geo.translate(cx, 0, cz);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, Materials.paving);
    mesh.receiveShadow = true;
    return mesh;
  }
}

// ============================================================================
// GenericBuilding.ts
//
// A lightweight massing generator for the "rest of campus" — buildings
// that need to be recognisable and interactive, but don't warrant Old
// Joe/Aston Webb-level bespoke modelling. A stone plinth, a punched-window
// facade (one texture, not modelled windows), a cornice, a parapet and an
// entrance — reusing the same ArchitectureKit primitives as the hero
// landmarks, just assembled much more cheaply.
// ============================================================================

import * as THREE from "three";
import { Materials } from "../materials/materials";
import { createBrickWall, createCornice, createStairs } from "./ArchitectureKit";

export interface GenericBuildingOptions {
  width: number;
  depth: number;
  height: number;
  facadeMaterial: THREE.Material;
  rotationY?: number;
  /** Adds a small entrance canopy + steps on the -Z (front) face. */
  entrance?: boolean;
}

export function createGenericBuilding(opts: GenericBuildingOptions): THREE.Group {
  const group = new THREE.Group();
  const { width, depth, height } = opts;

  const apronGeo = new THREE.CircleGeometry(Math.max(width, depth) * 0.75, 24);
  apronGeo.rotateX(-Math.PI / 2);
  const apron = new THREE.Mesh(apronGeo, Materials.paving);
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  group.add(apron);

  const plinth = createBrickWall(width + 0.5, 0.7, depth + 0.5, Materials.stoneAshlar);
  group.add(plinth);

  const wall = createBrickWall(width, height, depth, opts.facadeMaterial);
  group.add(wall);

  const cornice = createCornice(width + 0.5, depth + 0.5, 0.35, Materials.stoneDarleyDale);
  cornice.position.y = height;
  group.add(cornice);

  const parapet = createBrickWall(width - 0.6, 0.9, depth - 0.6, Materials.stoneAshlar);
  parapet.position.y = height + 0.2;
  group.add(parapet);

  if (opts.entrance) {
    const stairs = createStairs(3.2, 0.5, 1.2, 3, Materials.stoneAshlar);
    stairs.position.set(0, 0, -depth / 2 + 0.05);
    group.add(stairs);
  }

  group.rotation.y = opts.rotationY ?? 0;

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

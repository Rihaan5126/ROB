// ============================================================================
// CampusScene.ts
//
// Assembles the overview map scene: terrain, landscaping and every
// registered building (see buildings.ts). Every mesh belonging to a
// building is tagged with userData.buildingId so the picking controller
// can resolve a raycast hit straight back to a BuildingDefinition — the
// scene itself knows nothing about hovering, clicking or cameras.
// ============================================================================

import * as THREE from "three";
import { Terrain } from "./Terrain";
import { buildLandscaping } from "./Landscaping";
import { Lighting } from "./Lighting";
import { BUILDINGS } from "./buildings";
import { CAMPUS_CONFIG, RED_STACK } from "./campusData";
import { Materials } from "../materials/materials";

export class CampusScene {
  readonly scene = new THREE.Scene();
  readonly lighting: Lighting;
  /** Root object per building id — what the picking controller raycasts
   * against and what the hover/select systems animate. */
  readonly buildingRoots = new Map<string, THREE.Group>();

  private readonly terrain: Terrain;
  private readonly clockUpdaters: ((date: Date) => void)[] = [];

  constructor() {
    this.lighting = new Lighting(this.scene);

    this.terrain = new Terrain();
    this.scene.add(this.terrain.group);

    const landscaping = buildLandscaping((x, z) => this.terrain.heightAt(x, z));
    this.scene.add(landscaping.group);
    landscaping.lampGlowMaterial.emissiveIntensity = this.lighting.lampIntensity;

    for (const def of BUILDINGS) {
      const built = def.buildModel();
      built.group.traverse((obj) => {
        obj.userData.buildingId = def.id;
      });
      this.scene.add(built.group);
      this.buildingRoots.set(def.id, built.group);
      if (built.update) this.clockUpdaters.push(built.update);
    }

    if (CAMPUS_CONFIG.campusEra === "2026") {
      this.scene.add(buildRedStack((x, z) => this.terrain.heightAt(x, z)));
    }
  }

  /** Called once a frame from the main loop. */
  update(date: Date, cameraPosition: THREE.Vector3, elapsed: number, delta: number): void {
    this.lighting.followCamera(cameraPosition, elapsed, delta);
    for (const tick of this.clockUpdaters) tick(date);
  }
}

function buildRedStack(heightAt: (x: number, z: number) => number): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.9, RED_STACK.height, 0.9);
  const y = heightAt(RED_STACK.position.x, RED_STACK.position.z);
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(geo, Materials.redStack);
    const t = i / 4;
    mesh.position.set(
      RED_STACK.position.x + Math.sin(t * 3.1) * 0.35,
      y + RED_STACK.height * (0.5 + i * 0.15),
      RED_STACK.position.z + Math.cos(t * 2.4) * 0.3
    );
    mesh.rotation.y = t * 0.6;
    mesh.rotation.z = t * 0.15;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

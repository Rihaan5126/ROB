// ============================================================================
// DetailViewer.ts
//
// A dedicated, isolated scene for close-up inspection of a single
// building — its own neutral studio backdrop, its own lighting, its own
// full-rotation OrbitControls. Deliberately not the campus scene zoomed
// in: pulling the model out into a clean "product shot" setting is what
// makes it read as a showcase rather than just getting closer to the map.
// ============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BuildingDefinition, CameraFraming } from "../world/buildings";
import { Materials } from "../materials/materials";

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function buildBackdrop(): THREE.Mesh {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#dfe6ec");
  grad.addColorStop(0.55, "#eef2f5");
  grad.addColorStop(1, "#f7f9fa");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.SphereGeometry(220, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(geo, mat);
}

export class DetailViewer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly groundPlane: THREE.Mesh;

  private modelGroup: THREE.Group | null = null;
  private clockUpdate: ((date: Date) => void) | undefined;
  private framing: CameraFraming = {
    target: new THREE.Vector3(0, 10, 0),
    offset: new THREE.Vector3(0, 10, 60),
  };

  // A quick "presenting" reveal each time a model loads — scale pops in
  // with a touch of overshoot while the model spins down to rest, rather
  // than the building just appearing.
  private readonly REVEAL_DURATION = 0.9;
  private readonly REVEAL_SPIN = 0.6; // radians
  private revealElapsed = this.REVEAL_DURATION;

  constructor(domElement: HTMLElement, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);

    this.scene.add(buildBackdrop());

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8574, 1.1);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff6de, 2.2);
    key.position.set(60, 90, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -80;
    key.shadow.camera.right = 80;
    key.shadow.camera.top = 80;
    key.shadow.camera.bottom = -80;
    key.shadow.camera.far = 400;
    key.shadow.radius = 3;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xcfe0ff, 0.6);
    rim.position.set(-50, 40, -60);
    this.scene.add(rim);

    const groundGeo = new THREE.CircleGeometry(140, 48);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundPlane = new THREE.Mesh(groundGeo, Materials.paving);
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Swaps in a fresh model for the given building, recentred at the
   * origin regardless of its position in the campus scene. */
  load(def: BuildingDefinition): void {
    if (this.modelGroup) {
      this.scene.remove(this.modelGroup);
    }
    const built = def.buildModel();
    built.group.position.sub(def.groundPosition);
    this.scene.add(built.group);
    this.modelGroup = built.group;
    this.clockUpdate = built.update;
    this.framing = def.detailFraming ?? {
      target: new THREE.Vector3(0, 10, 0),
      offset: new THREE.Vector3(0, 10, 60),
    };
    this.revealElapsed = 0;
    this.resetView();
  }

  resetView(): void {
    this.camera.position.copy(this.framing.target).add(this.framing.offset);
    this.controls.target.copy(this.framing.target);
    this.controls.update();
  }

  update(date: Date, delta: number): void {
    this.controls.update();
    this.clockUpdate?.(date);

    if (this.modelGroup && this.revealElapsed < this.REVEAL_DURATION) {
      this.revealElapsed = Math.min(this.REVEAL_DURATION, this.revealElapsed + delta);
      const t = this.revealElapsed / this.REVEAL_DURATION;
      this.modelGroup.scale.setScalar(Math.max(0.001, easeOutBack(t)));
      this.modelGroup.rotation.y = (1 - easeOutCubic(t)) * this.REVEAL_SPIN;
    }
  }

  dispose(): void {
    this.controls.dispose();
  }
}

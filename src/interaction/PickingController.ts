// ============================================================================
// PickingController.ts
//
// Three.js raycasting for hover/click against the registered buildings.
// Only meshes tagged with userData.buildingId (see CampusScene) are ever
// tested, so trees/lamps/terrain never interfere and the raycast stays
// cheap however much landscaping detail gets added later.
//
// Hover feedback: a soft glow ring plus a continuously-expanding "radar
// ping" ring underneath the building, and a spring-driven lift (with a
// touch of overshoot, not a flat damp) on the building itself — modern
// map-hover feedback with some life to it, not a game-style flash.
// ============================================================================

import * as THREE from "three";
import { createGlowTexture } from "../materials/proceduralTextures";
import type { BuildingDefinition } from "../world/buildings";

const CLICK_DRAG_THRESHOLD = 6; // px — beyond this, a pointerdown->up is a drag, not a click
const LIFT_SCALE = 1.02;
const PING_PERIOD = 1.4; // seconds per ripple cycle

/** A tiny critically-underdamped spring — gives hover states a touch of
 * lively overshoot instead of a flat, linear settle. */
class Spring {
  value: number;
  private velocity = 0;

  constructor(initial: number) {
    this.value = initial;
  }

  update(target: number, delta: number, stiffness = 170, damping = 15): void {
    const dt = Math.min(delta, 0.05); // guard against huge steps after a tab stall
    const force = (target - this.value) * stiffness - this.velocity * damping;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
  }
}

export class PickingController {
  onHoverChange: ((id: string | null) => void) | null = null;
  onSelect: ((id: string) => void) | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNDC = new THREE.Vector2();
  private readonly pickableMeshes: THREE.Mesh[] = [];
  private readonly buildingsById: Map<string, BuildingDefinition>;
  private readonly domElement: HTMLElement;
  private readonly camera: THREE.Camera;
  private readonly roots: Map<string, THREE.Group>;
  private readonly lifts = new Map<string, Spring>();

  private hoveredId: string | null = null;
  private pointerDownPos: { x: number; y: number } | null = null;
  private enabled = true;
  private pingPhase = 0;

  private readonly hoverRing: THREE.Mesh;
  private readonly pingRing: THREE.Mesh;

  constructor(
    domElement: HTMLElement,
    camera: THREE.Camera,
    scene: THREE.Scene,
    buildingRoots: Map<string, THREE.Group>,
    buildings: BuildingDefinition[]
  ) {
    this.domElement = domElement;
    this.camera = camera;
    this.roots = buildingRoots;
    this.buildingsById = new Map(buildings.map((b) => [b.id, b]));

    for (const root of buildingRoots.values()) {
      this.lifts.set(this.idOf(root), new Spring(1));
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.userData.buildingId) {
          this.pickableMeshes.push(obj);
        }
      });
    }

    const glowTex = createGlowTexture();

    const ringGeo = new THREE.RingGeometry(0.55, 1, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.hoverRing = new THREE.Mesh(ringGeo, ringMat);
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.renderOrder = 10;
    this.hoverRing.visible = false;
    scene.add(this.hoverRing);

    const pingGeo = new THREE.RingGeometry(0.85, 1, 48);
    const pingMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xfff4d6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.pingRing = new THREE.Mesh(pingGeo, pingMat);
    this.pingRing.rotation.x = -Math.PI / 2;
    this.pingRing.renderOrder = 9;
    this.pingRing.visible = false;
    scene.add(this.pingRing);

    domElement.addEventListener("pointermove", this.onPointerMove);
    domElement.addEventListener("pointerdown", this.onPointerDown);
    domElement.addEventListener("pointerup", this.onPointerUp);
    domElement.addEventListener("pointerleave", this.onPointerLeave);
  }

  private idOf(root: THREE.Group): string {
    for (const [id, r] of this.roots) if (r === root) return id;
    return "";
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.setHovered(null);
  }

  private toNDC(e: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private pickAt(e: PointerEvent): string | null {
    this.toNDC(e);
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableMeshes, false);
    for (const hit of hits) {
      const id = hit.object.userData.buildingId as string;
      // Skip buildings hidden by the layers filter — intersectObjects
      // doesn't consult ancestor visibility for a flat mesh list.
      if (this.roots.get(id)?.visible) return id;
    }
    return null;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    const id = this.pickAt(e);
    this.setHovered(id);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.enabled || !this.pointerDownPos) return;
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) return; // it was a drag/orbit, not a click

    const id = this.pickAt(e);
    if (id) this.onSelect?.(id);
  };

  private onPointerLeave = (): void => {
    this.setHovered(null);
  };

  private setHovered(id: string | null): void {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.domElement.style.cursor = id ? "pointer" : "grab";

    if (id) {
      const def = this.buildingsById.get(id);
      if (def) {
        this.pingPhase = 0;
        this.hoverRing.visible = true;
        this.hoverRing.position.set(def.groundPosition.x, 0.05, def.groundPosition.z);
        this.pingRing.visible = true;
        this.pingRing.position.set(def.groundPosition.x, 0.04, def.groundPosition.z);
        const s = def.footprintRadius * 1.15;
        this.hoverRing.scale.set(s, s, 1);
        this.pingRing.userData.baseScale = s;
      }
    }
    this.onHoverChange?.(id);
  }

  /** Called once a frame: fades the hover ring, animates the radar-ping
   * ripple, and springs the subtle hover "lift" on building roots. */
  update(delta: number): void {
    const ringMat = this.hoverRing.material as THREE.MeshBasicMaterial;
    const targetOpacity = this.hoveredId ? 0.55 : 0;
    ringMat.opacity = THREE.MathUtils.damp(ringMat.opacity, targetOpacity, 6, delta);
    if (ringMat.opacity < 0.01 && !this.hoveredId) this.hoverRing.visible = false;

    if (this.hoveredId) {
      this.pingPhase = (this.pingPhase + delta) % PING_PERIOD;
      const t = this.pingPhase / PING_PERIOD;
      const base = (this.pingRing.userData.baseScale as number) ?? 1;
      const scale = base * (1 + t * 0.9);
      this.pingRing.scale.set(scale, scale, 1);
      const pingMat = this.pingRing.material as THREE.MeshBasicMaterial;
      pingMat.opacity = (1 - t) * 0.35;
    } else {
      const pingMat = this.pingRing.material as THREE.MeshBasicMaterial;
      pingMat.opacity = THREE.MathUtils.damp(pingMat.opacity, 0, 8, delta);
      if (pingMat.opacity < 0.01) this.pingRing.visible = false;
    }

    for (const [id, root] of this.roots) {
      const spring = this.lifts.get(id);
      if (!spring) continue;
      spring.update(id === this.hoveredId ? LIFT_SCALE : 1, delta);
      root.scale.setScalar(spring.value);
    }
  }

  get currentHover(): string | null {
    return this.hoveredId;
  }

  dispose(): void {
    this.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.domElement.removeEventListener("pointerup", this.onPointerUp);
    this.domElement.removeEventListener("pointerleave", this.onPointerLeave);
  }
}

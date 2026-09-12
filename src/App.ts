// ============================================================================
// App.ts
//
// Top-level orchestrator for the digital campus map. Owns the renderer and
// the two "modes" the app can be in — the campus overview (orbit/pan/zoom
// map with hoverable, clickable buildings) and the detail viewer (a single
// building pulled out into its own studio scene) — and the transitions
// between them. Everything else (scene content, picking, UI, the detail
// viewer itself) is a separate module; this file only wires them together.
// ============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CampusScene } from "./world/CampusScene";
import { BUILDINGS, getBuilding } from "./world/buildings";
import { PickingController } from "./interaction/PickingController";
import { CameraTransition } from "./core/CameraTransition";
import { DetailViewer } from "./viewer/DetailViewer";
import { Tooltip } from "./ui/Tooltip";
import { InfoPanel } from "./ui/InfoPanel";
import { ViewerUI } from "./ui/ViewerUI";
import { ExplorePanel } from "./ui/ExplorePanel";

type Mode = "overview" | "transitioning" | "detail";

const DEFAULT_TARGET = new THREE.Vector3(0, 20, 120);
const DEFAULT_POSITION = new THREE.Vector3(10, 110, 260);

export class App {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly campus: CampusScene;
  private readonly picking: PickingController;
  private readonly transition = new CameraTransition();
  private readonly detailViewer: DetailViewer;

  private readonly tooltip: Tooltip;
  private readonly infoPanel: InfoPanel;
  private readonly viewerUI: ViewerUI;
  private readonly explorePanel: ExplorePanel;
  private readonly fadeOverlay: HTMLDivElement;

  private readonly timer = new THREE.Timer();
  private mode: Mode = "overview";
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;

    // The container may not be laid out yet (stylesheet still applying,
    // host page mid-reflow) — fall back to the viewport size so the
    // renderer/camera never start from a 0×0 or NaN state. The
    // ResizeObserver set up below corrects this to the real container
    // size on its first callback, which fires immediately.
    const initialWidth = container.clientWidth || window.innerWidth;
    const initialHeight = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    this.renderer.setSize(initialWidth, initialHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.cursor = "grab";
    container.appendChild(this.renderer.domElement);

    const aspect = initialWidth / initialHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.copy(DEFAULT_POSITION);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 480;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.update();

    this.campus = new CampusScene();

    this.picking = new PickingController(
      this.renderer.domElement,
      this.camera,
      this.campus.scene,
      this.campus.buildingRoots,
      BUILDINGS
    );

    this.detailViewer = new DetailViewer(this.renderer.domElement, aspect);

    this.tooltip = new Tooltip(container);
    this.infoPanel = new InfoPanel(container);
    this.viewerUI = new ViewerUI(container);
    this.explorePanel = new ExplorePanel(container, BUILDINGS);
    this.fadeOverlay = this.buildFadeOverlay(container);

    this.wireInteractions();

    // A ResizeObserver (rather than a window "resize" listener) both
    // catches container-driven size changes a window resize wouldn't
    // (e.g. embedding this in a flex/grid layout that reflows) and fires
    // once immediately with the current size — which self-heals the
    // otherwise-real failure mode where the container is still 0×0 at
    // construction time (stylesheet not yet applied, host page still
    // laying out) and would leave the camera aspect NaN forever.
    new ResizeObserver(this.onResize).observe(container);

    if (import.meta.env.DEV) {
      (window as unknown as { __app: App }).__app = this;
    }

    this.animate();
  }

  private buildFadeOverlay(container: HTMLElement): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute; inset: 0;
      background: #eef2f5;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.28s ease;
      z-index: 30;
    `;
    container.appendChild(el);
    return el;
  }

  private async fadeThrough(swap: () => void): Promise<void> {
    this.fadeOverlay.style.opacity = "1";
    await new Promise((r) => setTimeout(r, 280));
    swap();
    await new Promise((r) => setTimeout(r, 30));
    this.fadeOverlay.style.opacity = "0";
  }

  private wireInteractions(): void {
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.tooltip.move(e.clientX, e.clientY);
    });

    this.picking.onHoverChange = (id) => {
      if (id) {
        const def = getBuilding(id);
        if (def) this.tooltip.show(def.name, this.lastPointer.x, this.lastPointer.y);
      } else {
        this.tooltip.hide();
      }
    };

    this.picking.onSelect = (id) => this.flyToBuilding(id);

    this.infoPanel.onClose = () => this.infoPanel.hide();
    this.infoPanel.onExplore = (id) => this.enterDetailView(id);

    this.viewerUI.onBack = () => this.exitDetailView();
    this.viewerUI.onReset = () => this.detailViewer.resetView();

    this.explorePanel.onSelectLocation = (id) => this.flyToBuilding(id);
    this.explorePanel.onToggleCategory = (category, visible) => {
      for (const def of BUILDINGS) {
        if (def.category !== category) continue;
        const root = this.campus.buildingRoots.get(def.id);
        if (root) root.visible = visible;
      }
    };
  }

  private flyToBuilding(id: string): void {
    const def = getBuilding(id);
    if (!def) return;

    this.tooltip.hide();
    this.mode = "transitioning";
    this.controls.enabled = false;

    const toPos = def.overviewFraming.target.clone().add(def.overviewFraming.offset);
    this.transition.start(this.camera.position, this.controls.target, toPos, def.overviewFraming.target, 1.1, () => {
      this.mode = "overview";
      this.controls.enabled = true;
      this.infoPanel.show(def);
    });
  }

  private enterDetailView(id: string): void {
    const def = getBuilding(id);
    if (!def) return;

    this.infoPanel.hide();
    this.picking.setEnabled(false);

    void this.fadeThrough(() => {
      this.detailViewer.setAspect(this.container.clientWidth / this.container.clientHeight);
      this.detailViewer.load(def);
      this.mode = "detail";
      this.viewerUI.show(def.name);
    });
  }

  private exitDetailView(): void {
    void this.fadeThrough(() => {
      this.mode = "overview";
      this.viewerUI.hide();
      this.picking.setEnabled(true);
    });
  }

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return; // not laid out yet — wait for the next callback
    const aspect = clientWidth / clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.detailViewer.setAspect(aspect);
    this.renderer.setSize(clientWidth, clientHeight);
  };

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);
    const now = new Date();

    if (this.mode === "detail") {
      this.detailViewer.update(now);
      this.renderer.render(this.detailViewer.scene, this.detailViewer.camera);
      return;
    }

    if (this.mode === "transitioning") {
      this.transition.update(delta, this.camera.position, this.controls.target);
    }
    this.controls.update();
    this.picking.update(delta);
    this.campus.update(now, this.camera.position);

    this.renderer.render(this.campus.scene, this.camera);
  };
}

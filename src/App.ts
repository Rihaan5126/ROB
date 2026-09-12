// ============================================================================
// App.ts
//
// Top-level orchestrator for the digital campus map. Owns the renderer and
// the two "modes" the app can be in — the campus overview (orbit/pan/zoom
// map with hoverable, clickable buildings) and the detail viewer (a single
// building pulled out into its own studio scene) — and the transitions
// between them, including the opening cinematic camera intro. Everything
// else (scene content, picking, UI, the detail viewer itself) is a
// separate module; this file only wires them together.
// ============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CampusScene } from "./world/CampusScene";
import { BUILDINGS, getBuilding } from "./world/buildings";
import { PickingController } from "./interaction/PickingController";
import { CameraTransition } from "./core/CameraTransition";
import { DetailViewer } from "./viewer/DetailViewer";
import { Tooltip } from "./ui/Tooltip";
import { InfoPanel } from "./ui/InfoPanel";
import { ViewerUI } from "./ui/ViewerUI";
import { ExplorePanel } from "./ui/ExplorePanel";
import { LoadingScreen } from "./ui/LoadingScreen";
import { HeaderBar } from "./ui/HeaderBar";
import { InstructionHint } from "./ui/InstructionHint";

type Mode = "overview" | "transitioning" | "detail";

const DEFAULT_TARGET = new THREE.Vector3(0, 20, 120);
const DEFAULT_POSITION = new THREE.Vector3(10, 110, 260);

// The cinematic intro starts from a dramatic, distant "satellite" framing
// and swoops down into the default establishing shot — the opening beat
// of the whole experience.
const INTRO_START_POSITION = new THREE.Vector3(-140, 280, 440);
const INTRO_START_TARGET = new THREE.Vector3(0, 15, 150);
const INTRO_DURATION = 3.6;

export class App {
  private readonly container: HTMLElement;
  private readonly loadingScreen: LoadingScreen;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private campus!: CampusScene;
  private picking!: PickingController;
  private readonly transition = new CameraTransition();
  private detailViewer!: DetailViewer;

  private overviewComposer!: EffectComposer;
  private detailComposer!: EffectComposer;
  private overviewBloom!: UnrealBloomPass;
  private detailBloom!: UnrealBloomPass;

  private tooltip!: Tooltip;
  private infoPanel!: InfoPanel;
  private viewerUI!: ViewerUI;
  private explorePanel!: ExplorePanel;
  private headerBar!: HeaderBar;
  private instructionHint!: InstructionHint;
  private fadeOverlay!: HTMLDivElement;

  private readonly timer = new THREE.Timer();
  private mode: Mode = "overview";
  private lastPointer = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadingScreen = new LoadingScreen(container);
    this.buildVignette(container);

    // Give the browser a chance to actually paint the loading screen
    // before the (synchronous) procedural texture/geometry generation
    // blocks the main thread — a single rAF often lands before paint,
    // a double rAF reliably lands after it.
    requestAnimationFrame(() => requestAnimationFrame(() => this.init()));
  }

  private init(): void {
    const container = this.container;

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
    container.insertBefore(this.renderer.domElement, container.firstChild);

    const aspect = initialWidth / initialHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.copy(INTRO_START_POSITION);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(INTRO_START_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 480;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.enabled = false;
    this.controls.update();

    this.campus = new CampusScene();

    this.picking = new PickingController(
      this.renderer.domElement,
      this.camera,
      this.campus.scene,
      this.campus.buildingRoots,
      BUILDINGS
    );
    this.picking.setEnabled(false);

    this.detailViewer = new DetailViewer(this.renderer.domElement, aspect);

    this.overviewBloom = new UnrealBloomPass(new THREE.Vector2(initialWidth, initialHeight), 0.32, 0.5, 0.86);
    this.overviewComposer = new EffectComposer(this.renderer);
    this.overviewComposer.addPass(new RenderPass(this.campus.scene, this.camera));
    this.overviewComposer.addPass(this.overviewBloom);
    this.overviewComposer.addPass(new OutputPass());

    this.detailBloom = new UnrealBloomPass(new THREE.Vector2(initialWidth, initialHeight), 0.28, 0.4, 0.88);
    this.detailComposer = new EffectComposer(this.renderer);
    this.detailComposer.addPass(new RenderPass(this.detailViewer.scene, this.detailViewer.camera));
    this.detailComposer.addPass(this.detailBloom);
    this.detailComposer.addPass(new OutputPass());

    this.tooltip = new Tooltip(container);
    this.infoPanel = new InfoPanel(container);
    this.viewerUI = new ViewerUI(container);
    this.explorePanel = new ExplorePanel(container, BUILDINGS);
    this.headerBar = new HeaderBar(container);
    this.instructionHint = new InstructionHint(container);
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
    void this.playIntro();
  }

  private async playIntro(): Promise<void> {
    await this.loadingScreen.hide();

    this.mode = "transitioning";
    this.transition.start(
      this.camera.position,
      this.controls.target,
      DEFAULT_POSITION,
      DEFAULT_TARGET,
      INTRO_DURATION,
      () => {
        this.mode = "overview";
        this.controls.enabled = true;
        this.picking.setEnabled(true);
        this.instructionHint.show();
        this.explorePanel.show();
      }
    );
    this.headerBar.show();
  }

  private buildVignette(container: HTMLElement): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none;
      z-index: 4;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(10,10,14,0.16) 100%);
    `;
    container.appendChild(el);
    return el;
  }

  private buildFadeOverlay(container: HTMLElement): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText = `
      position: absolute; inset: 0;
      background: #fcfcfb;
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

    this.renderer.domElement.addEventListener("pointerdown", () => this.instructionHint.dismiss(), {
      once: true,
    });
    this.renderer.domElement.addEventListener("wheel", () => this.instructionHint.dismiss(), {
      once: true,
      passive: true,
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

    this.instructionHint.dismiss();
    this.tooltip.hide();
    this.mode = "transitioning";
    this.controls.enabled = false;

    const toPos = def.overviewFraming.target.clone().add(def.overviewFraming.offset);
    this.transition.start(this.camera.position, this.controls.target, toPos, def.overviewFraming.target, 1.3, () => {
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
    this.headerBar.hide();
    this.explorePanel.hide();

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
      this.headerBar.show();
      this.explorePanel.show();
    });
  }

  private onResize = (): void => {
    const { clientWidth, clientHeight } = this.container;
    if (clientWidth === 0 || clientHeight === 0) return; // not laid out yet — wait for the next callback
    if (!this.renderer) return; // init() hasn't run yet
    const aspect = clientWidth / clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.detailViewer.setAspect(aspect);
    this.renderer.setSize(clientWidth, clientHeight);
    this.overviewComposer.setSize(clientWidth, clientHeight);
    this.detailComposer.setSize(clientWidth, clientHeight);
    this.overviewBloom.setSize(clientWidth, clientHeight);
    this.detailBloom.setSize(clientWidth, clientHeight);
  };

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);
    const now = new Date();

    if (this.mode === "detail") {
      this.detailViewer.update(now, delta);
      this.detailComposer.render();
      return;
    }

    if (this.mode === "transitioning") {
      this.transition.update(delta, this.camera.position, this.controls.target);
    }
    this.controls.update();
    this.picking.update(delta);
    this.campus.update(now, this.camera.position, this.timer.getElapsed(), delta);

    this.overviewComposer.render();
  };
}

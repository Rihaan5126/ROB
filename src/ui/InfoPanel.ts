// ============================================================================
// InfoPanel.ts
//
// The card that slides in when a building is selected: category, name,
// description and an "Explore in 3D" call to action. Styled as a premium
// glass panel — this is the closest thing to a "HUD" in the whole app, so
// it stays minimal: no icons row, no stats grid, just content and one
// clear action. Content reveals in a quick staggered cascade (category,
// then title, then description, then button) rather than popping in as
// one flat block.
// ============================================================================

import type { BuildingDefinition } from "../world/buildings";

const CATEGORY_LABEL: Record<string, string> = {
  landmark: "Landmark",
  academic: "Academic",
  hall: "Hall",
  sport: "Sport",
  amenity: "Amenity",
};

const KEYFRAMES_ID = "info-panel-keyframes";
const REVEAL_ANIM = "infoPanelReveal 0.5s cubic-bezier(.2,.85,.3,1) both";

function ensureKeyframes(): void {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes infoPanelReveal {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

/** Restarts a CSS animation on an element (setting the same animation
 * string twice is a no-op otherwise). */
function retrigger(el: HTMLElement, delaySeconds: number): void {
  el.style.animation = "none";
  void el.offsetHeight; // force reflow
  el.style.animationDelay = `${delaySeconds}s`;
  el.style.animation = REVEAL_ANIM;
  el.style.animationDelay = `${delaySeconds}s`;
}

export class InfoPanel {
  private readonly panel: HTMLDivElement;
  private readonly categoryEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly descEl: HTMLDivElement;
  private readonly exploreBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  onExplore: ((id: string) => void) | null = null;
  onClose: (() => void) | null = null;

  private currentId: string | null = null;

  constructor(container: HTMLElement) {
    ensureKeyframes();

    this.panel = document.createElement("div");
    this.panel.style.cssText = `
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%) translateX(28px) scale(0.97);
      width: 360px;
      max-width: calc(100vw - 56px);
      padding: 30px 28px 26px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.86);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      box-shadow: 0 24px 60px rgba(20, 20, 30, 0.22), 0 2px 8px rgba(20,20,30,0.08);
      font: 400 14px/1.55 -apple-system, "Segoe UI", Arial, sans-serif;
      color: #1c1c1e;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s cubic-bezier(.22,.9,.3,1), transform 0.45s cubic-bezier(.22,1.2,.3,1);
      z-index: 15;
    `;

    this.closeBtn = document.createElement("button");
    this.closeBtn.textContent = "✕";
    this.closeBtn.setAttribute("aria-label", "Close");
    this.closeBtn.style.cssText = `
      position: absolute; top: 18px; right: 18px;
      width: 30px; height: 30px; border-radius: 50%;
      border: none; background: rgba(0,0,0,0.06); color: #444;
      font-size: 13px; cursor: pointer; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease, transform 0.15s ease;
    `;
    this.closeBtn.addEventListener("mouseenter", () => {
      this.closeBtn.style.background = "rgba(0,0,0,0.12)";
      this.closeBtn.style.transform = "rotate(90deg)";
    });
    this.closeBtn.addEventListener("mouseleave", () => {
      this.closeBtn.style.background = "rgba(0,0,0,0.06)";
      this.closeBtn.style.transform = "rotate(0deg)";
    });
    this.closeBtn.addEventListener("click", () => this.onClose?.());
    this.panel.appendChild(this.closeBtn);

    this.categoryEl = document.createElement("div");
    this.categoryEl.style.cssText = `
      display: inline-block;
      font: 600 11px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: #8a1f2b;
      background: rgba(138, 31, 43, 0.09);
      padding: 5px 11px;
      border-radius: 999px;
      margin-bottom: 14px;
    `;
    this.panel.appendChild(this.categoryEl);

    this.titleEl = document.createElement("div");
    this.titleEl.style.cssText = `
      font: 600 24px/1.25 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: -0.01em;
      color: #111;
      margin-bottom: 12px;
    `;
    this.panel.appendChild(this.titleEl);

    this.descEl = document.createElement("div");
    this.descEl.style.cssText = `
      color: #45454a;
      margin-bottom: 22px;
    `;
    this.panel.appendChild(this.descEl);

    this.exploreBtn = document.createElement("button");
    this.exploreBtn.textContent = "Explore in 3D";
    this.exploreBtn.style.cssText = `
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%;
      padding: 13px 16px;
      border: none; border-radius: 12px;
      background: #7a1a28;
      color: #fff;
      font: 600 14px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    `;
    this.exploreBtn.addEventListener("mouseenter", () => {
      this.exploreBtn.style.background = "#8f1f30";
      this.exploreBtn.style.boxShadow = "0 6px 18px rgba(122,26,40,0.35)";
      this.exploreBtn.style.transform = "translateY(-1px)";
    });
    this.exploreBtn.addEventListener("mouseleave", () => {
      this.exploreBtn.style.background = "#7a1a28";
      this.exploreBtn.style.boxShadow = "none";
      this.exploreBtn.style.transform = "translateY(0)";
    });
    this.exploreBtn.addEventListener("mousedown", () => (this.exploreBtn.style.transform = "scale(0.97)"));
    this.exploreBtn.addEventListener("mouseup", () => (this.exploreBtn.style.transform = "translateY(-1px)"));
    this.exploreBtn.addEventListener("click", () => {
      if (this.currentId) this.onExplore?.(this.currentId);
    });
    this.panel.appendChild(this.exploreBtn);

    container.appendChild(this.panel);
  }

  show(building: BuildingDefinition): void {
    this.currentId = building.id;
    this.categoryEl.textContent = CATEGORY_LABEL[building.category] ?? building.category;
    this.titleEl.textContent = building.name;
    this.descEl.textContent = building.description;
    this.exploreBtn.style.display = building.hasDetailView ? "flex" : "none";

    this.panel.style.opacity = "1";
    this.panel.style.pointerEvents = "auto";
    this.panel.style.transform = "translateY(-50%) translateX(0) scale(1)";

    retrigger(this.categoryEl, 0.08);
    retrigger(this.titleEl, 0.14);
    retrigger(this.descEl, 0.2);
    if (building.hasDetailView) retrigger(this.exploreBtn, 0.26);
  }

  hide(): void {
    this.currentId = null;
    this.panel.style.opacity = "0";
    this.panel.style.pointerEvents = "none";
    this.panel.style.transform = "translateY(-50%) translateX(28px) scale(0.97)";
  }

  get isOpen(): boolean {
    return this.currentId !== null;
  }
}

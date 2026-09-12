// ============================================================================
// ExplorePanel.ts
//
// Bottom-left "Locations" / "Layers" control, in the spirit of standard
// campus wayfinding maps: a Locations tab lists every registered building
// (click one to fly to it, same as clicking it directly on the map), and
// a Layers tab toggles whole categories on/off. Both read straight off
// the BuildingDefinition registry, so a newly added building appears in
// both automatically.
// ============================================================================

import type { BuildingDefinition, BuildingCategory } from "../world/buildings";

const CATEGORY_META: Record<BuildingCategory, { label: string; color: string }> = {
  landmark: { label: "Landmark", color: "#7a1a28" },
  academic: { label: "Academic", color: "#2f6b8a" },
  hall: { label: "Accommodation", color: "#a15b1f" },
  sport: { label: "Sport", color: "#2f8a5b" },
  amenity: { label: "Amenity", color: "#6a4c93" },
};

type Tab = "locations" | "layers";

export class ExplorePanel {
  onSelectLocation: ((id: string) => void) | null = null;
  onToggleCategory: ((category: BuildingCategory, visible: boolean) => void) | null = null;

  private readonly panel: HTMLDivElement;
  private readonly locationsBtn: HTMLButtonElement;
  private readonly layersBtn: HTMLButtonElement;
  private readonly buildings: BuildingDefinition[];
  private activeTab: Tab | null = null;
  private readonly hiddenCategories = new Set<BuildingCategory>();

  constructor(container: HTMLElement, buildings: BuildingDefinition[]) {
    this.buildings = buildings;
    const dock = document.createElement("div");
    dock.style.cssText = `
      position: absolute; left: 28px; bottom: 28px;
      display: flex; flex-direction: column-reverse;
      align-items: flex-start; gap: 12px;
      z-index: 14;
      font: 400 14px/1.4 -apple-system, "Segoe UI", Arial, sans-serif;
    `;

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex; gap: 10px;";
    this.locationsBtn = this.makeTabButton("Locations");
    this.layersBtn = this.makeTabButton("Layers");
    this.locationsBtn.addEventListener("click", () => this.toggle("locations"));
    this.layersBtn.addEventListener("click", () => this.toggle("layers"));
    buttonRow.appendChild(this.locationsBtn);
    buttonRow.appendChild(this.layersBtn);

    this.panel = document.createElement("div");
    this.panel.style.cssText = `
      width: 300px;
      max-height: 46vh;
      overflow-y: auto;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(18px) saturate(160%);
      -webkit-backdrop-filter: blur(18px) saturate(160%);
      box-shadow: 0 20px 50px rgba(20,20,30,0.2);
      padding: 8px;
      opacity: 0;
      transform: translateY(12px) scale(0.98);
      transform-origin: bottom left;
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.3s cubic-bezier(.2,1.3,.3,1);
    `;

    dock.appendChild(this.panel);
    dock.appendChild(buttonRow);
    container.appendChild(dock);
  }

  private makeTabButton(label: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `
      padding: 11px 20px;
      border-radius: 999px;
      border: none;
      background: rgba(20,20,22,0.78);
      backdrop-filter: blur(10px);
      color: #fff;
      font: 600 13px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      transition: background 0.15s ease;
    `;
    return btn;
  }

  private setActiveButtonStyle(): void {
    for (const [btn, tab] of [
      [this.locationsBtn, "locations"],
      [this.layersBtn, "layers"],
    ] as const) {
      btn.style.background = this.activeTab === tab ? "#7a1a28" : "rgba(20,20,22,0.78)";
    }
  }

  private toggle(tab: Tab): void {
    if (this.activeTab === tab) {
      this.activeTab = null;
    } else {
      this.activeTab = tab;
      this.render();
    }
    this.setActiveButtonStyle();
    const open = this.activeTab !== null;
    this.panel.style.opacity = open ? "1" : "0";
    this.panel.style.transform = open ? "translateY(0)" : "translateY(8px)";
    this.panel.style.pointerEvents = open ? "auto" : "none";
  }

  private render(): void {
    this.panel.innerHTML = "";
    if (this.activeTab === "locations") this.renderLocations();
    else if (this.activeTab === "layers") this.renderLayers();
  }

  private renderLocations(): void {
    for (const b of this.buildings) {
      const row = document.createElement("button");
      row.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        width: 100%; text-align: left;
        padding: 10px 12px;
        border: none; background: transparent;
        border-radius: 10px;
        cursor: pointer;
        font: 500 13.5px/1.3 -apple-system, "Segoe UI", Arial, sans-serif;
        color: #1c1c1e;
      `;
      row.addEventListener("mouseenter", () => (row.style.background = "rgba(0,0,0,0.055)"));
      row.addEventListener("mouseleave", () => (row.style.background = "transparent"));

      const dot = document.createElement("span");
      dot.style.cssText = `
        width: 9px; height: 9px; border-radius: 50%; flex: none;
        background: ${CATEGORY_META[b.category].color};
      `;
      row.appendChild(dot);

      const label = document.createElement("span");
      label.textContent = b.name;
      row.appendChild(label);

      row.addEventListener("click", () => this.onSelectLocation?.(b.id));
      this.panel.appendChild(row);
    }
  }

  private renderLayers(): void {
    const categories = Array.from(new Set(this.buildings.map((b) => b.category)));
    for (const category of categories) {
      const row = document.createElement("label");
      row.style.cssText = `
        display: flex; align-items: center; gap: 11px;
        width: 100%; padding: 10px 12px;
        border-radius: 10px;
        cursor: pointer;
        font: 500 13.5px/1.3 -apple-system, "Segoe UI", Arial, sans-serif;
        color: #1c1c1e;
      `;
      row.addEventListener("mouseenter", () => (row.style.background = "rgba(0,0,0,0.055)"));
      row.addEventListener("mouseleave", () => (row.style.background = "transparent"));

      const swatch = document.createElement("span");
      swatch.style.cssText = `
        width: 14px; height: 14px; border-radius: 4px; flex: none;
        background: ${CATEGORY_META[category].color};
      `;
      row.appendChild(swatch);

      const label = document.createElement("span");
      label.style.flex = "1";
      label.textContent = CATEGORY_META[category].label;
      row.appendChild(label);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !this.hiddenCategories.has(category);
      checkbox.style.cssText = "width: 16px; height: 16px; accent-color: #7a1a28;";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.hiddenCategories.delete(category);
        else this.hiddenCategories.add(category);
        this.onToggleCategory?.(category, checkbox.checked);
      });
      row.appendChild(checkbox);

      this.panel.appendChild(row);
    }
  }
}

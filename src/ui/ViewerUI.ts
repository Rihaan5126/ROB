// ============================================================================
// ViewerUI.ts
//
// Minimal chrome for the detail viewer: a title, "Back to Campus", and
// "Reset View". Nothing else — the model is the point.
// ============================================================================

export class ViewerUI {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;

  onBack: (() => void) | null = null;
  onReset: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.4s ease;
      z-index: 25;
    `;

    const topBar = document.createElement("div");
    topBar.style.cssText = `
      position: absolute; top: 24px; left: 28px; right: 28px;
      display: flex; align-items: center; justify-content: space-between;
      pointer-events: none;
    `;

    this.backBtn = this.makeButton("← Back to Campus");
    this.backBtn.style.pointerEvents = "auto";
    this.backBtn.addEventListener("click", () => this.onBack?.());
    topBar.appendChild(this.backBtn);

    this.titleEl = document.createElement("div");
    this.titleEl.style.cssText = `
      font: 600 15px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      color: #fff;
      text-shadow: 0 1px 6px rgba(0,0,0,0.4);
      letter-spacing: 0.01em;
    `;
    topBar.appendChild(this.titleEl);

    this.resetBtn = this.makeButton("Reset View");
    this.resetBtn.style.pointerEvents = "auto";
    this.resetBtn.addEventListener("click", () => this.onReset?.());
    topBar.appendChild(this.resetBtn);

    this.root.appendChild(topBar);

    const hint = document.createElement("div");
    hint.style.cssText = `
      position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%);
      font: 400 12px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      color: rgba(255,255,255,0.75);
      text-shadow: 0 1px 6px rgba(0,0,0,0.4);
      letter-spacing: 0.02em;
    `;
    hint.textContent = "Drag to rotate · Scroll to zoom";
    this.root.appendChild(hint);

    container.appendChild(this.root);
  }

  private makeButton(label: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `
      padding: 10px 18px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(20,20,22,0.4);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #fff;
      font: 500 13px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      cursor: pointer;
      transition: background 0.15s ease;
    `;
    btn.addEventListener("mouseenter", () => (btn.style.background = "rgba(20,20,22,0.6)"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "rgba(20,20,22,0.4)"));
    return btn;
  }

  show(title: string): void {
    this.titleEl.textContent = title;
    this.root.style.opacity = "1";
  }

  hide(): void {
    this.root.style.opacity = "0";
  }
}

// ============================================================================
// Tooltip.ts
//
// A small floating label that follows the cursor while hovering a
// building — the only feedback needed before a click, deliberately quiet
// (no borders/chrome beyond a soft glass pill) so it reads as a map label,
// not a game HUD element. Enters with a quick spring-scale pop rather
// than a flat fade, so it feels responsive to the cursor.
// ============================================================================

export class Tooltip {
  private readonly el: HTMLDivElement;
  private visible = false;
  private lastX = -9999;
  private lastY = -9999;

  constructor(container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: absolute;
      left: 0; top: 0;
      transform: translate(-9999px, -9999px) scale(0.85);
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(20, 20, 22, 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      color: #fff;
      font: 500 13px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.01em;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform-origin: 0 50%;
      transition: opacity 0.18s ease, transform 0.28s cubic-bezier(.2,1.4,.4,1);
      z-index: 20;
      will-change: transform;
    `;
    container.appendChild(this.el);
  }

  private applyTransform(): void {
    const scale = this.visible ? 1 : 0.85;
    this.el.style.transform = `translate(${this.lastX + 16}px, ${this.lastY + 16}px) scale(${scale})`;
  }

  show(text: string, clientX: number, clientY: number): void {
    this.el.textContent = text;
    this.lastX = clientX;
    this.lastY = clientY;
    if (!this.visible) {
      this.visible = true;
      this.el.style.opacity = "1";
    }
    this.applyTransform();
  }

  move(clientX: number, clientY: number): void {
    if (!this.visible) return;
    this.lastX = clientX;
    this.lastY = clientY;
    this.applyTransform();
  }

  hide(): void {
    this.visible = false;
    this.el.style.opacity = "0";
    this.applyTransform();
  }
}

// ============================================================================
// InstructionHint.ts
//
// A single quiet line of usage text that appears once the cinematic intro
// settles, and dismisses itself the moment the user actually touches the
// map — it's there to remove any first-second confusion about what this
// is, not to linger as a permanent HUD element.
// ============================================================================

export class InstructionHint {
  private readonly el: HTMLDivElement;
  private dismissed = false;

  constructor(container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.textContent = "Drag to explore · Scroll to zoom · Click a building to learn more";
    this.el.style.cssText = `
      position: absolute; left: 50%; bottom: 30px;
      transform: translate(-50%, 8px);
      padding: 9px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      box-shadow: 0 10px 30px rgba(20,20,30,0.1);
      font: 500 12.5px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.01em;
      color: #3a3a3e;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.6s ease, transform 0.6s cubic-bezier(.2,.8,.3,1);
      z-index: 12;
      white-space: nowrap;
    `;
    container.appendChild(this.el);
  }

  show(): void {
    if (this.dismissed) return;
    this.el.style.opacity = "1";
    this.el.style.transform = "translate(-50%, 0)";
  }

  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.el.style.opacity = "0";
    this.el.style.transform = "translate(-50%, 8px)";
  }
}

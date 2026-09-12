// ============================================================================
// LoadingScreen.ts
//
// A branded white splash that covers scene construction (procedural
// texture/geometry generation is fast but not instant) and hands off
// straight into the cinematic camera intro — the first impression of the
// whole app, so it gets real typographic care rather than a bare spinner.
// ============================================================================

const KEYFRAMES_ID = "loading-screen-keyframes";

function ensureKeyframes(): void {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes loadingFadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes loadingBarSweep {
      0% { transform: scaleX(0); transform-origin: left; }
      50% { transform: scaleX(1); transform-origin: left; }
      50.001% { transform-origin: right; }
      100% { transform: scaleX(0); transform-origin: right; }
    }
  `;
  document.head.appendChild(style);
}

export class LoadingScreen {
  private readonly el: HTMLDivElement;
  private readonly shownAt: number;

  constructor(container: HTMLElement) {
    ensureKeyframes();
    this.shownAt = performance.now();

    this.el = document.createElement("div");
    this.el.style.cssText = `
      position: absolute; inset: 0;
      background: #fcfcfb;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 100;
      transition: opacity 0.7s cubic-bezier(.4,0,.2,1);
    `;

    const eyebrow = document.createElement("div");
    eyebrow.textContent = "UNIVERSITY OF BIRMINGHAM";
    eyebrow.style.cssText = `
      font: 600 12px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.22em;
      color: #7a1a28;
      margin-bottom: 14px;
      animation: loadingFadeUp 0.7s cubic-bezier(.2,.8,.3,1) both;
    `;
    this.el.appendChild(eyebrow);

    const title = document.createElement("div");
    title.textContent = "Edgbaston Campus";
    title.style.cssText = `
      font: 600 40px/1.1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: -0.02em;
      color: #16161a;
      margin-bottom: 36px;
      animation: loadingFadeUp 0.7s cubic-bezier(.2,.8,.3,1) 0.08s both;
    `;
    this.el.appendChild(title);

    const barTrack = document.createElement("div");
    barTrack.style.cssText = `
      width: 140px; height: 2px;
      background: rgba(0,0,0,0.08);
      border-radius: 2px;
      overflow: hidden;
      animation: loadingFadeUp 0.7s cubic-bezier(.2,.8,.3,1) 0.16s both;
    `;
    const barFill = document.createElement("div");
    barFill.style.cssText = `
      width: 100%; height: 100%;
      background: #7a1a28;
      animation: loadingBarSweep 1.1s ease-in-out infinite;
    `;
    barTrack.appendChild(barFill);
    this.el.appendChild(barTrack);

    container.appendChild(this.el);
  }

  /** Fades the splash out, guaranteeing a minimum display time so it never
   * just flickers on a fast machine — a deliberate beat, not a stall. */
  async hide(minDurationMs = 900): Promise<void> {
    const elapsed = performance.now() - this.shownAt;
    if (elapsed < minDurationMs) {
      await new Promise((r) => setTimeout(r, minDurationMs - elapsed));
    }
    this.el.style.opacity = "0";
    this.el.style.pointerEvents = "none";
    await new Promise((r) => setTimeout(r, 720));
    this.el.remove();
  }
}

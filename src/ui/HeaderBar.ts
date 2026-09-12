// ============================================================================
// HeaderBar.ts
//
// Persistent top-left branding + a one-line description of what the user
// is looking at — the "information text" that turns a bare 3D viewport
// into something that reads as a considered product, not a tech demo.
// Quiet by design: no chrome beyond soft type on the glass, and it steps
// aside whenever the detail viewer (which has its own title) is open.
// ============================================================================

export class HeaderBar {
  private readonly root: HTMLDivElement;
  private readonly attribution: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.cssText = `
      position: absolute; left: 28px; top: 26px;
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 0.8s cubic-bezier(.2,.8,.3,1), transform 0.8s cubic-bezier(.2,.8,.3,1);
      pointer-events: none;
      z-index: 12;
      max-width: 60vw;
    `;

    const eyebrow = document.createElement("div");
    eyebrow.textContent = "UNIVERSITY OF BIRMINGHAM";
    eyebrow.style.cssText = `
      font: 700 11px/1 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0.18em;
      color: #7a1a28;
      margin-bottom: 6px;
      text-shadow: 0 1px 12px rgba(255,255,255,0.9), 0 1px 2px rgba(255,255,255,0.9);
    `;
    this.root.appendChild(eyebrow);

    const title = document.createElement("div");
    title.textContent = "Edgbaston Campus";
    title.style.cssText = `
      font: 600 26px/1.15 -apple-system, "Segoe UI", Arial, sans-serif;
      letter-spacing: -0.01em;
      color: #16161a;
      margin-bottom: 4px;
      text-shadow: 0 1px 16px rgba(255,255,255,0.85), 0 1px 3px rgba(255,255,255,0.85);
    `;
    this.root.appendChild(title);

    const subtitle = document.createElement("div");
    subtitle.textContent = "An interactive 3D map of Chancellor's Court and beyond";
    subtitle.style.cssText = `
      font: 400 13.5px/1.4 -apple-system, "Segoe UI", Arial, sans-serif;
      color: #45454a;
      text-shadow: 0 1px 12px rgba(255,255,255,0.85), 0 1px 2px rgba(255,255,255,0.85);
    `;
    this.root.appendChild(subtitle);

    container.appendChild(this.root);

    // Real building positions/footprints for the wider campus come from
    // OpenStreetMap (ODbL) — a small, unobtrusive credit line, but a
    // required one, and it quietly signals the data is real rather than
    // invented.
    this.attribution = document.createElement("div");
    this.attribution.innerHTML =
      'Building data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline; pointer-events: auto;">OpenStreetMap</a> contributors';
    this.attribution.style.cssText = `
      position: absolute; right: 14px; bottom: 10px;
      opacity: 0;
      transition: opacity 0.8s cubic-bezier(.2,.8,.3,1);
      pointer-events: none;
      z-index: 12;
      font: 400 10.5px/1.4 -apple-system, "Segoe UI", Arial, sans-serif;
      color: #55555c;
      text-shadow: 0 1px 8px rgba(255,255,255,0.85), 0 1px 2px rgba(255,255,255,0.85);
    `;
    container.appendChild(this.attribution);
  }

  show(): void {
    this.root.style.opacity = "1";
    this.root.style.transform = "translateY(0)";
    this.attribution.style.opacity = "1";
  }

  hide(): void {
    this.root.style.opacity = "0";
    this.root.style.transform = "translateY(-6px)";
    this.attribution.style.opacity = "0";
  }
}

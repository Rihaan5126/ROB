// ============================================================================
// proceduralTextures.ts
//
// All surface textures are generated locally with Canvas2D + simple value
// noise. No photographs, no downloaded imagery — everything here is math
// and drawing so it is free of licensing concerns. Each material ships a
// matching normal map so surfaces catch directional light with real
// depth instead of looking flat-shaded.
// ============================================================================

import * as THREE from "three";

function makeCanvas(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

// Simple deterministic pseudo-random generator so textures are stable.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Softens an already-drawn canvas in place. Crisp 1-2px mortar/coursing
 * lines are exactly the kind of regular, high-contrast, high-frequency
 * content that aliases into ugly moiré/interference patterns under
 * mipmapping + anisotropic filtering at oblique viewing angles (this bit
 * us hard on the stone/brick textures — sharp block edges at a distance
 * rendered as a fake diagonal "woven" pattern, not the intended masonry).
 * A couple of pixels of blur removes that high-frequency energy while
 * leaving the coarser colour/shading pattern intact — real masonry photographed
 * from any distance reads soft anyway, never razor-sharp.
 */
function softenCanvas(canvas: HTMLCanvasElement, radiusPx: number): void {
  const { width, height } = canvas;
  const blurred = document.createElement("canvas");
  blurred.width = width;
  blurred.height = height;
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${radiusPx}px)`;
  bctx.drawImage(canvas, 0, 0);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.filter = "none";
  ctx.drawImage(blurred, 0, 0);
}

const ANISOTROPY = 16;

function finalize(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = ANISOTROPY;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function finalizeLinear(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  // Normal/roughness maps must NOT be sRGB-decoded.
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = ANISOTROPY;
  tex.needsUpdate = true;
  return tex;
}

function addNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
  rng: () => number
) {
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Soft vertical weathering/rain streaks — subtle darkening bands. Each
 * streak is feathered on BOTH axes (a radial-ish blob stretched
 * vertically), never a hard-edged rectangle — a flat-sided fillRect
 * streak reads as an artificial stripe and, tiled across a blocky
 * brick/stone pattern, aliases into an ugly woven/banded look instead of
 * natural weathering.
 */
function addWeatheringStreaks(
  ctx: CanvasRenderingContext2D,
  size: number,
  rng: () => number,
  count: number,
  darkness: number
) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng() * size;
    const w = size * (0.03 + rng() * 0.04);
    const a = darkness * (0.35 + rng() * 0.5);
    // A soft vertical streak built from overlapping radial blobs — every
    // edge is a radial falloff, so there is no hard rectangle boundary
    // anywhere to alias against the brick/stone block pattern.
    const blobCount = 10;
    for (let j = 0; j < blobCount; j++) {
      const y = (j / (blobCount - 1)) * size;
      const localA = a * (0.25 + 0.75 * (y / size));
      const grad = ctx.createRadialGradient(x, y, 0, x, y, w);
      grad.addColorStop(0, `rgba(55,52,46,${localA})`);
      grad.addColorStop(1, "rgba(55,52,46,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, w, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Converts a greyscale heightmap canvas into a tangent-space normal map. */
function heightToNormalMap(
  heightCanvas: HTMLCanvasElement,
  strength: number
): HTMLCanvasElement {
  const size = heightCanvas.width;
  const hctx = heightCanvas.getContext("2d")!;
  const hdata = hctx.getImageData(0, 0, size, size).data;
  const height = (x: number, y: number): number => {
    const xi = (x + size) % size;
    const yi = (y + size) % size;
    return hdata[(yi * size + xi) * 4] / 255;
  };

  const { canvas, ctx } = makeCanvas(size);
  const out = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height(x - 1, y);
      const r = height(x + 1, y);
      const u = height(x, y - 1);
      const d = height(x, y + 1);
      const dx = (l - r) * strength;
      const dy = (u - d) * strength;
      const dz = 1.0;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;
      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Brick (warm red, Accrington-style)
// ---------------------------------------------------------------------------

interface BrickLayout {
  size: number;
  brickW: number;
  brickH: number;
  mortar: number;
}

function brickLayout(size: number): BrickLayout {
  return { size, brickW: size / 8, brickH: size / 16, mortar: size / 128 };
}

function drawBrickHeightfield(layout: BrickLayout, rng: () => number): HTMLCanvasElement {
  const { size, brickW, brickH, mortar } = layout;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#3a3a3a"; // recessed mortar = low
  ctx.fillRect(0, 0, size, size);

  for (let row = -1; row < size / brickH + 1; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < size / brickW + 1; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      // Slightly domed brick face for a soft rounded-edge highlight.
      const grad = ctx.createLinearGradient(x, y, x, y + brickH);
      const base = 195 + rng() * 20;
      grad.addColorStop(0, `rgb(${base + 12},${base + 12},${base + 12})`);
      grad.addColorStop(0.5, `rgb(${base + 30},${base + 30},${base + 30})`);
      grad.addColorStop(1, `rgb(${base - 10},${base - 10},${base - 10})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);
    }
  }
  softenCanvas(canvas, size / 110);
  return canvas;
}

export function createBrickTexture(options?: {
  size?: number;
  baseColor?: string;
  mortarColor?: string;
}): THREE.CanvasTexture {
  const size = options?.size ?? 1024;
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(7);
  const layout = brickLayout(size);

  ctx.fillStyle = options?.mortarColor ?? "#aa9d86";
  ctx.fillRect(0, 0, size, size);

  const baseColor = options?.baseColor ?? "#8a3324";

  for (let row = 0; row < size / layout.brickH; row++) {
    const offset = row % 2 === 0 ? 0 : layout.brickW / 2;
    for (let col = -1; col < size / layout.brickW + 1; col++) {
      const x = col * layout.brickW + offset;
      const y = row * layout.brickH;
      const shade = 0.8 + rng() * 0.4;
      const c = new THREE.Color(baseColor);
      c.multiplyScalar(shade);
      // Per-brick hue drift so it doesn't read as one flat colour repeated.
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      c.setHSL(
        hsl.h + (rng() - 0.5) * 0.02,
        Math.min(1, hsl.s * (0.85 + rng() * 0.3)),
        Math.min(1, hsl.l * (0.9 + rng() * 0.25))
      );
      const grad = ctx.createLinearGradient(x, y, x, y + layout.brickH);
      grad.addColorStop(0, `rgb(${c.r * 255 * 1.08},${c.g * 255 * 1.08},${c.b * 255 * 1.08})`);
      grad.addColorStop(1, `rgb(${c.r * 255 * 0.85},${c.g * 255 * 0.85},${c.b * 255 * 0.85})`);
      ctx.fillStyle = grad;
      ctx.fillRect(
        x + layout.mortar,
        y + layout.mortar,
        layout.brickW - layout.mortar * 2,
        layout.brickH - layout.mortar * 2
      );
    }
  }

  softenCanvas(canvas, size / 110);
  addNoise(ctx, size, 8, rng);
  addWeatheringStreaks(ctx, size, rng, 5, 0.22);

  return finalize(canvas, 1, 1);
}

export function createBrickNormalTexture(size = 1024): THREE.CanvasTexture {
  const rng = mulberry32(7);
  const layout = brickLayout(size);
  const heightMap = drawBrickHeightfield(layout, rng);
  const normalCanvas = heightToNormalMap(heightMap, 2.4);
  return finalizeLinear(normalCanvas);
}

// ---------------------------------------------------------------------------
// Pale ashlar / Darley Dale stone
// ---------------------------------------------------------------------------

interface StoneLayout {
  size: number;
  blockW: number;
  blockH: number;
}

function stoneLayout(size: number, blockScale: number): StoneLayout {
  const blockW = size / blockScale;
  return { size, blockW, blockH: blockW * 0.55 };
}

function drawStoneHeightfield(layout: StoneLayout, rng: () => number): HTMLCanvasElement {
  const { size, blockW, blockH } = layout;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = "#606060";
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < size / blockH + 1; row++) {
    const offset = (row % 2) * (blockW / 2);
    for (let col = -1; col < size / blockW + 1; col++) {
      const x = col * blockW + offset;
      const y = row * blockH;
      // A plain top-to-bottom linear gradient (matching the brick
      // heightfield's approach) — a circular radial gradient stretched
      // into a wide-short rectangle like this block mismatches the
      // aspect ratio and bakes in a vertical banding artefact.
      const grad = ctx.createLinearGradient(x, y, x, y + blockH);
      const base = 150 + rng() * 15;
      grad.addColorStop(0, `rgb(${base + 22},${base + 22},${base + 22})`);
      grad.addColorStop(1, `rgb(${base - 12},${base - 12},${base - 12})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 3, y + 3, blockW - 6, blockH - 6);
    }
  }
  softenCanvas(canvas, size / 100);
  return canvas;
}

export function createStoneTexture(options?: {
  size?: number;
  baseColor?: string;
  blockScale?: number;
}): THREE.CanvasTexture {
  const size = options?.size ?? 1024;
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(23);
  const base = options?.baseColor ?? "#d8cdb4";
  const layout = stoneLayout(size, options?.blockScale ?? 4);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let row = 0; row < size / layout.blockH + 1; row++) {
    const offset = (row % 2) * (layout.blockW / 2);
    for (let col = -1; col < size / layout.blockW + 1; col++) {
      const x = col * layout.blockW + offset;
      const y = row * layout.blockH;
      const shade = 0.88 + rng() * 0.22;
      const c = new THREE.Color(base).multiplyScalar(shade);
      // Linear top-to-bottom gradient, not radial — see the matching note
      // in drawStoneHeightfield above for why radial breaks on blocks
      // this much wider than they are tall.
      const grad = ctx.createLinearGradient(x, y, x, y + layout.blockH);
      grad.addColorStop(0, `rgb(${c.r * 255 * 1.06},${c.g * 255 * 1.06},${c.b * 255 * 1.06})`);
      grad.addColorStop(1, `rgb(${c.r * 255 * 0.88},${c.g * 255 * 0.88},${c.b * 255 * 0.88})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y + 2, layout.blockW - 4, layout.blockH - 4);
      ctx.strokeStyle = "rgba(80,72,55,0.3)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, layout.blockW - 4, layout.blockH - 4);
    }
  }

  softenCanvas(canvas, size / 100);
  addNoise(ctx, size, 7, rng);
  addWeatheringStreaks(ctx, size, rng, 7, 0.14);
  return finalize(canvas, 1, 1);
}

export function createStoneNormalTexture(size = 1024, blockScale = 4): THREE.CanvasTexture {
  const rng = mulberry32(23);
  const layout = stoneLayout(size, blockScale);
  const heightMap = drawStoneHeightfield(layout, rng);
  const normalCanvas = heightToNormalMap(heightMap, 1.8);
  return finalizeLinear(normalCanvas);
}

// ---------------------------------------------------------------------------
// Terracotta
// ---------------------------------------------------------------------------
export function createTerracottaTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(51);
  ctx.fillStyle = "#c17a4a";
  ctx.fillRect(0, 0, size, size);
  addNoise(ctx, size, 16, rng);
  addWeatheringStreaks(ctx, size, rng, 4, 0.15);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Dome metal (silver/grey ribbed) — used for Old Joe's lead roof
// ---------------------------------------------------------------------------
export function createDomeMetalTexture(size = 512): THREE.CanvasTexture {
  return createRibbedMetalTexture(size, {
    seed: 88,
    gradientStops: ["#9aa1a8", "#d5dade", "#9aa1a8"],
    ribColor: "rgba(60,65,70,0.55)",
    highlightColor: "rgba(255,255,255,0.25)",
    blotchColors: [],
  });
}

// ---------------------------------------------------------------------------
// Weathered green copper patina — Aston Webb's actual roofing material.
// This is the single most recognisable material cue for the real building,
// so it gets dedicated, blotchy verdigris variation rather than a uniform
// tint of the grey metal texture.
// ---------------------------------------------------------------------------
export function createCopperPatinaTexture(size = 512): THREE.CanvasTexture {
  return createRibbedMetalTexture(size, {
    seed: 132,
    gradientStops: ["#4f7d68", "#7ba98d", "#4f7d68"],
    ribColor: "rgba(35,55,45,0.5)",
    highlightColor: "rgba(200,225,210,0.2)",
    blotchColors: ["rgba(58,95,75,0.4)", "rgba(110,140,110,0.3)", "rgba(90,70,55,0.15)"],
  });
}

function createRibbedMetalTexture(
  size: number,
  options: {
    seed: number;
    gradientStops: [string, string, string];
    ribColor: string;
    highlightColor: string;
    blotchColors: string[];
  }
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(options.seed);
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, options.gradientStops[0]);
  grad.addColorStop(0.5, options.gradientStops[1]);
  grad.addColorStop(1, options.gradientStops[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Blotchy patina/weathering patches, drawn before the ribs so the ribs
  // still read crisply on top.
  for (const color of options.blotchColors) {
    ctx.fillStyle = color;
    const blotchCount = 18;
    for (let i = 0; i < blotchCount; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * (0.04 + rng() * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = options.ribColor;
  ctx.lineWidth = 2.5;
  const ribCount = 20;
  for (let i = 0; i <= ribCount; i++) {
    const x = (i / ribCount) * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
    ctx.strokeStyle = options.highlightColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, 0);
    ctx.lineTo(x + 2, size);
    ctx.stroke();
    ctx.strokeStyle = options.ribColor;
    ctx.lineWidth = 2.5;
  }
  softenCanvas(canvas, size / 140);
  addNoise(ctx, size, 5, rng);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Grey paving
// ---------------------------------------------------------------------------
export function createPavingTexture(size = 1024): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(3);
  ctx.fillStyle = "#a9a9a3";
  ctx.fillRect(0, 0, size, size);
  const slab = size / 6;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const shade = 0.88 + rng() * 0.24;
      const c = new THREE.Color("#adada6").multiplyScalar(shade);
      ctx.fillStyle = `rgb(${c.r * 255},${c.g * 255},${c.b * 255})`;
      ctx.fillRect(col * slab + 2, row * slab + 2, slab - 4, slab - 4);
    }
  }
  softenCanvas(canvas, size / 100);
  addNoise(ctx, size, 8, rng);
  addWeatheringStreaks(ctx, size, rng, 3, 0.08);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Grass — tuned for a predominantly overhead/aerial viewing angle: real
// mown lawns read from above mostly through mowing-stripe banding and
// soft patchy tonal variation, not individual blades, so that's where
// the detail budget goes rather than into fine blade strokes that just
// alias into noise once the camera is 100+ metres up.
// ---------------------------------------------------------------------------
export function createGrassTexture(size = 1024): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(19);

  const base = ctx.createImageData(size, size);
  // A muted, slightly desaturated field green — saturated cartoon greens
  // read as fake; real UK lawns are closer to olive than emerald.
  const baseColor = { r: 84, g: 108, b: 58 };

  // Mowing stripes: alternating bands along a consistent diagonal, the
  // single biggest cue that reads as "real maintained lawn" from above.
  const stripeAngle = 0.5; // radians
  const stripeWidth = size / 22;
  const ca = Math.cos(stripeAngle);
  const sa = Math.sin(stripeAngle);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Large-scale patchy tone (worn patches, drainage variation).
      const patch =
        Math.sin(x * 0.012 + y * 0.008) * 0.5 +
        Math.sin(x * 0.021 - y * 0.017 + 1.7) * 0.3 +
        Math.sin(x * 0.005 + y * 0.026 + 4.1) * 0.2;
      const patchT = (patch + 1) / 2;

      // Mowing stripes (projected along the rotated axis).
      const proj = x * ca + y * sa;
      const stripe = Math.floor(proj / stripeWidth) % 2 === 0 ? 1 : 0.9;

      const fineNoise = (rng() - 0.5) * 10;

      const shade = stripe * (0.86 + patchT * 0.28);
      const i = (y * size + x) * 4;
      base.data[i] = baseColor.r * shade + fineNoise;
      base.data[i + 1] = baseColor.g * shade + fineNoise;
      base.data[i + 2] = baseColor.b * shade + fineNoise * 0.6;
      base.data[i + 3] = 255;
    }
  }
  ctx.putImageData(base, 0, 0);

  // A few soft worn/bare patches for realism, well short of a dirt path.
  for (let i = 0; i < 5; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.03 + rng() * 0.05);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(120,108,74,0.22)");
    grad.addColorStop(1, "rgba(120,108,74,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse fine blade texture for when the camera does get close.
  for (let i = 0; i < 3500; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 2 + rng() * 4;
    const angle = Math.PI / 2 + (rng() - 0.5) * 0.9;
    const shade = 0.7 + rng() * 0.5;
    const c = new THREE.Color("#5c7a42").multiplyScalar(shade);
    ctx.strokeStyle = `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y - Math.sin(angle) * len);
    ctx.stroke();
  }

  softenCanvas(canvas, 1.2);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Dark painted metal (lamp posts, railings)
// ---------------------------------------------------------------------------
export function createDarkMetalTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(61);
  ctx.fillStyle = "#1c1e22";
  ctx.fillRect(0, 0, size, size);
  addNoise(ctx, size, 14, rng);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Lead/grey roof
// ---------------------------------------------------------------------------
export function createRoofSlateTexture(size = 512): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(77);
  ctx.fillStyle = "#4a4d52";
  ctx.fillRect(0, 0, size, size);
  addNoise(ctx, size, 12, rng);
  addWeatheringStreaks(ctx, size, rng, 5, 0.2);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Bark
// ---------------------------------------------------------------------------
export function createBarkTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(41);
  ctx.fillStyle = "#4a3a28";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = rng() * size;
    const w = 3 + rng() * 6;
    const shade = 0.7 + rng() * 0.5;
    ctx.fillStyle = `rgba(${40 * shade},${30 * shade},${20 * shade},0.5)`;
    ctx.fillRect(x, 0, w, size);
  }
  addNoise(ctx, size, 18, rng);
  return finalize(canvas, 1, 3);
}

// ---------------------------------------------------------------------------
// Sky: soft gradient + procedural clouds, seamlessly wrapped horizontally
// ---------------------------------------------------------------------------
export function createSkyTexture(options: {
  topColor: string;
  bottomColor: string;
  cloudColor: string;
  cloudCoverage: number; // 0 = clear, 1 = heavily overcast
  width?: number;
  height?: number;
  seed?: number;
}): THREE.CanvasTexture {
  const width = options.width ?? 1024;
  const height = options.height ?? 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const rng = mulberry32(options.seed ?? 5);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, options.topColor);
  grad.addColorStop(1, options.bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const drawBlob = (cx: number, cy: number, r: number, alpha: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.5})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = options.cloudColor;

  const clusterCount = Math.round(6 + options.cloudCoverage * 18);
  for (let i = 0; i < clusterCount; i++) {
    const cx = rng() * width;
    const cy = height * (0.08 + rng() * 0.55) * (1 - options.cloudCoverage * 0.3);
    const clusterR = 40 + rng() * 90 * (0.5 + options.cloudCoverage);
    const puffs = 3 + Math.floor(rng() * 4);
    const alpha = (0.18 + rng() * 0.22) * (0.5 + options.cloudCoverage);

    for (let p = 0; p < puffs; p++) {
      const ox = (rng() - 0.5) * clusterR * 1.4;
      const oy = (rng() - 0.5) * clusterR * 0.5;
      const r = clusterR * (0.4 + rng() * 0.5);
      // Draw at x, and wrapped copies so clusters straddling the seam
      // still tile seamlessly around the sky dome.
      drawBlob(cx + ox, cy + oy, r, alpha);
      if (cx + ox - r < 0) drawBlob(cx + ox + width, cy + oy, r, alpha);
      if (cx + ox + r > width) drawBlob(cx + ox - width, cy + oy, r, alpha);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Soft radial glow sprite (sun / lamp glow)
// ---------------------------------------------------------------------------
export function createGlowTexture(size = 256): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Edwardian/Victorian institutional facade — red brick with stone plinth,
// cornice and window dressings, round-arched principal-floor windows and
// plain sashes above, a wider "entrance bay" at ground level. Cheap
// (one texture per building), but reads as the same architectural family
// as Aston Webb rather than a flat punched-window grid.
// ---------------------------------------------------------------------------
export function createEdwardianFacadeTexture(options: {
  brickColor: string;
  trimColor: string;
  glassColor: string;
  cols?: number;
  rows?: number;
  size?: number;
}): THREE.CanvasTexture {
  const size = options.size ?? 1024;
  const cols = options.cols ?? 6;
  const rows = options.rows ?? 4;
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(17);
  const brick = new THREE.Color(options.brickColor);
  const trim = options.trimColor;

  ctx.fillStyle = options.brickColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle brick coursing (fine horizontal banding, not full brick-by-brick).
  const courseH = size / 60;
  for (let i = 0; i < 60; i++) {
    const shade = 0.9 + rng() * 0.2;
    const c = brick.clone().multiplyScalar(shade);
    ctx.fillStyle = `rgba(${c.r * 255},${c.g * 255},${c.b * 255},0.55)`;
    ctx.fillRect(0, i * courseH, size, courseH * 0.55);
  }

  const plinthH = size * 0.07;
  const corniceH = size * 0.1;

  ctx.fillStyle = trim;
  ctx.fillRect(0, size - plinthH, size, plinthH);
  ctx.fillRect(0, 0, size, corniceH);

  // Dentil row under the cornice.
  const dentilCount = Math.round(cols * 4);
  for (let i = 0; i < dentilCount; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    if (i % 2 === 0) ctx.fillRect((i * size) / dentilCount, corniceH * 0.6, size / dentilCount / 1.8, corniceH * 0.3);
  }

  const zoneTop = corniceH;
  const zoneH = size - plinthH - corniceH;
  const rowH = zoneH / rows;
  const colW = size / cols;
  const glass = new THREE.Color(options.glassColor);

  for (let r = 0; r < rows; r++) {
    const isGround = r === rows - 1;
    const rowTop = zoneTop + r * rowH;
    for (let c = 0; c < cols; c++) {
      const isEntrance = isGround && Math.abs(c - (cols - 1) / 2) < 0.6;
      const cx = c * colW + colW / 2;
      const winW = colW * (isEntrance ? 0.58 : 0.48);
      const winH = rowH * (isGround ? 0.8 : 0.6);
      const winBottom = rowTop + rowH * 0.86;
      const winTop = winBottom - winH;
      const litShift = (rng() - 0.5) * 16;
      ctx.fillStyle = `rgb(${glass.r * 255 + litShift},${glass.g * 255 + litShift},${glass.b * 255 + litShift})`;

      if (isGround) {
        const archR = winW / 2;
        const straightTop = Math.max(winTop + archR, winTop + 1);
        ctx.beginPath();
        ctx.moveTo(cx - winW / 2, winBottom);
        ctx.lineTo(cx - winW / 2, straightTop);
        ctx.arc(cx, straightTop, archR, Math.PI, 0, false);
        ctx.lineTo(cx + winW / 2, winBottom);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = trim;
        ctx.lineWidth = size * 0.007;
        ctx.beginPath();
        ctx.moveTo(cx - winW / 2 - 3, winBottom);
        ctx.lineTo(cx - winW / 2 - 3, straightTop);
        ctx.arc(cx, straightTop, archR + 3, Math.PI, 0, false);
        ctx.lineTo(cx + winW / 2 + 3, winBottom);
        ctx.stroke();

        ctx.strokeStyle = "rgba(15,15,15,0.4)";
        ctx.lineWidth = size * 0.0028;
        ctx.beginPath();
        ctx.moveTo(cx, winBottom);
        ctx.lineTo(cx, winTop);
        ctx.stroke();
      } else {
        ctx.fillRect(cx - winW / 2, winTop, winW, winH);
        ctx.fillStyle = trim;
        ctx.fillRect(cx - winW / 2 - 3, winTop - rowH * 0.05, winW + 6, rowH * 0.05);
        ctx.fillRect(cx - winW / 2 - 3, winBottom, winW + 6, rowH * 0.04);
        ctx.strokeStyle = "rgba(15,15,15,0.35)";
        ctx.lineWidth = size * 0.0022;
        ctx.beginPath();
        ctx.moveTo(cx, winTop);
        ctx.lineTo(cx, winBottom);
        ctx.stroke();
      }
    }
  }

  softenCanvas(canvas, size / 500);
  addNoise(ctx, size, 6, rng);
  return finalize(canvas, 1, 1);
}

// ---------------------------------------------------------------------------
// Modern curtain-wall facade — alternating glazing/spandrel bands with a
// visible mullion grid, for the campus's concrete-and-glass buildings
// (Muirhead Tower, Guild of Students, sport/science blocks).
// ---------------------------------------------------------------------------
export function createModernFacadeTexture(options: {
  panelColor: string;
  glassColor: string;
  cols?: number;
  rows?: number;
  size?: number;
}): THREE.CanvasTexture {
  const size = options.size ?? 1024;
  const cols = options.cols ?? 8;
  const rows = options.rows ?? 10;
  const { canvas, ctx } = makeCanvas(size);
  const rng = mulberry32(31);
  const panel = new THREE.Color(options.panelColor);
  const glass = new THREE.Color(options.glassColor);

  ctx.fillStyle = options.panelColor;
  ctx.fillRect(0, 0, size, size);

  const colW = size / cols;
  const rowH = size / rows;

  for (let r = 0; r < rows; r++) {
    const isGlassBand = r % 2 === 0;
    const y = r * rowH;
    for (let c = 0; c < cols; c++) {
      const x = c * colW;
      if (isGlassBand) {
        const litShift = (rng() - 0.5) * 18;
        ctx.fillStyle = `rgb(${glass.r * 255 + litShift},${glass.g * 255 + litShift},${glass.b * 255 + litShift})`;
        ctx.fillRect(x + colW * 0.05, y + rowH * 0.1, colW * 0.9, rowH * 0.8);
      } else {
        const shade = 0.9 + rng() * 0.18;
        const c2 = panel.clone().multiplyScalar(shade);
        ctx.fillStyle = `rgb(${c2.r * 255},${c2.g * 255},${c2.b * 255})`;
        ctx.fillRect(x, y, colW, rowH);
      }
    }
  }

  ctx.strokeStyle = "rgba(18,22,26,0.55)";
  ctx.lineWidth = size * 0.0028;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * colW, 0);
    ctx.lineTo(c * colW, size);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(size, r * rowH);
    ctx.stroke();
  }

  softenCanvas(canvas, size / 600);
  addNoise(ctx, size, 5, rng);
  return finalize(canvas, 1, 1);
}

// ============================================================================
// CameraTransition.ts
//
// Smoothly animates the camera position and an orbit target from wherever
// they currently are to a new framing, over a fixed duration with easing
// plus a cinematic "drone swoop" arc — the camera rises above the direct
// line between the two points and settles back down, rather than punching
// straight through whatever geometry sits between them. Used for the
// "fly to this building" transition and the opening cinematic intro.
// Deliberately dependency-free — no tweening library.
// ============================================================================

import * as THREE from "three";

function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

export class CameraTransition {
  private active = false;
  private elapsed = 0;
  private duration = 1.2;

  private readonly startPos = new THREE.Vector3();
  private readonly startTarget = new THREE.Vector3();
  private readonly endPos = new THREE.Vector3();
  private readonly endTarget = new THREE.Vector3();
  private arcHeight = 0;

  private onDone: (() => void) | null = null;

  get isActive(): boolean {
    return this.active;
  }

  get progress(): number {
    return this.duration > 0 ? Math.min(1, this.elapsed / this.duration) : 1;
  }

  start(
    fromPos: THREE.Vector3,
    fromTarget: THREE.Vector3,
    toPos: THREE.Vector3,
    toTarget: THREE.Vector3,
    duration = 1.2,
    onDone?: () => void
  ): void {
    this.startPos.copy(fromPos);
    this.startTarget.copy(fromTarget);
    this.endPos.copy(toPos);
    this.endTarget.copy(toTarget);
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
    this.onDone = onDone ?? null;

    // The swoop scales with how far the camera is travelling — a short
    // hop barely lifts, a cross-campus flight rises like a drone shot.
    const horizDist = Math.hypot(toPos.x - fromPos.x, toPos.z - fromPos.z);
    this.arcHeight = Math.min(70, horizDist * 0.22);
  }

  /** Advances the tween and writes the interpolated pose into outPos/outTarget. */
  update(delta: number, outPos: THREE.Vector3, outTarget: THREE.Vector3): void {
    if (!this.active) return;
    this.elapsed += delta;
    const t = Math.min(1, this.elapsed / this.duration);
    const eased = easeInOutQuint(t);

    outPos.lerpVectors(this.startPos, this.endPos, eased);
    outTarget.lerpVectors(this.startTarget, this.endTarget, eased);

    // Sine arc peaks at the midpoint and returns to zero at both ends, so
    // it never disturbs the exact start/end framing — only the flight.
    outPos.y += this.arcHeight * Math.sin(Math.PI * t);

    if (t >= 1) {
      this.active = false;
      this.onDone?.();
    }
  }

  cancel(): void {
    this.active = false;
  }
}

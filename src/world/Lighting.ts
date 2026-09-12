// ============================================================================
// Lighting.ts
//
// The campus's sky, sun and ambient lighting — kept separate from
// CampusScene so the "environment" concern (what does the world look and
// feel like) is independent of "content" (what's actually placed in it).
//
// This is a digital-twin map, not a game, so there's no time-of-day/
// weather toggle in the UI: one carefully tuned, photogenic daylight
// setup, always on. The preset table stays data-driven internally so a
// future "evening mode" is a config addition, not a rewrite.
// ============================================================================

import * as THREE from "three";
import { createSkyTexture, createGlowTexture } from "../materials/proceduralTextures";

const SKY_RADIUS = 280;

const PRESET = {
  skyTop: "#3f7fc9",
  skyBottom: "#cfe3f2",
  cloudColor: "#ffffff",
  cloudCoverage: 0.32,
  hemiSky: "#bcd9ee",
  hemiGround: "#9c9370",
  hemiIntensity: 0.85,
  sunColor: "#fff6de",
  sunIntensity: 2.1,
  sunPosition: new THREE.Vector3(55, 95, 35),
  sunGlowColor: "#fff9e2",
  sunGlowOpacity: 0.85,
  sunGlowScale: 55,
  fogColor: "#cfe3f2",
  fogDensity: 0.0011,
  lampIntensity: 0.05,
};

export class Lighting {
  readonly hemiLight: THREE.HemisphereLight;
  readonly sunLight: THREE.DirectionalLight;
  private readonly skyMesh: THREE.Mesh;
  private readonly sunGlow: THREE.Sprite;

  constructor(scene: THREE.Scene) {
    // Sky dome with procedural clouds.
    const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 32, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      fog: false,
      map: createSkyTexture({
        topColor: PRESET.skyTop,
        bottomColor: PRESET.skyBottom,
        cloudColor: PRESET.cloudColor,
        cloudCoverage: PRESET.cloudCoverage,
      }),
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.skyMesh);

    // Soft sun glow billboard for a visible focal point in the sky.
    const glowMat = new THREE.SpriteMaterial({
      map: createGlowTexture(),
      color: new THREE.Color(PRESET.sunGlowColor),
      opacity: PRESET.sunGlowOpacity,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.sunGlow = new THREE.Sprite(glowMat);
    this.sunGlow.scale.set(PRESET.sunGlowScale, PRESET.sunGlowScale, 1);
    this.sunGlow.position.copy(PRESET.sunPosition).normalize().multiplyScalar(SKY_RADIUS * 0.92);
    scene.add(this.sunGlow);

    this.hemiLight = new THREE.HemisphereLight(PRESET.hemiSky, PRESET.hemiGround, PRESET.hemiIntensity);
    scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(PRESET.sunColor, PRESET.sunIntensity);
    this.sunLight.position.copy(PRESET.sunPosition);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    this.sunLight.shadow.radius = 3.5;
    const extent = 130;
    this.sunLight.shadow.camera.left = -extent;
    this.sunLight.shadow.camera.right = extent;
    this.sunLight.shadow.camera.top = extent;
    this.sunLight.shadow.camera.bottom = -extent;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 300;
    this.sunLight.shadow.bias = -0.0015;
    this.sunLight.target.position.set(0, 0, 50);
    scene.add(this.sunLight, this.sunLight.target);

    scene.fog = new THREE.FogExp2(new THREE.Color(PRESET.fogColor).getHex(), PRESET.fogDensity);
  }

  get lampIntensity(): number {
    return PRESET.lampIntensity;
  }

  /** Keeps the sky dome centred on the camera so it always reads as
   * infinitely distant, however far the user pans/zooms — and gives the
   * sky a slow, living drift (rotating clouds, a gentle sun-glow breathe)
   * instead of sitting perfectly static. */
  followCamera(cameraPosition: THREE.Vector3, elapsed: number, delta: number): void {
    this.skyMesh.position.copy(cameraPosition);
    this.skyMesh.rotation.y += delta * 0.0025;

    this.sunGlow.position
      .copy(cameraPosition)
      .addScaledVector(PRESET.sunPosition.clone().normalize(), SKY_RADIUS * 0.92);
    const breathe = 1 + Math.sin(elapsed * 0.4) * 0.04;
    this.sunGlow.scale.set(PRESET.sunGlowScale * breathe, PRESET.sunGlowScale * breathe, 1);
  }
}

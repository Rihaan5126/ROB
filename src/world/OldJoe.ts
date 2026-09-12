// ============================================================================
// OldJoe.ts
//
// The Joseph Chamberlain Memorial Clock Tower ("Old Joe") — the dominant
// hero landmark of the vertical slice. Built stage-by-stage per the
// dimensions in campusData.OLD_JOE. Nothing here is a magic number; every
// size comes from that config object.
// ============================================================================

import * as THREE from "three";
import { OLD_JOE } from "./campusData";
import { Materials } from "../materials/materials";
import {
  createArchedPassageWall,
  createBrickWall,
  createArchedWindow,
  createCornice,
  tiledMaterial,
} from "./ArchitectureKit";

export interface OldJoeResult {
  group: THREE.Group;
  update: (date: Date) => void;
}

/** Square "frustum" (tapering box) built from a 4-sided cylinder. */
function squareFrustum(
  widthBottom: number,
  widthTop: number,
  height: number,
  material: THREE.Material,
  yBase: number
): THREE.Mesh {
  const circBottom = (widthBottom * Math.SQRT2) / 2;
  const circTop = (widthTop * Math.SQRT2) / 2;
  const geo = new THREE.CylinderGeometry(circTop, circBottom, height, 4, 1, false);
  geo.rotateY(Math.PI / 4);
  const mesh = new THREE.Mesh(geo, tiledMaterial(material, widthBottom, height));
  mesh.position.y = yBase + height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function widthAt(y: number): number {
  const { baseStage, shaftStage, clockStage, bellStage, parapetStage, roof } = OLD_JOE;
  const shaftBottom = baseStage.height;
  const shaftTop = shaftBottom + shaftStage.height;
  if (y <= shaftBottom) return baseStage.width;
  if (y <= shaftTop) {
    const t = (y - shaftBottom) / shaftStage.height;
    return THREE.MathUtils.lerp(shaftStage.widthBottom, shaftStage.widthTop, t);
  }
  const clockTop = shaftTop + clockStage.height;
  if (y <= clockTop) return clockStage.width;
  const bellTop = clockTop + bellStage.height;
  if (y <= bellTop) return bellStage.width;
  const parapetTop = bellTop + parapetStage.height;
  if (y <= parapetTop) return parapetStage.width;
  return roof.baseWidth;
}

function buildBaseStage(): THREE.Group {
  const group = new THREE.Group();
  const { width, height, archWidth, archHeight, archDepth } = OLD_JOE.baseStage;
  const half = width / 2;

  // North + south walls: pierced by the walk-through archway.
  const southWall = createArchedPassageWall(
    width,
    height,
    archWidth,
    archHeight,
    archDepth,
    Materials.stoneAshlar
  );
  southWall.position.z = half - archDepth / 2;
  group.add(southWall);

  const northWall = southWall.clone();
  northWall.position.z = -(half - archDepth / 2);
  group.add(northWall);

  // East + west walls: solid rusticated stone. Sized to fit exactly
  // between the north/south walls rather than their full outer width —
  // otherwise the four corners double up two coincident textured
  // surfaces, which z-fights into an ugly moiré flicker at a distance.
  const eastWall = createBrickWall(archDepth, height, width - archDepth * 2, Materials.stoneAshlar);
  eastWall.position.x = half - archDepth / 2;
  group.add(eastWall);

  const westWall = eastWall.clone();
  westWall.position.x = -(half - archDepth / 2);
  group.add(westWall);

  return group;
}

function buildShaftStage(yBase: number): THREE.Group {
  const group = new THREE.Group();
  const { height, widthBottom, widthTop, bandCount, bandHeight, bayCount } = OLD_JOE.shaftStage;

  const shaft = squareFrustum(widthBottom, widthTop, height, Materials.brickRed, yBase);
  group.add(shaft);

  // Horizontal stone bands.
  for (let i = 1; i <= bandCount; i++) {
    const t = i / (bandCount + 1);
    const y = yBase + t * height;
    const w = widthAt(y) * 1.04;
    const band = squareFrustum(w, w * 0.98, bandHeight, Materials.stoneDarleyDale, y - bandHeight / 2);
    group.add(band);
  }

  // Recessed vertical arch-panels + paired windows on each of the 4 faces.
  const faceNormals = [
    { x: 0, z: 1, ry: 0 },
    { x: 0, z: -1, ry: Math.PI },
    { x: 1, z: 0, ry: -Math.PI / 2 },
    { x: -1, z: 0, ry: Math.PI / 2 },
  ];
  const faceWidth = widthBottom;
  const bayWidth = faceWidth / bayCount;
  const pilasterWidth = 0.4;

  for (const face of faceNormals) {
    // Three tall recessed blind-arch panels per face — the shaft's most
    // distinctive feature per the brief, previously under-represented by
    // pilasters alone. A dark brick "glass" reads as a genuine shadowed
    // recess rather than a flat painted rectangle.
    for (let b = 0; b < bayCount; b++) {
      const bayCenter = -faceWidth / 2 + (b + 0.5) * bayWidth;
      const panelWidth = bayWidth * 0.62;
      const panelHeight = height * 0.6;
      const panel = createArchedWindow(panelWidth, panelHeight, Materials.stoneDarleyDale, Materials.brickRecess);
      if (face.x !== 0) {
        panel.position.set((face.x * faceWidth) / 2 + face.x * 0.03, yBase + height * 0.08, bayCenter);
      } else {
        panel.position.set(bayCenter, yBase + height * 0.08, (face.z * faceWidth) / 2 + face.z * 0.03);
      }
      panel.rotation.y = face.ry;
      group.add(panel);
    }

    for (let b = 1; b < bayCount; b++) {
      const offset = -faceWidth / 2 + b * bayWidth;
      const pilaster = createBrickWall(
        pilasterWidth,
        height * 0.94,
        0.25,
        Materials.brickRedFine
      );
      pilaster.position.set(
        face.x !== 0 ? 0 : offset,
        yBase + height * 0.03,
        face.x !== 0 ? offset : 0
      );
      if (face.x !== 0) {
        pilaster.position.x = (face.x * faceWidth) / 2 + face.x * 0.05;
      } else {
        pilaster.position.z = (face.z * faceWidth) / 2 + face.z * 0.05;
      }
      pilaster.rotation.y = face.ry;
      group.add(pilaster);
    }

    // Paired small windows, two rows up the shaft, centred in each bay.
    for (let b = 0; b < bayCount; b++) {
      const bayCenter = -faceWidth / 2 + (b + 0.5) * bayWidth;
      for (const rowT of [0.35, 0.7]) {
        const y = yBase + rowT * height;
        for (const pairOffset of [-0.55, 0.55]) {
          const win = createArchedWindow(0.7, 1.4, Materials.stoneDarleyDale, Materials.glass);
          const along = bayCenter + pairOffset;
          if (face.x !== 0) {
            win.position.set((face.x * faceWidth) / 2 + face.x * 0.08, y, along);
          } else {
            win.position.set(along, y, (face.z * faceWidth) / 2 + face.z * 0.08);
          }
          win.rotation.y = face.ry;
          group.add(win);
        }
      }
    }
  }

  return group;
}

interface ClockHandRefs {
  hour: THREE.Mesh;
  minute: THREE.Mesh;
}

function buildClockStage(yBase: number): { group: THREE.Group; hands: ClockHandRefs[] } {
  const group = new THREE.Group();
  const { height, width, clockDiameter } = OLD_JOE.clockStage;
  const hands: ClockHandRefs[] = [];

  const box = createBrickWall(width, height, width, Materials.brickRed);
  box.position.y = yBase;
  group.add(box);

  const stoneBand = createCornice(width * 1.06, width * 1.06, 0.5, Materials.stoneDarleyDale);
  stoneBand.position.y = yBase + 0.25;
  group.add(stoneBand);

  const radius = clockDiameter / 2;
  const faces = [
    { x: 0, z: 1, ry: 0 },
    { x: 0, z: -1, ry: Math.PI },
    { x: 1, z: 0, ry: -Math.PI / 2 },
    { x: -1, z: 0, ry: Math.PI / 2 },
  ];
  const clockY = yBase + height * 0.55;

  for (const face of faces) {
    const clockGroup = new THREE.Group();

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.18, 8, 32),
      Materials.stoneDarleyDale
    );
    clockGroup.add(rim);

    const face2 = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.1, 32),
      Materials.clockFace
    );
    face2.position.z = 0.05;
    clockGroup.add(face2);

    const hourHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, radius * 0.55, 0.05),
      Materials.clockHand
    );
    hourHand.geometry.translate(0, radius * 0.275, 0);
    hourHand.position.z = 0.12;
    clockGroup.add(hourHand);

    const minuteHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, radius * 0.8, 0.05),
      Materials.clockHand
    );
    minuteHand.geometry.translate(0, radius * 0.4, 0);
    minuteHand.position.z = 0.14;
    clockGroup.add(minuteHand);

    hands.push({ hour: hourHand, minute: minuteHand });

    // Corbel bracket beneath.
    const corbel = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.6, 0.5, 0.8),
      Materials.stoneDarleyDale
    );
    corbel.position.y = -radius - 0.4;
    corbel.castShadow = true;
    clockGroup.add(corbel);

    clockGroup.position.set(
      face.x !== 0 ? (face.x * width) / 2 + face.x * 0.15 : 0,
      clockY,
      face.z !== 0 ? (face.z * width) / 2 + face.z * 0.15 : 0
    );
    clockGroup.rotation.y = face.ry;
    group.add(clockGroup);
  }

  return { group, hands };
}

function buildBellStage(yBase: number): THREE.Group {
  const group = new THREE.Group();
  const { height, width, archOpeningWidth, archOpeningHeight } = OLD_JOE.bellStage;
  const half = width / 2;
  const thickness = 1.0;

  const faces = [
    { z: half - thickness / 2, x: 0, ry: 0 },
    { z: -(half - thickness / 2), x: 0, ry: Math.PI },
  ];
  for (const f of faces) {
    const wall = createArchedPassageWall(
      width,
      height,
      archOpeningWidth,
      archOpeningHeight,
      thickness,
      Materials.brickRed
    );
    wall.position.set(f.x, yBase, f.z);
    group.add(wall);
  }

  const sideWall = createArchedPassageWall(
    width,
    height,
    archOpeningWidth,
    archOpeningHeight,
    thickness,
    Materials.brickRed
  );
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(half - thickness / 2, yBase, 0);
  group.add(sideWall);

  const sideWall2 = sideWall.clone();
  sideWall2.position.x = -(half - thickness / 2);
  group.add(sideWall2);

  return group;
}

export function createOldJoe(): OldJoeResult {
  const group = new THREE.Group();
  group.position.set(OLD_JOE.position.x, OLD_JOE.position.y, OLD_JOE.position.z);
  group.rotation.y = OLD_JOE.rotationY;

  const base = buildBaseStage();
  group.add(base);

  let y = OLD_JOE.baseStage.height;
  const shaft = buildShaftStage(y);
  group.add(shaft);
  y += OLD_JOE.shaftStage.height;

  const clock = buildClockStage(y);
  group.add(clock.group);
  y += OLD_JOE.clockStage.height;

  const bell = buildBellStage(y);
  group.add(bell);
  y += OLD_JOE.bellStage.height;

  // Parapet / cornice band.
  const parapetWidth = OLD_JOE.parapetStage.width;
  const parapet = createCornice(parapetWidth, parapetWidth, 0.6, Materials.stoneDarleyDale);
  parapet.position.y = y + 0.3;
  group.add(parapet);
  const parapetWall = createBrickWall(
    parapetWidth * 0.9,
    OLD_JOE.parapetStage.height - 0.6,
    parapetWidth * 0.9,
    Materials.stoneAshlar
  );
  parapetWall.position.y = y + 0.6;
  group.add(parapetWall);
  y += OLD_JOE.parapetStage.height;

  // Pyramidal lead roof.
  const roofRadius = (OLD_JOE.roof.baseWidth * Math.SQRT2) / 2;
  const roofGeo = new THREE.ConeGeometry(roofRadius, OLD_JOE.roof.height, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  const roofMesh = new THREE.Mesh(roofGeo, Materials.roofSlate);
  roofMesh.position.y = y + OLD_JOE.roof.height / 2;
  roofMesh.castShadow = true;
  group.add(roofMesh);
  y += OLD_JOE.roof.height;

  // Finial / lantern.
  const finialBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, OLD_JOE.finial.height * 0.5, 8),
    Materials.stoneDarleyDale
  );
  finialBase.position.y = y + (OLD_JOE.finial.height * 0.5) / 2;
  group.add(finialBase);
  const finialCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, OLD_JOE.finial.height * 0.5, 8),
    Materials.domeMetal
  );
  finialCap.position.y = y + OLD_JOE.finial.height * 0.5 + (OLD_JOE.finial.height * 0.5) / 2;
  group.add(finialCap);

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  function update(date: Date) {
    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();
    const minuteAngle = (minutes / 60) * Math.PI * 2;
    const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2;
    for (const h of clock.hands) {
      h.minute.rotation.z = -minuteAngle;
      h.hour.rotation.z = -hourAngle;
    }
  }
  update(new Date());

  return { group, update };
}

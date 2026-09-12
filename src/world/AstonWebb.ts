// ============================================================================
// AstonWebb.ts
//
// The Aston Webb / Great Hall front elevation plus enough of the curved
// quadrant wings (with domed end pavilions) to make Chancellor's Court read
// convincingly. Built from the reusable pieces in ArchitectureKit.ts and
// sized entirely from campusData.ASTON_WEBB.
// ============================================================================

import * as THREE from "three";
import { ASTON_WEBB } from "./campusData";
import { Materials } from "../materials/materials";
import {
  createBrickWall,
  createMullionedWindow,
  createArchedWindow,
  createDome,
  createTurret,
  createCornice,
  createFrieze,
  createEntranceRecess,
  createStairs,
  createColonnade,
} from "./ArchitectureKit";

/** A row of small stone piers along a rectangular roofline — cheap but
 * reads immediately as a proper balustrade instead of a plain parapet
 * box, breaking up what would otherwise be a flat skyline. */
function addBalustrade(group: THREE.Group, width: number, depth: number, y: number): void {
  const pierGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
  const spacing = 1.3;
  const halfW = width / 2;
  const halfD = depth / 2;

  const placeAlongX = (z: number) => {
    const count = Math.max(2, Math.round(width / spacing));
    for (let i = 0; i <= count; i++) {
      const x = -halfW + (i / count) * width;
      const pier = new THREE.Mesh(pierGeo, Materials.stoneDarleyDale);
      pier.position.set(x, y, z);
      pier.castShadow = true;
      group.add(pier);
    }
  };
  const placeAlongZ = (x: number) => {
    const count = Math.max(2, Math.round(depth / spacing));
    for (let i = 0; i <= count; i++) {
      const z = -halfD + (i / count) * depth;
      const pier = new THREE.Mesh(pierGeo, Materials.stoneDarleyDale);
      pier.position.set(x, y, z);
      pier.castShadow = true;
      group.add(pier);
    }
  };

  placeAlongX(-halfD);
  placeAlongX(halfD);
  placeAlongZ(-halfW);
  placeAlongZ(halfW);
}

function bezier2D(
  p0: { x: number; z: number },
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  t: number
): { x: number; z: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    z: mt * mt * p0.z + 2 * mt * t * p1.z + t * t * p2.z,
  };
}

function buildCentralBlock(): THREE.Group {
  const group = new THREE.Group();
  const cb = ASTON_WEBB.centralBlock;
  const frontZ = -cb.depth / 2;

  const mainWall = createBrickWall(cb.width, cb.wallHeight, cb.depth, Materials.brickWarm);
  mainWall.position.z = 0;
  group.add(mainWall);

  // Stone plinth course at the base for visual weight.
  const plinth = createBrickWall(cb.width + 0.6, 1.1, cb.depth + 0.6, Materials.stoneAshlar);
  plinth.position.set(0, 0, 0);
  group.add(plinth);

  // Terracotta stringcourse at first-floor level — the buff dressing band
  // that runs round the real building between storeys.
  const stringCourse = createCornice(cb.width + 0.5, cb.depth + 0.5, 0.28, Materials.terracotta);
  stringCourse.position.y = cb.archWindow.sillHeight - 0.3;
  group.add(stringCourse);

  // Great Hall's huge central round-arched mullioned window.
  const win = createMullionedWindow(
    cb.archWindow.width,
    cb.archWindow.height,
    cb.archWindow.mullions,
    Materials.stoneDarleyDale,
    Materials.glassBright
  );
  win.position.set(0, cb.archWindow.sillHeight, frontZ - 0.05);
  group.add(win);

  // Entrance loggia recessed into the ground floor, below the great window.
  const entrance = createEntranceRecess(
    cb.entrance.width,
    cb.entrance.height,
    cb.entrance.recessDepth,
    Materials.stoneAshlar
  );
  entrance.rotation.y = Math.PI;
  entrance.position.set(0, 0, frontZ);
  group.add(entrance);

  const stairs = createStairs(cb.entrance.width + 1.5, 0.45, 1.6, 3, Materials.stoneAshlar);
  stairs.position.set(0, 0, frontZ + 0.1);
  group.add(stairs);

  // Grand columned portico standing proud of the entrance recess — the
  // paired-column front the reference photos show flanking the doorway,
  // not just a plain arched hole in the brick.
  const colonnade = createColonnade(
    cb.entrance.width + 2.4,
    cb.entrance.height + 0.6,
    0.42,
    5,
    Materials.stoneAshlar
  );
  colonnade.position.set(0, 0.45, frontZ - 1.9);
  group.add(colonnade);

  // Frieze band + cornice immediately below roof level.
  const frieze = createFrieze(cb.width + 0.4, 0.9, 0.5, Materials.terracotta);
  frieze.position.set(0, cb.wallHeight - 0.6, frontZ - 0.02);
  group.add(frieze);
  const cornice = createCornice(cb.width + 0.8, cb.depth + 0.8, 0.5, Materials.stoneDarleyDale);
  cornice.position.y = cb.wallHeight;
  group.add(cornice);

  // Low parapet upstand hiding the flat roof deck.
  const parapet = createBrickWall(cb.width - 1, 1.4, cb.depth - 1, Materials.brickWarm);
  parapet.position.y = cb.wallHeight + 0.3;
  group.add(parapet);
  addBalustrade(group, cb.width - 1, cb.depth - 1, cb.wallHeight + 1.0);

  // Corner turrets.
  const turretShaftHeight = cb.turret.height - cb.turret.domeRadius * 2.2;
  for (const side of [-1, 1]) {
    const turret = createTurret(
      cb.turret.size,
      turretShaftHeight,
      cb.turret.domeRadius,
      cb.turret.domeRadius * 1.15,
      Materials.brickWarm,
      Materials.domeCopperPatina
    );
    turret.position.set(
      side * (cb.width / 2 - cb.turret.size / 2 + 0.3),
      0,
      frontZ + cb.turret.size / 2 - 0.4
    );
    group.add(turret);
  }

  // Large central dome on a low octagonal drum, clad in weathered green
  // copper — the single most recognisable feature of the real building.
  const dome = createDome(cb.dome.drumRadius, cb.dome.drumHeight, cb.dome.domeHeight, {
    drumMaterial: Materials.stoneAshlar,
    domeMaterial: Materials.domeCopperPatina,
    lanternHeight: cb.dome.lanternHeight,
    segments: 8,
  });
  dome.position.set(0, cb.wallHeight + 1, 0);
  group.add(dome);

  // Simple side windows for interest when walking around the flanks.
  for (const side of [-1, 1]) {
    for (const t of [0.3, 0.6, 0.85]) {
      const w = createArchedWindow(1.6, 2.8, Materials.stoneDarleyDale, Materials.glass);
      w.position.set(side * (cb.width / 2 + 0.05), 3.5, frontZ + t * cb.depth);
      w.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(w);
    }
  }

  return group;
}

function buildWing(side: 1 | -1): THREE.Group {
  const group = new THREE.Group();
  const w = ASTON_WEBB.wing;
  const cb = ASTON_WEBB.centralBlock;
  const frontZ = -cb.depth / 2;

  const start = { x: side * (cb.width / 2 + w.depth / 2 - 0.5), z: frontZ + 1 };
  const control = { x: side * 58, z: frontZ - 34 };
  const end = { x: side * 60, z: frontZ - 66 };

  const segLen = 1 / w.bayCount;
  const bayLength =
    (Math.hypot(control.x - start.x, control.z - start.z) +
      Math.hypot(end.x - control.x, end.z - control.z)) /
    w.bayCount;

  for (let i = 0; i < w.bayCount; i++) {
    const t = (i + 0.5) * segLen;
    const p = bezier2D(start, control, end, t);
    const tPrev = bezier2D(start, control, end, Math.max(0, t - 0.01));
    const tNext = bezier2D(start, control, end, Math.min(1, t + 0.01));
    const dirX = tNext.x - tPrev.x;
    const dirZ = tNext.z - tPrev.z;
    const angle = Math.atan2(dirX, dirZ);

    const bay = createBrickWall(bayLength * 1.08, w.wallHeight, w.depth, Materials.brickWarm);
    bay.position.set(p.x, 0, p.z);
    bay.rotation.y = angle;
    group.add(bay);

    const bayStringCourse = createCornice(bayLength * 1.1, w.depth + 0.4, 0.22, Materials.terracotta);
    bayStringCourse.position.set(p.x, 4.6, p.z);
    bayStringCourse.rotation.y = angle;
    group.add(bayStringCourse);

    // Inward-facing normal: rotate tangent 90 deg, pick the side facing
    // the court centre (roughly toward the main axis, x=0).
    let nx = -dirZ;
    let nz = dirX;
    const nLen = Math.hypot(nx, nz) || 1;
    nx /= nLen;
    nz /= nLen;
    const towardCourtX = 0 - p.x;
    const towardCourtZ = 20 - p.z;
    if (nx * towardCourtX + nz * towardCourtZ < 0) {
      nx = -nx;
      nz = -nz;
    }

    for (const along of [-bayLength * 0.22, bayLength * 0.22]) {
      const win = createArchedWindow(w.windowWidth, w.windowHeight, Materials.stoneDarleyDale, Materials.glass);
      const wx = p.x + Math.cos(angle) * along + nx * (w.depth / 2 + 0.03);
      const wz = p.z - Math.sin(angle) * along + nz * (w.depth / 2 + 0.03);
      win.position.set(wx, 2.6, wz);
      win.rotation.y = Math.atan2(nx, nz);
      group.add(win);

      const win2 = win.clone();
      win2.position.y = 6.2;
      group.add(win2);
    }

    const cornice = createCornice(bayLength * 1.1, w.depth + 0.6, 0.4, Materials.stoneDarleyDale);
    cornice.position.set(p.x, w.wallHeight, p.z);
    cornice.rotation.y = angle;
    group.add(cornice);

    const bayBalustrade = createBrickWall(bayLength * 0.95, 0.7, w.depth * 0.7, Materials.stoneAshlar);
    bayBalustrade.position.set(p.x, w.wallHeight + 0.35, p.z);
    bayBalustrade.rotation.y = angle;
    group.add(bayBalustrade);

    // A mid-wing domed pavilion accent — real quadrant ranges aren't just
    // a plain repeating arcade the whole way, they punctuate the roofline
    // with domed bays. This one sits directly on top of the middle bay.
    if (i === Math.floor(w.bayCount / 2)) {
      const midDome = createDome(2.2, 1.0, 2.6, {
        drumMaterial: Materials.stoneAshlar,
        domeMaterial: Materials.domeCopperPatina,
        lanternHeight: 0.7,
        segments: 12,
      });
      midDome.position.set(p.x, w.wallHeight + 0.7, p.z);
      group.add(midDome);
    }
  }

  // Domed pavilion terminating the wing.
  const pav = w.pavilion;
  const pavShell = createBrickWall(pav.size, pav.height * 0.75, pav.size, Materials.brickWarm);
  pavShell.position.set(end.x, 0, end.z);
  group.add(pavShell);

  const pavCornice = createCornice(pav.size + 0.6, pav.size + 0.6, 0.4, Materials.stoneDarleyDale);
  pavCornice.position.set(end.x, pav.height * 0.75, end.z);
  group.add(pavCornice);

  const pavDome = createDome(pav.domeRadius, 1.6, pav.domeHeight, {
    drumMaterial: Materials.stoneAshlar,
    domeMaterial: Materials.domeCopperPatina,
    lanternHeight: pav.domeHeight * 0.3,
    segments: 12,
  });
  pavDome.position.set(end.x, pav.height * 0.75 + 0.6, end.z);
  group.add(pavDome);

  for (const face of [
    { x: 0, z: 1, ry: 0 },
    { x: 0, z: -1, ry: Math.PI },
    { x: 1, z: 0, ry: -Math.PI / 2 },
    { x: -1, z: 0, ry: Math.PI / 2 },
  ]) {
    const win = createArchedWindow(1.8, 3, Materials.stoneDarleyDale, Materials.glass);
    win.position.set(
      end.x + (face.x * pav.size) / 2 + face.x * 0.05,
      3,
      end.z + (face.z * pav.size) / 2 + face.z * 0.05
    );
    win.rotation.y = face.ry;
    group.add(win);
  }

  return group;
}

export function createAstonWebb(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(ASTON_WEBB.position.x, ASTON_WEBB.position.y, ASTON_WEBB.position.z);
  group.rotation.y = ASTON_WEBB.rotationY;

  group.add(buildCentralBlock());
  group.add(buildWing(1));
  group.add(buildWing(-1));

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

// ============================================================================
// campusData.ts
//
// Single source of truth for every real-world-derived position, size,
// rotation and height used in the scene. Nothing outside this file should
// contain a "magic" latitude/longitude or hand-guessed world coordinate —
// everything is derived here from documented anchor points so it can later
// be corrected with proper survey/archive/OpenStreetMap data without
// touching rendering code.
//
// Coordinate convention:
//   +X = East, -X = West
//   +Z = South, -Z = North
//   +Y = Up
//   1 unit = 1 metre
//   World origin (0,0,0) = ground level at the centre of Old Joe.
//
// Source notes (see README.md "Accuracy limitations" for full detail):
//  - University of Birmingham campus map: https://www.birmingham.ac.uk/contact/campus-map
//  - Historic England list entry 1076133 (Great Hall / Quadrant Range)
//  - Historic England list entry 1210306 (Chamberlain / "Old Joe" Tower)
//  - Lat/lon anchors are approximate (hand-read from public map imagery),
//    NOT a survey. Building footprints/heights are reasoned approximations
//    built to match the documented character of the buildings, not a scan.
//  - Any future OpenStreetMap-derived footprints used here must carry
//    "© OpenStreetMap contributors" and comply with the ODbL.
// ============================================================================

export interface LatLon {
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// Geographic anchors
// ---------------------------------------------------------------------------

/** World origin: ground centre of Old Joe. Everything is measured from here. */
export const ORIGIN_LATLON: LatLon = { lat: 52.44985, lon: -1.93068 };

export const ASTON_WEBB_LATLON: LatLon = { lat: 52.44893, lon: -1.93085 };

/** Bounding box for the Phase 1 playable area, per the design brief. */
export const AREA_BOUNDS_LATLON = {
  south: 52.44865,
  north: 52.4501,
  west: -1.9321,
  east: -1.92935,
};

// Metres-per-degree at the campus latitude (equirectangular local projection —
// accurate to well under a metre across an area this small).
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LON =
  111320 * Math.cos((ORIGIN_LATLON.lat * Math.PI) / 180);

/**
 * Convert a lat/lon into local world (X, Z) metres relative to ORIGIN_LATLON.
 * This is the ONLY place geographic coordinates get turned into world units.
 */
export function latLonToLocal(p: LatLon): { x: number; z: number } {
  const dLat = p.lat - ORIGIN_LATLON.lat;
  const dLon = p.lon - ORIGIN_LATLON.lon;
  const north = dLat * METERS_PER_DEG_LAT;
  const east = dLon * METERS_PER_DEG_LON;
  return { x: east, z: -north }; // north is -Z
}

export const ASTON_WEBB_LOCAL = latLonToLocal(ASTON_WEBB_LATLON);

// ---------------------------------------------------------------------------
// OLD JOE — Joseph Chamberlain Memorial Clock Tower
// ---------------------------------------------------------------------------

export const OLD_JOE = {
  position: { x: 0, y: 0, z: 0 },
  rotationY: 0,

  totalHeight: 100,

  // Stepped taper: each stage is slightly narrower than the one below,
  // approximating the tower's subtle continuous taper.
  baseStage: {
    height: 11,
    width: 11.4, // plan is square
    archWidth: 5,
    archHeight: 7.2,
    archDepth: 1.2, // wall thickness pierced by the archway
  },
  shaftStage: {
    height: 59, // 11 -> 70
    widthBottom: 10.6,
    widthTop: 9.2,
    bandCount: 5, // horizontal stone bands through the shaft
    bandHeight: 0.45,
    bayCount: 3, // recessed vertical arch-panels per face
  },
  clockStage: {
    height: 10, // 70 -> 80
    width: 9.0,
    clockDiameter: 5.2,
    clockCenterHeight: 75.5, // absolute height of clock centre
  },
  bellStage: {
    height: 12, // 80 -> 92
    width: 8.4,
    archOpeningWidth: 3.2,
    archOpeningHeight: 6.5,
  },
  parapetStage: {
    height: 2.4, // 92 -> 94.4
    width: 9.0, // slightly oversailing cornice
  },
  roof: {
    height: 4.6, // 94.4 -> 99
    baseWidth: 8.6,
  },
  finial: {
    height: 1.0, // 99 -> 100
  },
};

// ---------------------------------------------------------------------------
// ASTON WEBB / GREAT HALL + curved quadrant wings
// ---------------------------------------------------------------------------

export const ASTON_WEBB = {
  position: { x: ASTON_WEBB_LOCAL.x, y: 0, z: ASTON_WEBB_LOCAL.z },
  // Facade normal points north (-Z) toward Chancellor's Court / Old Joe.
  rotationY: 0,

  centralBlock: {
    width: 34,
    depth: 26,
    wallHeight: 16,
    archWindow: {
      width: 9,
      height: 8,
      sillHeight: 7.4,
      mullions: 4,
    },
    entrance: {
      width: 7,
      height: 5.5,
      recessDepth: 3.2,
    },
    turret: {
      size: 5.2,
      height: 22, // total incl. dome, from ground
      domeRadius: 3.1,
    },
    dome: {
      drumHeight: 4.5,
      drumRadius: 8.2,
      domeHeight: 9,
      lanternHeight: 3,
    },
  },

  // Each curved quadrant wing is built as a ring of straight bay segments
  // approximating an arc, sweeping out from the central block toward Old
  // Joe and terminating in a domed pavilion. Defined once and mirrored.
  wing: {
    archRadius: 92,
    // Angles measured from the arc centre, 0 = due north, positive = east.
    startAngleDeg: 14, // where the wing leaves the central block
    endAngleDeg: 74, // where the wing ends at the pavilion
    bayCount: 9,
    wallHeight: 9.5,
    depth: 9,
    windowWidth: 1.8,
    windowHeight: 3.2,
    pavilion: {
      size: 8.5,
      height: 12.5,
      domeRadius: 4.4,
      domeHeight: 5,
    },
  },

  // Centre that the wing arcs sweep around (south of the central block, so
  // the wings curve away to embrace Chancellor's Court to the north).
  arcCenterOffset: { x: 0, z: 6 },
};

// ---------------------------------------------------------------------------
// CHANCELLOR'S COURT — lawns, paths, planting
// ---------------------------------------------------------------------------

export const TERRAIN = {
  size: 1000, // large ground plane covering the wider campus map
  segments: 180,
  // Subtle, configurable elevation — a gentle rise from the court up
  // toward Old Joe, refined later with survey data.
  elevation: {
    amplitude: 0.6,
    frequency: 0.02,
    seed: 1337,
  },
};

export interface PathSegment {
  /** Control points of the path centreline, in local world XZ. */
  points: { x: number; z: number }[];
  width: number;
}

// Main axial path (Old Joe <-> Great Hall) plus curved court paths that
// echo the quadrant geometry. All hand-authored here, not scattered in code.
export const PATHS: PathSegment[] = [
  {
    // Central axial path linking Old Joe to the Great Hall entrance.
    points: [
      { x: 0, z: 6 },
      { x: 0, z: 30 },
      { x: ASTON_WEBB_LOCAL.x * 0.3, z: 60 },
      { x: ASTON_WEBB_LOCAL.x, z: 92 },
    ],
    width: 5.5,
  },
  {
    // Perimeter path, west side, following the court's curve.
    points: [
      { x: -46, z: 100 },
      { x: -58, z: 70 },
      { x: -58, z: 40 },
      { x: -46, z: 12 },
      { x: -30, z: -2 },
    ],
    width: 3.4,
  },
  {
    // Perimeter path, east side, mirrored.
    points: [
      { x: 46, z: 100 },
      { x: 58, z: 70 },
      { x: 58, z: 40 },
      { x: 46, z: 12 },
      { x: 30, z: -2 },
    ],
    width: 3.4,
  },
  {
    // Path skirting the front of Aston Webb, connecting the wing ends.
    points: [
      { x: -52, z: 96 },
      { x: -20, z: 88 },
      { x: 0, z: 86 },
      { x: 20, z: 88 },
      { x: 52, z: 96 },
    ],
    width: 3,
  },
];

// Paved plaza radii immediately around the two hero landmarks.
export const PAVING = {
  oldJoeRadius: 16,
  astonWebbForecourtDepth: 20,
  astonWebbForecourtWidth: 70,
};

export const LAWN = {
  // Two principal lawn panels flanking the central axial path.
  panels: [
    { center: { x: -22, z: 45 }, width: 34, depth: 70 },
    { center: { x: 22, z: 45 }, width: 34, depth: 70 },
  ],
};

// Tree placement: hand-placed "specimen" trees for visual composition plus
// a scatter density for the wider court, kept well clear of paths/buildings.
export const TREES = {
  specimen: [
    { x: -34, z: 20, scale: 1.15 },
    { x: 34, z: 22, scale: 1.05 },
    { x: -40, z: 55, scale: 0.95 },
    { x: 40, z: 58, scale: 1.2 },
    { x: -30, z: 80, scale: 1.0 },
    { x: 30, z: 78, scale: 0.9 },
    { x: -14, z: 8, scale: 0.8 },
    { x: 14, z: 8, scale: 0.85 },
  ],
  scatterCount: 26,
  scatterSeed: 42,
  minSpacing: 9,
};

export const LAMP_POSTS = {
  spacingAlongPath: 14,
  height: 4.2,
};

// ---------------------------------------------------------------------------
// Optional current-era detail
// ---------------------------------------------------------------------------

export type CampusEra = "2026" | "historical";

export const CAMPUS_CONFIG = {
  campusEra: "2026" as CampusEra,
};

export const RED_STACK = {
  position: { x: 10, z: 34 },
  height: 4,
};

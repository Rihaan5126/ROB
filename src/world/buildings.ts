// ============================================================================
// buildings.ts
//
// The single registry of interactive locations on the map. Every building
// that should be hoverable/clickable/explorable is declared here, once —
// CampusScene tags meshes against this list, the picking controller reads
// it for hover/click behaviour, and the info panel + detail viewer read it
// for content. Adding a new building later means adding one entry here
// (plus a model-builder function) — nothing else in the interaction
// pipeline needs to change.
//
// Old Joe and Aston Webb are bespoke, hand-modelled landmarks with their
// own "Explore in 3D" viewer. The rest of the campus is generated from
// real OpenStreetMap footprints (campusBuildings.ts) — real position,
// real plan shape, real height, just simplified massing instead of
// bespoke architectural detail.
// ============================================================================

import * as THREE from "three";
import { createOldJoe } from "./OldJoe";
import { createAstonWebb } from "./AstonWebb";
import { createRealBuilding } from "./GenericBuilding";
import { OLD_JOE, ASTON_WEBB } from "./campusData";
import { CAMPUS_BUILDINGS, type RealBuildingCategory } from "./campusBuildings";

export type BuildingCategory = "landmark" | RealBuildingCategory;

export interface CameraFraming {
  /** World-space point the camera looks at. */
  target: THREE.Vector3;
  /** Camera position offset relative to `target`. */
  offset: THREE.Vector3;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Short standfirst shown in the info panel. */
  description: string;
  /** Ground position, used for the hover highlight ring and as a fallback. */
  groundPosition: THREE.Vector3;
  /** Camera framing used when this building is selected on the overview map. */
  overviewFraming: CameraFraming;
  /** Radius of the ground footprint, for the hover highlight ring size. */
  footprintRadius: number;
  /** Whether "Explore in 3D" is available for this building. */
  hasDetailView: boolean;
  /** Builds this building's Three.js model. Called once at scene setup,
   * and again each time the detail viewer opens (it needs its own,
   * independent copy of the model). An optional per-frame `update` (e.g.
   * Old Joe's clock hands) is called once a frame while the model is on
   * screen, in either the overview or the detail viewer. */
  buildModel: () => { group: THREE.Group; update?: (date: Date) => void };
  /** Camera framing used inside the dedicated detail viewer. */
  detailFraming?: CameraFraming;
}

export const BUILDINGS: BuildingDefinition[] = [
  {
    id: "old-joe",
    name: "Old Joe",
    category: "landmark",
    description:
      "The Joseph Chamberlain Memorial Clock Tower — at 100 metres, the tallest free-standing clock tower in the world and the defining silhouette of the Edgbaston campus. Modelled on the Torre del Mangia in Siena, it has stood at the heart of the University since 1908.",
    groundPosition: new THREE.Vector3(OLD_JOE.position.x, 0, OLD_JOE.position.z),
    overviewFraming: {
      target: new THREE.Vector3(OLD_JOE.position.x, 34, OLD_JOE.position.z),
      offset: new THREE.Vector3(52, 26, 52),
    },
    detailFraming: {
      target: new THREE.Vector3(0, 50, 0),
      offset: new THREE.Vector3(0, 20, 140),
    },
    footprintRadius: 9,
    hasDetailView: true,
    buildModel: () => createOldJoe(),
  },
  {
    id: "aston-webb",
    name: "Aston Webb Building",
    category: "landmark",
    description:
      "Home to the Great Hall, designed by Sir Aston Webb and Ingress Bell and opened in 1909. Its red brick, terracotta dressing and green copper domes set the architectural language for the whole campus, and its curved quadrant wings embrace Chancellor's Court.",
    groundPosition: new THREE.Vector3(ASTON_WEBB.position.x, 0, ASTON_WEBB.position.z),
    overviewFraming: {
      target: new THREE.Vector3(ASTON_WEBB.position.x, 12, ASTON_WEBB.position.z - 5),
      offset: new THREE.Vector3(-48, 24, 62),
    },
    detailFraming: {
      target: new THREE.Vector3(0, 12, -5),
      offset: new THREE.Vector3(0, 14, 70),
    },
    footprintRadius: 26,
    hasDetailView: true,
    buildModel: () => ({ group: createAstonWebb() }),
  },
];

// ---------------------------------------------------------------------------
// Hand-written standfirsts for the buildings most people will actually
// look for. Everything else in CAMPUS_BUILDINGS gets a sensible
// category-based description generated below — accurate positions/shapes
// for all 58 are far more valuable than hand-written copy for every one.
// ---------------------------------------------------------------------------

const CURATED_DESCRIPTIONS: Record<string, string> = {
  "guild-of-students":
    "The students' union — home to clubs, societies, bars and campaigns, and the social heart of student life at Birmingham.",
  "main-library": "The University's principal library, at the heart of campus for every discipline.",
  "muirhead-tower": "A landmark tower housing the College of Arts and Law.",
  "the-barber-institute-of-fine-arts":
    "An art gallery and concert hall housing an internationally significant collection, from Old Masters to the Impressionists.",
  "staff-house": "A social and dining hub for University staff.",
  "university-house": "Student support and administrative services.",
  "university-centre": "Campus shops, services and amenities.",
  "business-school": "Home to Birmingham Business School.",
  "computer-science": "Teaching, labs and research space for the School of Computer Science.",
  "murray-learning-centre": "A central library and 24-hour study space.",
  "bramall-music-building": "Home to the Department of Music and its concert hall, hosting recitals year-round.",
  "haworth-building": "Teaching and research space for Chemistry.",
  "poynting-building": "Home to the School of Physics and Astronomy.",
  "watson-building": "Teaching and research laboratories.",
  "law-building": "Home to Birmingham Law School.",
  "lapworth-museum-of-geology": "The University's geology museum, open to the public.",
  "university-of-birmingham-sport-and-fitness": "The University's main sport and fitness centre, open to students, staff and the public.",
};

function autoDescription(name: string, category: RealBuildingCategory): string {
  switch (category) {
    case "hall":
      return `${name} — University of Birmingham student accommodation.`;
    case "sport":
      return `${name} — a University of Birmingham sport and recreation facility.`;
    case "amenity":
      return `${name} — a University of Birmingham campus amenity.`;
    default:
      return `${name} — a University of Birmingham academic building.`;
  }
}

for (const spec of CAMPUS_BUILDINGS) {
  const groundPosition = new THREE.Vector3(spec.x, 0, spec.z);
  let footprintRadius = 6;
  for (const [fx, fz] of spec.footprint) footprintRadius = Math.max(footprintRadius, Math.hypot(fx, fz));
  footprintRadius += 3;

  const camDist = Math.max(30, spec.height * 2.4, footprintRadius * 2.6);

  BUILDINGS.push({
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: CURATED_DESCRIPTIONS[spec.id] ?? autoDescription(spec.name, spec.category),
    groundPosition,
    footprintRadius,
    hasDetailView: false,
    overviewFraming: {
      target: new THREE.Vector3(spec.x, spec.height * 0.5, spec.z),
      offset: new THREE.Vector3(camDist * 0.62, camDist * 0.58, camDist * 0.72),
    },
    buildModel: () => {
      const group = createRealBuilding(spec);
      group.position.set(spec.x, 0, spec.z);
      return { group };
    },
  });
}

export function getBuilding(id: string): BuildingDefinition | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

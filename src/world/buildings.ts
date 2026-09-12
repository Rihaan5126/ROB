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
// ============================================================================

import * as THREE from "three";
import { createOldJoe } from "./OldJoe";
import { createAstonWebb } from "./AstonWebb";
import { createGenericBuilding } from "./GenericBuilding";
import { Materials } from "../materials/materials";
import { OLD_JOE, ASTON_WEBB } from "./campusData";

export type BuildingCategory = "landmark" | "academic" | "hall" | "sport" | "amenity";

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
// The wider campus — simplified massing, still fully interactive
// (hoverable, nameable, clickable, camera-framed), just without a
// dedicated detail viewer. Positions are reasoned approximations of the
// real relative layout south/east/west of Chancellor's Court, not survey
// data — see README "Accuracy limitations".
// ---------------------------------------------------------------------------

interface SimpleBuildingSpec {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  facade: THREE.Material;
  rotationY?: number;
}

function buildSimple(spec: SimpleBuildingSpec): BuildingDefinition {
  const groundPosition = new THREE.Vector3(spec.x, 0, spec.z);
  const footprintRadius = Math.hypot(spec.width, spec.depth) / 2 + 3;
  const camDist = Math.max(28, spec.height * 2.2, footprintRadius * 2.4);

  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    groundPosition,
    footprintRadius,
    hasDetailView: false,
    overviewFraming: {
      target: new THREE.Vector3(spec.x, spec.height * 0.45, spec.z),
      offset: new THREE.Vector3(camDist * 0.6, camDist * 0.55, camDist * 0.75),
    },
    buildModel: () => ({
      group: (() => {
        const group = createGenericBuilding({
          width: spec.width,
          depth: spec.depth,
          height: spec.height,
          facadeMaterial: spec.facade,
          rotationY: spec.rotationY,
          entrance: true,
        });
        group.position.set(spec.x, 0, spec.z);
        return group;
      })(),
    }),
  };
}

const SIMPLE_BUILDINGS: SimpleBuildingSpec[] = [
  {
    id: "muirhead-tower",
    name: "Muirhead Tower",
    category: "academic",
    description:
      "A landmark 1960s tower housing the College of Arts and Law, standing tall over University Square south of Chancellor's Court.",
    x: 4,
    z: 225,
    width: 34,
    depth: 22,
    height: 46,
    facade: Materials.facadeModern,
  },
  {
    id: "main-library",
    name: "Main Library",
    category: "academic",
    description:
      "The University's principal library, at the centre of University Square — millions of items and thousands of study spaces for every discipline on campus.",
    x: 42,
    z: 232,
    width: 40,
    depth: 26,
    height: 20,
    facade: Materials.facadeModern,
    rotationY: -0.3,
  },
  {
    id: "guild-of-students",
    name: "Guild of Students",
    category: "amenity",
    description:
      "The students' union — home to clubs, societies, bars and campaigns, and the social heart of student life at Birmingham.",
    x: -62,
    z: 175,
    width: 36,
    depth: 24,
    height: 14,
    facade: Materials.facadeHall,
    rotationY: 0.4,
  },
  {
    id: "bramall-music-building",
    name: "Bramall Music Building",
    category: "academic",
    description:
      "Home to the Department of Music and the Bramall Music Building's concert hall, hosting recitals and performances year-round.",
    x: -95,
    z: 235,
    width: 26,
    depth: 22,
    height: 16,
    facade: Materials.facadeAcademic,
    rotationY: 0.2,
  },
  {
    id: "school-of-engineering",
    name: "School of Engineering",
    category: "academic",
    description:
      "Teaching and research space for Chemical, Civil, Mechanical and Electronic Engineering, on the eastern side of campus.",
    x: 95,
    z: 185,
    width: 38,
    depth: 26,
    height: 22,
    facade: Materials.facadeAcademic,
    rotationY: -0.5,
  },
  {
    id: "computer-science",
    name: "School of Computer Science",
    category: "academic",
    description:
      "Teaching, labs and research space for Computer Science, part of the School of Computer Science on the east side of campus.",
    x: 118,
    z: 145,
    width: 28,
    depth: 20,
    height: 18,
    facade: Materials.facadeModern,
    rotationY: -0.5,
  },
  {
    id: "munrow-sports-centre",
    name: "Munrow Sports Centre",
    category: "sport",
    description:
      "The University's main sport and fitness centre — a gym, courts and pools open to students, staff and the public.",
    x: -45,
    z: 320,
    width: 44,
    depth: 30,
    height: 13,
    facade: Materials.facadeModern,
    rotationY: 0.15,
  },
  {
    id: "vale-village",
    name: "The Vale Village",
    category: "hall",
    description:
      "Halls of residence set around parkland and a lake — one of the largest self-contained student villages of any UK university.",
    x: -130,
    z: 300,
    width: 30,
    depth: 20,
    height: 15,
    facade: Materials.facadeHall,
    rotationY: -0.25,
  },
  {
    id: "barber-institute",
    name: "Barber Institute of Fine Arts",
    category: "amenity",
    description:
      "An art gallery and concert hall housing an internationally significant collection, from Old Masters to the Impressionists.",
    x: 65,
    z: 290,
    width: 22,
    depth: 18,
    height: 12,
    facade: Materials.facadeAcademic,
    rotationY: 0.6,
  },
];

BUILDINGS.push(...SIMPLE_BUILDINGS.map(buildSimple));

export function getBuilding(id: string): BuildingDefinition | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

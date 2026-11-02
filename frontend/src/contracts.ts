export interface Property {
  key: string;
  value: string | number | boolean;
  type: "number" | "string" | "boolean" | "enum";
  unit: string;
  choices?: string[];
}
export interface Material {
  name: string;
  density: number;
  type: string;
}
export interface Component {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  length: number;
  mass: number | null;
  properties: Property[];
  shape: Record<string, number>;
  locations: number[][];
  children: Component[];
  compatibleTypes: string[];
  material?: Material;
  deployment?: Property[];
  separation?: Property[];
  motorConfiguration?: Property[];
  stageEnabled?: boolean;
  cluster?: { pattern: string; choices: string[] };
  presetType?: string | null;
  appearance?: { color: string; shine: number; hasTexture: boolean };
  finPoints?: number[][];
}
export interface MotorReference {
  id: string;
  designation: string;
  manufacturer: string;
  diameter: number;
  length: number;
  impulse: number;
  launchMass: number;
  burnTime: number;
  source: string;
  description: string;
  delays: (number | null)[];
  time?: number[];
  thrust?: number[];
}
export interface FlightConfiguration {
  id: string;
  name: string;
}
export interface SimulationSettings {
  name: string;
  configurationId: string;
  options: Property[];
  windLevels: {
    altitude: number;
    speed: number;
    direction: number;
    standardDeviation: number;
  }[];
  windAltitudeReference: string;
  wind: { average: number; standardDeviation: number; direction: number };
}
export interface Warning {
  code?: string;
  message: string;
  sourceId?: string;
}
export interface Project {
  id: string;
  revision: number;
  hash: string;
  name: string;
  rocket: Component;
  quantities: {
    dryMass: number | null;
    loadedMass: number | null;
    dryCG: number | null;
    loadedCG: number | null;
    cp: number | null;
    length: number;
    referenceDiameter: number;
    stability: number | null;
  };
  hasMotors: boolean;
  warnings: string[];
  importWarnings: string[];
  conversionAccepted: boolean;
  simulations: SimulationSettings[];
  configurations: FlightConfiguration[];
  selectedConfigurationId: string;
  mounts: {
    id: string;
    name: string;
    motor: string | null;
    delay: number | null;
  }[];
  savedAt: string;
  expressions: {
    name: string;
    symbol: string;
    unit: string;
    expression: string;
  }[];
}
export interface SimulationJob {
  id: string;
  projectId: string;
  revision: number;
  state: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number | null;
  error: string | null;
}
export interface FlightEvent {
  type: string;
  time: number;
  sourceId: string | null;
  detail: string | null;
}
export interface Variable {
  key: string;
  name: string;
  unit: string;
  values: (number | null)[];
}
export interface Branch {
  name: string;
  variables: Variable[];
  events: FlightEvent[];
}
export interface SimulationRun {
  kind?: string;
  id: string;
  projectId: string;
  revision: number;
  designHash: string;
  configurationHash: string;
  configurationId: string;
  engine: { version: string; commit: string; solver: string };
  status: SimulationJob["state"];
  error: string | null;
  summary?: {
    maxAltitude: number | null;
    maxSpeed: number | null;
    maxAcceleration: number | null;
    flightTime: number | null;
  };
  branches?: Branch[];
  warnings?: string[];
  options: Property[];
  startedAt: string;
  completedAt: string;
}
// Future operations: contracts do not imply an implemented endpoint; see parity matrix.
export interface AnalysisRequest {
  revision: number;
  configurationId: string;
  mach: number;
  angleOfAttack: number;
  rollAngle: number;
}
export interface OptimizationRequest {
  revision: number;
  objective: string;
  parameters: {
    componentId: string;
    property: string;
    min: number;
    max: number;
  }[];
  constraints: { quantity: string; min?: number; max?: number }[];
}
export interface AIProposedPatch {
  id: string;
  projectId: string;
  baseRevision: number;
  reason: string;
  expectedTradeoff: string;
  changes: {
    componentId: string;
    property: string;
    before: unknown;
    after: unknown;
  }[];
  status: "proposed" | "accepted" | "rejected";
}

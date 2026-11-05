import { useState, useRef, useEffect } from "react";
export const PROPERTY_HELP: Record<string, string> = {
  name: "A label for this part in the hierarchy.",
  length: "Length along the rocket. Enter millimetres.",
  outerRadius: "Outside radius: half the outside diameter.",
  innerRadius: "Radius of the opening inside the tube.",
  baseRadius: "Radius at the base of the nose cone.",
  foreRadius: "Radius at the front of the transition.",
  aftRadius: "Radius at the rear of the transition.",
  thickness: "Thickness of the wall or fin material.",
  rootChord: "Length of the fin edge attached to the body.",
  tipChord: "Length of the outer edge of the fin.",
  height: "How far this fin extends out from the body.",
  sweep: "How far the fin tip is shifted toward the tail.",
  finCount: "Number of physical fins in this set.",
  cantAngle: "Twist angle of the fins; can make the rocket roll.",
  axialMethod:
    "Reference used to place this part. Bottom aligns rear ends; Top aligns front ends.",
  axialOffset:
    "Distance from the selected placement reference. Zero aligns it with that reference.",
  shapeType: "Profile used by the engine for the nose or transition.",
  shapeParameter: "Adjusts the selected shape profile.",
  outerRadiusAutomatic:
    "Match this radius to neighbouring geometry automatically.",
  filled: "Model this part as solid instead of hollow.",
  overrideMass:
    "A measured mass that replaces the engine calculation when enabled.",
  massOverridden: "Enable a measured mass override.",
  overrideCGX:
    "Measured balance position along the part when CG override is enabled.",
  CGOverridden:
    "Use a specified balance position instead of the calculated one.",
  overrideCD: "Drag coefficient used when the CD override is enabled.",
  CDOverridden: "Replace the calculated drag coefficient.",
  motorMount: "Allow this tube to carry a motor.",
  motorOverhang: "Length of motor extending behind its mount.",
  launchRodLength: "Length of the guide supporting the rocket at launch.",
  launchRodAngle: "Tilt away from vertical.",
  launchRodDirection: "Direction the tilted guide points.",
  launchIntoWind:
    "Orient the launch guide into the wind using the engine setting.",
  launchAltitude: "Launch-site elevation above sea level, in metres.",
  launchLatitude: "Latitude of the launch site, in degrees.",
  launchLongitude: "Longitude of the launch site, in degrees.",
  ISAAtmosphere: "Use the standard atmosphere model.",
  launchTemperature: "Air temperature in kelvin.",
  launchPressure: "Air pressure in pascals.",
  timeStep:
    "Numerical time-step setting. Smaller steps may take longer to compute.",
  maxSimulationTime: "Maximum simulated flight duration, in seconds.",
  maximumStepAngle: "Angular limit used by the numerical solver.",
  randomSeed:
    "Controls part of the simulation randomness; turbulent wind is not fully reproducible.",
  geodeticComputation:
    "How the engine represents Earth: flat, spherical or WGS84.",
  windModelType: "Choose average wind or a profile that changes with altitude.",
  deployEvent: "Event that triggers this recovery device.",
  deployDelay: "Wait after the trigger, in seconds.",
  deployAltitude: "Altitude at which a descending rocket triggers deployment.",
  ignitionEvent: "Event that ignites this motor.",
  ignitionDelay: "Wait after the ignition trigger.",
  ejectionDelay: "Time from motor burnout to its ejection event.",
  separationEvent: "Event that separates this stage.",
  separationDelay: "Wait after the separation trigger.",
  separationAltitude:
    "Altitude threshold for the applicable separation trigger.",
  CD: "Drag coefficient used for this component, including recovery devices.",
  area: "Area used by the selected component's geometry model.",
  aspectRatio: "Ratio between the component's span and length dimensions.",
  baseHeight: "Height of the base section of this component.",
  cantPivot: "Reference point around which the fin cant angle is applied.",
  clipped: "Apply the clipped geometry option for this component.",
  clusterScaleAbsolute: "Absolute spacing scale of motors in a cluster.",
  customReferenceLength:
    "User-defined reference length used for aerodynamic coefficients.",
  density: "Material density used to calculate this component's mass.",
  filletRadius: "Radius of the reinforcing fillet where a fin meets its body.",
  flangeHeight: "Height of this rail button's flange.",
  flipped: "Reverse the orientation of this component.",
  packedLength: "Length occupied by the recovery device when packed.",
  packedRadius: "Radius occupied by the recovery device when packed.",
  perfectFinish: "Use the engine's perfect surface-finish assumption.",
  screwHeight: "Height of the screw section of this rail button.",
  totalHeight: "Overall height of this component.",
  innerDiameter:
    "Diameter of the opening inside the component; twice its inner radius.",
  outerDiameter: "Overall outside diameter; twice the outside radius.",
  radius: "Radius of this component, measured from its centre.",
  radiusAutomatic:
    "Let the engine determine the applicable radius automatically.",
  innerRadiusAutomatic:
    "Determine the inner radius automatically from related geometry.",
  baseRadiusAutomatic:
    "Match the base radius to neighbouring geometry automatically.",
  foreRadiusAutomatic:
    "Match the front radius to neighbouring geometry automatically.",
  aftRadiusAutomatic:
    "Match the rear radius to neighbouring geometry automatically.",
  crossSection:
    "Shape of the fin's cross section, used in aerodynamic calculations.",
  tabHeight: "Depth of the fin tab extending into the body.",
  tabLength: "Length of the fin tab along the rocket.",
  tabOffset: "Position of the fin tab relative to its chosen reference.",
  tabOffsetMethod: "Reference used to position the fin tab.",
  sweepAngle: "Angle describing how far a fin sweeps toward the tail.",
  baseRotation: "Rotation of the component around the rocket axis.",
  radialPosition: "Distance of this component from the rocket axis.",
  radialDirection:
    "Direction around the rocket axis in which the component is offset.",
  radiusMethod:
    "Reference used to place repeated or side-mounted components radially.",
  radiusOffset: "Radial distance from the selected placement reference.",
  angleMethod: "Reference used for angular placement around the rocket.",
  angleOffset: "Angular offset around the rocket axis.",
  angleSeparation: "Angle between repeated components around the rocket.",
  instanceCount: "Number of repeated instances of this component.",
  instanceSeparation: "Spacing between repeated instances of this component.",
  mass: "Specified mass of the selected component.",
  componentMass: "Mass of this component without its children.",
  subcomponentsOverriddenMass:
    "Include child components in this mass override.",
  subcomponentsOverriddenCG:
    "Include child components in this balance-point override.",
  subcomponentsOverriddenCD: "Include child components in this drag override.",
  clusterScale: "Spacing scale used for the selected motor-cluster pattern.",
  clusterRotation: "Rotation of the motor-cluster pattern around the mount.",
  diameter:
    "Diameter of this component; for a parachute, its deployed canopy diameter.",
  lineCount: "Number of parachute shroud lines.",
  lineLength: "Length of each parachute shroud line.",
  cordLength: "Total length of this shock cord.",
  stripLength: "Length of the recovery streamer.",
  stripWidth: "Width of the recovery streamer.",
  CDAutomatic:
    "Let the engine calculate the drag coefficient for this component.",
  finish: "Surface roughness used by the aerodynamic drag model.",
  foreShoulderLength:
    "Length of the front shoulder inserted into the adjacent tube.",
  foreShoulderRadius: "Radius of the front shoulder.",
  foreShoulderThickness: "Wall thickness of the front shoulder.",
  foreShoulderCapped: "Close the end of the front shoulder.",
  aftShoulderLength:
    "Length of the rear shoulder inserted into the adjacent tube.",
  aftShoulderRadius: "Radius of the rear shoulder.",
  aftShoulderThickness: "Wall thickness of the rear shoulder.",
  aftShoulderCapped: "Close the end of the rear shoulder.",
  shoulderLength: "Length of the shoulder that fits inside the next tube.",
  shoulderRadius: "Outside radius of the shoulder.",
  shoulderThickness: "Wall thickness of the shoulder.",
  shoulderCapped: "Close the end of the shoulder.",
  comment: "Your notes about this component, retained in the design file.",
};
const lessons = [
  {
    title: "Design a rocket. Understand its flight.",
    tag: "WELCOME TO HOSHI",
    text: "Assemble real components, edit their dimensions and materials, then calculate a flight with OpenRocket 24.12. Start with an example if you are learning.",
    items: [
      "Choose an example or a blank design.",
      "Select a part, edit it, then simulate.",
      "Inspect real results and export your work.",
    ],
  },
  {
    title: "Choose your starting point",
    tag: "01 / PROJECTS",
    text: "If asked, connect your engine using its website address and hosting access password. Then choose a project. Examples include geometry, motors and launch settings. A blank design starts with an empty stage.",
    items: [
      "New project: build from scratch.",
      "Examples: learn from a complete rocket.",
      "Recent projects or Import: continue existing work.",
    ],
  },
  {
    title: "Hierarchy: your assembly, on the left",
    tag: "02 / HIERARCHY",
    text: "The hierarchy lists the actual parts. Indented parts belong to the component above them. Click a part here or in the scene to select it.",
    items: [
      "A stage contains nose cones and body tubes.",
      "A body tube can contain fins, recovery devices and motor tubes.",
      "Duplicate, reorder or delete selected parts from the hierarchy toolbar.",
    ],
  },
  {
    title: "Add parts without guessing the parent",
    tag: "03 / COMPONENTS",
    text: "Click Add Component, search for a part, and choose where to attach it. The picker finds compatible parents and explains where the part will go.",
    items: [
      "A nose cone or body tube attaches to a stage.",
      "Fins attach to a body tube.",
      "A motor is assigned to a body or inner tube through Choose motor.",
    ],
  },
  {
    title: "Inspector: change one part at a time",
    tag: "04 / INSPECTOR",
    text: "The right panel shows the selected part’s settings. Edit a value and press Enter or click away to apply it. Units are shown beside each value.",
    items: [
      "Geometry: lengths, radii, thickness and fin dimensions.",
      "Material: changes density and calculated mass.",
      "Placement and advanced settings: attachment, recovery and overrides. Hover labels for help.",
    ],
  },
  {
    title: "Scene: inspect the shape and balance",
    tag: "05 / SCENE",
    text: "Use the side view to select parts, pan and zoom. Rear and 3D show engine-generated meshes. The side drawing is a schematic.",
    items: [
      "CG is the loaded balance point. CP is an aerodynamic reference point.",
      "Stability is a reference calculation, not a guarantee of a successful flight.",
      "Drag the panel dividers to give the scene or inspector more room.",
    ],
  },
  {
    title: "Check the setup, then launch",
    tag: "06 / SIMULATION",
    text: "Validate checks geometry. Flight settings chooses motor configurations, recovery, launch guide, atmosphere and wind. Run the selected simulation with Simulate launch.",
    items: [
      "A blank design needs geometry, a compatible motor and simulation settings.",
      "The drawing configuration and the simulation configuration can differ.",
      "Pending, running, completed and failed describe actual engine jobs.",
    ],
  },
  {
    title: "Read the results in the lower dock",
    tag: "07 / RESULTS",
    text: "The lower dock stays inside the editor window. Explore altitude, speed, acceleration, events and saved runs. Hover plots to read samples.",
    items: [
      "Events include burnout, apogee, deployment and ground contact when they occur.",
      "Compare saved runs; older results keep their original design revision.",
      "Playback replays recorded samples. It does not run another simulation.",
    ],
  },
  {
    title: "Save, export and keep learning",
    tag: "08 / YOUR WORK",
    text: "Accepted edits are saved on the engine server. Export an .ork file to keep a copy on your computer. Free hosting can lose server files after a restart.",
    items: [
      "Undo and Redo work on edits in the current session.",
      "Tools contains working advanced analysis, expressions and exports.",
      "Open Help at any time to replay this guide or search the reference.",
    ],
  },
];
export function Walkthrough({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const l = lessons[step];
  return (
    <dialog
      className="tour-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="tour-art" aria-hidden="true">
        <div className="tour-orbit" />
        <div className="tour-rocket">↑</div>
        <span>BUILD · TUNE · FLY</span>
      </div>
      <div className="tour-copy">
        <span className="eyebrow">{l.tag}</span>
        <h1>{l.title}</h1>
        <p>{l.text}</p>
        <ul>
          {l.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <div
          className="tour-progress"
          aria-label={`Guide step ${step + 1} of ${lessons.length}`}
        >
          {lessons.map((_, i) => (
            <button
              key={i}
              aria-label={`Guide step ${i + 1}`}
              className={step === i ? "active" : ""}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <footer>
          <button onClick={close}>Skip introduction</button>
          <div>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)}>Back</button>
            )}
            <button
              className="primary"
              onClick={() =>
                step === lessons.length - 1 ? close() : setStep((s) => s + 1)
              }
            >
              {step === lessons.length - 1 ? "Finish guide" : "Next"}
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
export function HelpReference({ replay }: { replay: () => void }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <p>
        Select a component in the hierarchy, then edit its properties in the
        Inspector. The scene and result dock share one editor window.
      </p>
      <button onClick={replay}>Replay the guided introduction</button>
      <p className="helper">
        Shortcuts: Ctrl/Cmd + Z to undo, Shift + Ctrl/Cmd + Z to redo, Ctrl/Cmd
        + D to duplicate, Delete to remove a part, Shift + Ctrl/Cmd + A to add a
        component, and F to fit the side view.
      </p>
      <input
        className="search"
        aria-label="Search help"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a setting: stability, fins, recovery…"
      />
      <div className="help-reference">
        {Object.entries({
          ...PROPERTY_HELP,
          CG: "Centre of gravity: the loaded rocket’s balance point.",
          CP: "Centre of pressure: an aerodynamic reference point shown at Mach 0.3.",
          stability:
            "Static reference margin in body diameters. Positive alone does not establish a successful flight.",
          configuration:
            "Motor and stage arrangement. Each simulation can use its own configuration.",
          results:
            "Computed flight data. Earlier runs stay attached to their original revision.",
          analysis: "Inspect aerodynamic coefficients at specified conditions.",
          optimization:
            "Proposes dimension changes using engine objectives. Inspect and explicitly accept a candidate to apply it.",
          export:
            "Download a portable .ork design or computed data. This protects your work when free-host server files disappear.",
        })
          .filter(([key, text]) =>
            (key.replace(/([a-z])([A-Z])/g, "$1 $2") + " " + text)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map(([key, text]) => (
            <article key={key}>
              <strong>{key.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong>
              <p>{text}</p>
            </article>
          ))}
      </div>
    </>
  );
}

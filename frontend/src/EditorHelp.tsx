import { useState } from "react";
export const PROPERTY_HELP: Record<string, string> = {
  name: "A label for this part in the hierarchy.",
  length: "Length along the rocket. Enter millimetres.",
  outerRadius: "Outside radius: half the outside diameter.",
  baseDiameter: "Diameter at the base of the nose cone; twice its base radius.",
  foreDiameter: "Outside diameter at the front of the transition.",
  aftDiameter: "Outside diameter at the rear of the transition.",
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
export function HelpReference({ replay }: { replay: () => void }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <p>
        Select a component in the hierarchy, then edit its properties in the
        Inspector. Use Design workspace for editing and Flight Simulation for
        launch setup and flight results.
      </p>
      <button onClick={replay}>Replay the guided introduction</button>
      <p>
        <a
          href="guide-ar.html"
          target="_blank"
          rel="noreferrer"
          lang="ar"
          dir="rtl"
        >
          دليل المحاكي بالعربية — شرح الأزرار والحقول مع الأسماء الإنجليزية
        </a>
      </p>
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

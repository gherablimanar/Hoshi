import { useState } from "react";
const lessons = [
  [
    "Start with a complete example",
    "A rocket needs a sound airframe, stable aerodynamics, a suitable motor, recovery equipment and a launch setup. Open the simple model example first: its parts, motor configurations and simulations are already connected. A blank stage is only a container.",
    "Identify the nose cone, body tube, fins, recovery device and motor tube in the hierarchy.",
  ],
  [
    "Build the airframe",
    "The nose cone leads, body tubes form the airframe, and fins attach to a body tube. Give every physical part positive dimensions and realistic wall thickness. Empty stages and pods do not add a solid shape. Drag airframe parts to arrange their order.",
    "Check tube diameter, length and wall thickness. A zero-diameter tube has no useful geometry or mass.",
  ],
  [
    "Choose materials and account for mass",
    "Choose materials and density in the Inspector. Include the motor mount, centering rings, launch guides, recovery equipment and any payload or extra hardware. Use measured mass and balance overrides when you have measurements.",
    "Inspect dry mass, loaded mass and centre of gravity. Export your .ork design to keep a copy.",
  ],
  [
    "Provide stability",
    "Fins and mass distribution affect stability. CG is the loaded balance point; CP is the aerodynamic reference. The displayed margin is measured in body diameters at its stated conditions. A positive static value alone does not guarantee stable flight throughout a trajectory.",
    "Check geometry warnings and review stability over the simulated flight, not only the drawing.",
  ],
  [
    "Fit and assign a real motor",
    "Select a body or inner tube long and wide enough to hold your motor. In Flight Simulation, choose that mount, inspect a real motor curve and assign it. The engine checks physical fit. Motor assignment creates a flight configuration when needed; an empty configuration provides no thrust.",
    "Choose an appropriate motor and ejection delay. Loaded mass should include its propellant and casing.",
  ],
  [
    "Plan recovery",
    "Add a parachute or streamer and appropriate shock cord. Set deployment to the intended event, delay or descending altitude. Motor ejection timing and recovery deployment are separate settings. Verify that your motor and design support the intended recovery method.",
    "Inspect deployment events and descent speed in the flight results. Recovery equipment must also be physically suitable.",
  ],
  [
    "Connect a simulation to the motor",
    "Create a simulation after assigning a motor, or choose an existing one. Its configuration must be the configuration containing the intended motor and active stages. Flight Simulation shows a specific action when this link is missing.",
    "Confirm the selected simulation, its motor configuration and enabled stages before running.",
  ],
  [
    "Set launch conditions",
    "Open Flight settings to set launch guide length and angle, site altitude, atmosphere, wind and numerical limits. Real rockets need a suitable launch lug or rail button and compatible launch equipment. Weather and guide-exit speed influence the flight.",
    "Use realistic site conditions, inspect all warnings, and run more than one relevant condition.",
  ],
  [
    "Run and interpret the flight",
    "Run simulation in the dedicated Flight Simulation view. Results include trajectory plots, variables, events, warnings and run provenance. A failed or aborted job is not a successful flight; read its actual error. An empty results panel is not a simulation.",
    "Look for motor ignition/burnout, guide departure, apogee, recovery deployment and ground contact when applicable. Compare revisions and export CSV.",
  ],
  [
    "Simulation is one part of preparation",
    "This application calculates with OpenRocket 24.12. It does not verify construction strength, heat resistance, wiring, physical recovery packing or launch-site suitability. Follow the applicable model-rocketry safety code and equipment instructions, and have an experienced person review a first physical build.",
    "Use the example to learn the workflow, then replace assumptions with measurements for your own rocket.",
  ],
];
export function RocketTutorial({
  start,
  busy,
}: {
  start: () => void;
  busy: boolean;
}) {
  const [step, setStep] = useState(0);
  const l = lessons[step];
  return (
    <section className="rocket-tutorial">
      <nav aria-label="Rocket tutorial chapters">
        {lessons.map(([title], i) => (
          <button
            key={title}
            className={step === i ? "active" : ""}
            onClick={() => setStep(i)}
          >
            {i + 1}. {title}
          </button>
        ))}
      </nav>
      <article>
        <small>
          FIRST TIME DESIGNING A ROCKET · {step + 1} / {lessons.length}
        </small>
        <h2>{l[0]}</h2>
        <p>{l[1]}</p>
        <div className="tutorial-check">
          <strong>What to check</strong>
          <p>{l[2]}</p>
        </div>
        <footer>
          <button disabled={!step} onClick={() => setStep(step - 1)}>
            Previous chapter
          </button>
          <button
            onClick={() => setStep(Math.min(lessons.length - 1, step + 1))}
            disabled={step === lessons.length - 1}
          >
            Next chapter
          </button>
        </footer>
        <button className="primary" disabled={busy} onClick={start}>
          Open the simple example to practise
        </button>
      </article>
    </section>
  );
}

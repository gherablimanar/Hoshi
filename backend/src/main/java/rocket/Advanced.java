package rocket;

import com.fasterxml.jackson.databind.JsonNode;
import info.openrocket.core.aerodynamics.*;
import info.openrocket.core.document.*;
import info.openrocket.core.logging.*;
import info.openrocket.core.masscalc.*;
import info.openrocket.core.optimization.general.*;
import info.openrocket.core.optimization.general.multidim.MultidirectionalSearchOptimizer;
import info.openrocket.core.optimization.general.onedim.GoldenSectionSearchOptimizer;
import info.openrocket.core.optimization.rocketoptimization.*;
import info.openrocket.core.optimization.rocketoptimization.domains.*;
import info.openrocket.core.optimization.rocketoptimization.goals.*;
import info.openrocket.core.optimization.rocketoptimization.modifiers.GenericComponentModifier;
import info.openrocket.core.optimization.rocketoptimization.parameters.*;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.unit.UnitGroup;
import java.util.*;
import java.util.concurrent.*;

public final class Advanced {

  public static Map<String, Object> analysis(OpenRocketDocument d, JsonNode n)
    throws Exception {
    var r = d.getRocket();
    if (n.has("configurationId")) r.setSelectedConfiguration(
      new FlightConfigurationId(n.path("configurationId").asText())
    );
    var cfg = r.getSelectedConfiguration();
    var conditions = new FlightConditions(cfg);
    double mach = number(n, "mach", .3), aoa = number(
      n,
      "angleOfAttack",
      0
    ), theta = number(n, "rollAngle", 0);
    if (
      mach < 0 || mach > 20 || Math.abs(aoa) > Math.PI
    ) throw new IllegalArgumentException("Unsupported flight conditions");
    conditions.setMach(mach);
    conditions.setAOA(aoa);
    conditions.setTheta(theta);
    conditions.setRollRate(number(n, "rollRate", 0));
    var calc = new BarrowmanCalculator();
    WarningSet w = new WarningSet();
    var forces = calc.getForceAnalysis(cfg, conditions, w);
    List<Object> rows = new ArrayList<>();
    for (var entry : forces.entrySet()) {
      var f = entry.getValue();
      rows.add(
        Engine.nullableMap(
          "id",
          entry.getKey().getID().toString(),
          "name",
          entry.getKey().getName(),
          "cp",
          Engine.finite(f.getCP().x),
          "CN",
          Engine.finite(f.getCN()),
          "Cm",
          Engine.finite(f.getCm()),
          "CD",
          Engine.finite(f.getCD()),
          "frictionCD",
          Engine.finite(f.getFrictionCD()),
          "pressureCD",
          Engine.finite(f.getPressureCD()),
          "baseCD",
          Engine.finite(f.getBaseCD()),
          "rollForce",
          Engine.finite(f.getCrollForce()),
          "rollDamping",
          Engine.finite(f.getCrollDamp())
        )
      );
    }
    var mass = MassCalculator.calculateLaunch(cfg);
    return Engine.nullableMap(
      "kind",
      "analysis",
      "conditions",
      Map.of("mach", mach, "angleOfAttack", aoa, "rollAngle", theta),
      "components",
      rows,
      "warnings",
      Engine.strings(w),
      "loadedMass",
      mass.getMass(),
      "loadedCG",
      mass.getCM().x,
      "configurationId",
      cfg.getId().key.toString()
    );
  }

  static double number(JsonNode n, String key, double fallback) {
    double d = n.path(key).asDouble(fallback);
    if (!Double.isFinite(d)) throw new IllegalArgumentException(
      "Finite " + key + " required"
    );
    return d;
  }

  public static Map<String, Object> execute(
    Store.Project p,
    JsonNode n,
    Jobs.Job j
  ) throws Exception {
    var d = Engine.load(p.bytes()).document();
    String kind = n.path("kind").asText();
    if (kind.equals("analysis")) return analysis(d, n);
    if (kind.equals("sweep")) {
      int steps = n.path("steps").asInt(10);
      if (steps < 2 || steps > 100) throw new IllegalArgumentException(
        "Sweep requires 2–100 points"
      );
      String axis = n.path("axis").asText("mach");
      if (
        !Set.of("mach", "angleOfAttack", "rollAngle").contains(axis)
      ) throw new IllegalArgumentException("Unsupported sweep axis");
      double start = number(n, "min", 0), end = number(n, "max", 1);
      List<Object> values = new ArrayList<>();
      for (int i = 0; i < steps; i++) {
        if (j.cancel) throw new InterruptedException("Cancelled");
        var settings = n.deepCopy();
        double x = start + ((end - start) * i) / (steps - 1);
        ((com.fasterxml.jackson.databind.node.ObjectNode) settings).put(
            axis,
            x
          );
        values.add(analysis(Engine.load(p.bytes()).document(), settings));
        j.evaluations = i + 1;
      }
      return Map.of("kind", "sweep", "axis", axis, "values", values);
    }
    if (!kind.equals("optimization")) throw new IllegalArgumentException(
      "Unknown analysis task"
    );
    var sim = d.getSimulation(n.path("simulationIndex").asInt(0));
    var modifiers = new ArrayList<GenericComponentModifier>();
    List<Object> before = new ArrayList<>();
    if (
      !n.path("parameters").isArray() ||
      n.path("parameters").isEmpty() ||
      n.path("parameters").size() > 6
    ) throw new IllegalArgumentException("Select 1–6 optimization parameters");
    for (var param : n.path("parameters")) {
      var c = Engine.find(d.getRocket(), param.path("componentId").asText());
      String key = param.path("property").asText();
      var prop = Engine.properties(c, Engine.PROPERTIES)
        .stream()
        .filter(x -> x.get("key").equals(key) && x.get("type").equals("number"))
        .findFirst()
        .orElseThrow(() ->
          new IllegalArgumentException("Editable numeric property required")
        );
      if (
        !c
          .getClass()
          .getMethod(
            "get" + Character.toUpperCase(key.charAt(0)) + key.substring(1)
          )
          .getReturnType()
          .equals(double.class)
      ) throw new IllegalArgumentException(
        "Only continuous double parameters supported"
      );
      double min = number(param, "min", Double.NaN), max = number(
        param,
        "max",
        Double.NaN
      );
      if (min >= max) throw new IllegalArgumentException(
        "Parameter minimum must be less than maximum"
      );
      Engine.set(c, key, Store.JSON.valueToTree(min), Engine.PROPERTIES);
      Engine.set(c, key, Store.JSON.valueToTree(max), Engine.PROPERTIES);
      Engine.set(
        c,
        key,
        Store.JSON.valueToTree(prop.get("value")),
        Engine.PROPERTIES
      );
      var m = new GenericComponentModifier(
        key,
        "Browser selected parameter",
        c,
        UnitGroup.UNITS_NONE,
        1,
        c.getClass(),
        c.getID(),
        key
      );
      m.initialize(sim);
      m.setMinValue(min);
      m.setMaxValue(max);
      modifiers.add(m);
      before.add(
        Map.of(
          "componentId",
          c.getID().toString(),
          "property",
          key,
          "before",
          prop.get("value"),
          "unit",
          prop.get("unit")
        )
      );
    }
    OptimizableParameter objective =
      switch (n.path("objective").asText("maxAltitude")) {
        case "maxAltitude" -> new MaximumAltitudeParameter();
        case "maxSpeed" -> new MaximumVelocityParameter();
        case "maxAcceleration" -> new MaximumAccelerationParameter();
        case "flightTime" -> new TotalFlightTimeParameter();
        case "deploymentSpeed" -> new DeploymentVelocityParameter();
        case "landingDistance" -> new LandingDistanceParameter();
        case "landingSpeed" -> new GroundHitVelocityParameter();
        case "stability" -> new StabilityParameter(false);
        default -> throw new IllegalArgumentException(
          "Unknown upstream objective"
        );
      };
    var goal = n.path("goal").asText("maximize").equals("minimize")
      ? new MinimizationGoal()
      : new MaximizationGoal();
    SimulationDomain domain = n.has("minStability") || n.has("maxStability")
      ? new StabilityDomain(
        n.path("minStability").asDouble(Double.NaN),
        false,
        n.path("maxStability").asDouble(Double.NaN),
        false
      )
      : new IdentitySimulationDomain();
    var function = new RocketOptimizationFunction(
      sim,
      objective,
      goal,
      domain,
      modifiers.toArray(SimulationModifier[]::new)
    );
    List<Object> evaluations = Collections.synchronizedList(new ArrayList<>());
    function.addRocketOptimizationListener(
      (point, params, domainValue, value, goalValue) -> {
        evaluations.add(
          Engine.nullableMap(
            "scaledPoint",
            point.asArray(),
            "parameters",
            Arrays.stream(params)
              .map(v -> Engine.finite(v.getValue()))
              .toList(),
            "objective",
            value == null ? null : Engine.finite(value.getValue()),
            "goal",
            Engine.finite(goalValue),
            "domain",
            domainValue == null ? null : Engine.finite(domainValue.getValue())
          )
        );
        j.evaluations = evaluations.size();
      }
    );
    var cache = new ParallelExecutorCache(1);
    cache.setFunction(function);
    FunctionOptimizer optimizer = modifiers.size() == 1
      ? new GoldenSectionSearchOptimizer(cache)
      : new MultidirectionalSearchOptimizer(cache);
    double[] initial = modifiers
      .stream()
      .mapToDouble(m -> {
        try {
          return m.getCurrentScaledValue(sim);
        } catch (Exception e) {
          throw new IllegalArgumentException(e);
        }
      })
      .toArray();
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(120);
    int[] iterations = { 0 };
    var timer = Executors.newSingleThreadScheduledExecutor(r -> {
      var t = new Thread(r, "optimization-timeout");
      t.setDaemon(true);
      return t;
    });
    timer.schedule(cache::abortAll, 120, TimeUnit.SECONDS);
    try {
      optimizer.optimize(
        new Point(initial),
        (op, ov, np, nv, step) ->
          !j.cancel &&
          ++iterations[0] < 30 &&
          System.nanoTime() < deadline &&
          step > 0.0001
      );
      if (j.cancel) throw new InterruptedException("Cancelled");
      if (System.nanoTime() > deadline) throw new IllegalArgumentException(
        "Optimization exceeded 120 seconds"
      );
      var best = optimizer.getOptimumPoint();
      var candidate = sim.duplicateSimulation(
        sim.getRocket().copyWithOriginalID()
      );
      List<Object> changes = new ArrayList<>();
      for (int i = 0; i < modifiers.size(); i++) {
        var m = modifiers.get(i);
        m.modify(candidate, best.get(i));
        @SuppressWarnings("unchecked")
        var change = new LinkedHashMap<String, Object>(
          (Map<String, Object>) before.get(i)
        );
        change.put("after", m.getCurrentSIValue(candidate));
        changes.add(change);
      }
      return Engine.nullableMap(
        "kind",
        "optimization",
        "objective",
        n.path("objective").asText("maxAltitude"),
        "objectiveUnit",
        objective.getUnitGroup().getSIUnit().getUnit(),
        "goal",
        n.path("goal").asText("maximize"),
        "solver",
        modifiers.size() == 1
          ? "GoldenSectionSearchOptimizer"
          : "MultidirectionalSearchOptimizer",
        "inputs",
        n,
        "evaluations",
        new ArrayList<>(evaluations),
        "changes",
        changes,
        "bestGoal",
        Engine.finite(optimizer.getOptimumValue()),
        "iterations",
        iterations[0],
        "acceptanceRequired",
        true,
        "limitations",
        "Bounded to 30 iterations or 120 seconds; objective may stop before landing per upstream parameter semantics. Proposed design is not applied."
      );
    } finally {
      cache.abortAll();
      timer.shutdownNow();
    }
  }
}

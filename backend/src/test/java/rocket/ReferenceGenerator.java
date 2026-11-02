package rocket;

import info.openrocket.core.aerodynamics.*;
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.masscalc.MassCalculator;
import java.nio.file.*;
import java.util.*;

/** Explicit reference generation through direct upstream loader/model/Simulation, not HTTP/Engine.load/save. */
public final class ReferenceGenerator {

  static Map<String, Object> reference(String fixture, int index)
    throws Exception {
    var d = new GeneralRocketLoader(
      Path.of("../tests/fixtures/" + fixture + ".ork").toFile()
    ).load();
    var sim = d.getSimulation(index);
    configure(sim);
    var cfg = sim.getActiveConfiguration();
    var dry = MassCalculator.calculateStructure(cfg);
    var loaded = MassCalculator.calculateLaunch(cfg);
    var fc = new FlightConditions(cfg);
    fc.setMach(.3);
    var w = new WarningSet();
    var cp = new BarrowmanCalculator().getCP(cfg, fc, w);
    sim.simulate();
    var data = sim.getSimulatedData();
    List<Object> branches = new ArrayList<>();
    for (var b : data.getBranches()) {
      branches.add(
        Map.of(
          "name",
          b.getName(),
          "variables",
          Arrays.stream(b.getTypes())
            .map(t ->
              Map.of(
                "key",
                t.getSymbol(),
                "unit",
                t.getUnitGroup().getSIUnit().getUnit(),
                "values",
                b
                  .get(t)
                  .stream()
                  .map(v -> v == null ? null : Engine.finite(v))
                  .toList()
              )
            )
            .toList(),
          "events",
          b
            .getEvents()
            .stream()
            .map(e -> Map.of("type", e.getType().name(), "time", e.getTime()))
            .toList()
        )
      );
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("fixture", fixture);
    result.put("simulationIndex", index);
    result.put("dryMass", dry.getMass());
    result.put("loadedMass", loaded.getMass());
    result.put("dryCG", dry.getCM().x);
    result.put("loadedCG", loaded.getCM().x);
    result.put("cp", Engine.finite(cp.x));
    result.put(
      "summary",
      Map.of(
        "maxAltitude",
        data.getMaxAltitude(),
        "maxSpeed",
        data.getMaxVelocity(),
        "maxAcceleration",
        data.getMaxAcceleration(),
        "flightTime",
        data.getFlightTime()
      )
    );
    result.put("branches", branches);
    result.put("warnings", Engine.strings(data.getWarningSet()));
    return result;
  }

  static void configure(Simulation sim) {
    sim.getOptions().setRandomSeed(24012);
    sim.getOptions().getAverageWindModel().setAverage(0);
    sim.getOptions().getAverageWindModel().setStandardDeviation(0);
  }

  public static void main(String[] args) throws Exception {
    Engine.initialize();
    List<Object> cases = new ArrayList<>();
    for (String f : List.of(
      "simple",
      "multistage",
      "cluster",
      "dual-recovery"
    )) {
      int count = f.equals("simple") ? 3 : 1;
      for (int i = 0; i < count; i++) cases.add(reference(f, i));
    }
    Store.JSON.writerWithDefaultPrettyPrinter()
      .writeValue(
        Path.of("../tests/reference.json").toFile(),
        Map.of(
          "engineCommit",
          Engine.REVISION,
          "componentDatabaseCommit",
          "1512874ace50917e25ccf7d7df1f616b5f39a8b5",
          "conditions",
          "upstream fixture settings; average wind=0; deviation=0; seed=24012",
          "cases",
          cases
        )
      );
  }
}

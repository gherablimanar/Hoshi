package rocket;

import static org.junit.jupiter.api.Assertions.*;

import info.openrocket.core.simulation.FlightEvent;
import info.openrocket.core.util.GeodeticComputationStrategy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Additional-condition diagnostics, not experimental validation or an accuracy threshold. */
class PhysicsVerificationTest {

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @Test
  void recordedConditionsSurviveNativeRoundTripAndStepRefinement()
    throws Exception {
    List<Object> studies = new ArrayList<>();
    for (String fixture : List.of("simple", "multistage", "dual-recovery")) {
      List<Map<String, Object>> runs = new ArrayList<>();
      for (double step : new double[] { .05, .025, .0125 }) {
        var document = EngineTest.fixture(fixture);
        var options = document.getSimulation(0).getOptions();
        ReferenceGenerator.configure(document.getSimulation(0));
        options.setLaunchLatitude(35.5);
        options.setLaunchLongitude(-106.5);
        options.setLaunchAltitude(1500);
        options.setISAAtmosphere(false);
        options.setLaunchTemperature(295);
        options.setLaunchPressure(84000);
        options.setGeodeticComputation(GeodeticComputationStrategy.WGS84);
        options.setTimeStep(step);
        options.setMaximumStepAngle(Math.toRadians(2));
        options.getAverageWindModel().setAverage(3);
        options.getAverageWindModel().setDirection(Math.PI / 2);
        // Zero deviation isolates time-step sensitivity from stochastic wind.
        options.getAverageWindModel().setStandardDeviation(0);
        var restored = Engine.load(Engine.save(document))
          .document()
          .getSimulation(0);
        var saved = restored.getOptions();
        assertEquals(35.5, saved.getLaunchLatitude(), 1e-10);
        assertEquals(-106.5, saved.getLaunchLongitude(), 1e-10);
        assertEquals(1500, saved.getLaunchAltitude(), 1e-10);
        assertFalse(saved.isISAAtmosphere());
        assertEquals(295, saved.getLaunchTemperature(), 1e-10);
        assertEquals(84000, saved.getLaunchPressure(), 1e-10);
        assertEquals(
          GeodeticComputationStrategy.WGS84,
          saved.getGeodeticComputation()
        );
        assertEquals(step, saved.getTimeStep(), 1e-12);
        // Pinned native saver omits this option. Expose it as read-only in the UI.
        assertEquals(Math.toRadians(3), saved.getMaximumStepAngle(), 1e-12);
        assertEquals(3, saved.getAverageWindModel().getAverage(), 1e-10);
        assertEquals(
          0,
          saved.getAverageWindModel().getStandardDeviation(),
          1e-10
        );
        restored.simulate();
        var data = restored.getSimulatedData();
        assertTrue(Double.isFinite(data.getMaxAltitude()));
        assertTrue(data.getMaxAltitude() > 0);
        assertTrue(Double.isFinite(data.getMaxVelocity()));
        assertTrue(Double.isFinite(data.getMaxAcceleration()));
        assertTrue(
          data
            .getBranch(0)
            .getEvents()
            .stream()
            .anyMatch(e -> e.getType() == FlightEvent.Type.APOGEE)
        );
        assertFalse(
          data
            .getBranch(0)
            .getEvents()
            .stream()
            .anyMatch(e -> e.getType() == FlightEvent.Type.SIM_ABORT)
        );
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("timeStepSeconds", step);
        row.put("maxAltitudeMetres", data.getMaxAltitude());
        row.put("maxSpeedMetresPerSecond", data.getMaxVelocity());
        row.put(
          "maxAccelerationMetresPerSecondSquared",
          data.getMaxAcceleration()
        );
        row.put("flightTimeSeconds", data.getFlightTime());
        if (!runs.isEmpty()) {
          var previous = runs.get(runs.size() - 1);
          Map<String, Double> differences = new LinkedHashMap<>();
          for (String metric : List.of(
            "maxAltitudeMetres",
            "maxSpeedMetresPerSecond",
            "maxAccelerationMetresPerSecondSquared",
            "flightTimeSeconds"
          )) {
            differences.put(
              metric,
              ((Number) row.get(metric)).doubleValue() -
              ((Number) previous.get(metric)).doubleValue()
            );
          }
          row.put("differenceFromPreviousStep", differences);
        }
        runs.add(row);
      }
      studies.add(Map.of("fixture", fixture, "runs", runs));
    }
    Files.writeString(
      Path.of("../tests/physics-step-study.json"),
      Store.JSON.writerWithDefaultPrettyPrinter()
        .writeValueAsString(
          Map.of(
            "purpose",
            "Numerical sensitivity diagnostic only; no acceptance threshold or physical-validation claim",
            "conditions",
            "WGS84; latitude 35.5 deg; longitude -106.5 deg; altitude 1500 m ASL; 295 K; 84000 Pa; steady 3 m/s wind, direction pi/2 rad, zero deviation; maximum angular step native reload default 3 deg; seed 24012; otherwise native fixture settings",
            "studies",
            studies
          )
        )
    );
  }
}

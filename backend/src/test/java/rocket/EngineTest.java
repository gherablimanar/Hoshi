package rocket;

import static org.junit.jupiter.api.Assertions.*;

import info.openrocket.core.document.*;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.simulation.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class EngineTest {

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @TempDir
  Path temp;

  @Test
  void genuineFixtureInitializesAndSimulates() throws Exception {
    var d = fixture("simple");
    var s = d.getSimulation(0);
    ReferenceGenerator.configure(s);
    s.simulate();
    assertTrue(s.getSimulatedData().getMaxAltitude() > 10);
    assertTrue(
      s
        .getSimulatedData()
        .getBranch(0)
        .getEvents()
        .stream()
        .anyMatch(e -> e.getType() == FlightEvent.Type.APOGEE)
    );
  }

  static OpenRocketDocument fixture(String name) throws Exception {
    return Engine.load(
      Files.readAllBytes(Path.of("../tests/fixtures/" + name + ".ork"))
    ).document();
  }

  @Test
  void roundTripPreservesIdsMotorsRecoveryAndSettings() throws Exception {
    var d = fixture("simple");
    d.getSimulation(0).getOptions().setRandomSeed(24012);
    var before = Engine.inspect(d);
    byte[] saved = Engine.save(d);
    var copy = Engine.load(saved).document();
    assertEquals(24012, copy.getSimulation(0).getOptions().getRandomSeed());
    var after = Engine.inspect(copy);
    assertEquals(before.get("rocket"), after.get("rocket"));
    assertEquals(before.get("quantities"), after.get("quantities"));
    assertEquals(
      d.getRocket().getFlightConfigurationCount(),
      copy.getRocket().getFlightConfigurationCount()
    );
    assertEquals(d.getSimulationCount(), copy.getSimulationCount());
    assertEquals(
      d.getSimulation(0).getOptions().getTimeStep(),
      copy.getSimulation(0).getOptions().getTimeStep()
    );
  }

  @Test
  void mutationsRevisionGuardAndDurableRestore() throws Exception {
    Store store = new Store(temp);
    var d = fixture("simple");
    var p = store.create(d, List.of());
    var tube = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof BodyTube)
      .findFirst()
      .orElseThrow();
    String id = tube.getID().toString();
    double length = tube.getLength();
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"set\",\"componentId\":\"" +
        id +
        "\",\"changes\":{\"length\":0.31}}"
      )
    );
    var next = store.append(
      p.id(),
      p.revision(),
      Engine.save(d),
      List.of(),
      true
    );
    assertEquals(2, next.revision());
    assertEquals(
      .31,
      Engine.find(
        Engine.load(store.read(p.id()).bytes()).document().getRocket(),
        id
      ).getLength()
    );
    assertThrows(Store.Stale.class, () ->
      store.append(p.id(), 1, Engine.save(d), List.of(), true)
    );
    var restored = store.append(p.id(), 2, p.bytes(), List.of(), true);
    assertEquals(
      length,
      Engine.find(
        Engine.load(restored.bytes()).document().getRocket(),
        id
      ).getLength()
    );
    assertEquals(3, new Store(temp).read(p.id()).revision());
  }

  @Test
  void invalidDimensionsAndIncompatibleParentsRejectWithoutPersistence()
    throws Exception {
    var d = fixture("simple");
    var tube = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof BodyTube)
      .findFirst()
      .orElseThrow();
    assertThrows(IllegalArgumentException.class, () ->
      Engine.set(tube, "length", Store.JSON.readTree("-0.1"), Engine.PROPERTIES)
    );
    assertThrows(IllegalArgumentException.class, () ->
      Engine.set(
        tube,
        "length",
        Store.JSON.readTree("\"NaN\""),
        Engine.PROPERTIES
      )
    );
    assertThrows(IllegalArgumentException.class, () ->
      Server.mutate(
        d,
        Store.JSON.readTree(
          "{\"op\":\"add\",\"parentId\":\"" +
          d.getRocket().getID() +
          "\",\"type\":\"TrapezoidFinSet\"}"
        )
      )
    );
  }

  @Test
  void hostileAndMalformedImportsReject() throws Exception {
    assertThrows(Exception.class, () ->
      Engine.load(
        "<!DOCTYPE x [<!ENTITY e SYSTEM 'file:///etc/passwd'>]><openrocket>&e;</openrocket>".getBytes()
      )
    );
    assertThrows(Exception.class, () -> Engine.load("<notrocket/>".getBytes()));
    assertThrows(Exception.class, () ->
      Engine.load(
        "<openrocket><simulations><extension>code</extension></simulations></openrocket>".getBytes()
      )
    );
    assertThrows(Exception.class, () ->
      Engine.load(new byte[8 * 1024 * 1024 + 1])
    );
  }

  @Test
  void buildRealDesignFromEmpty() throws Exception {
    var d = OpenRocketDocumentFactory.createEmptyRocket();
    Rocket r = d.getRocket();
    AxialStage stage = new AxialStage();
    r.addChild(stage);
    NoseCone nose = new NoseCone();
    nose.setLength(.1);
    nose.setBaseRadius(.0125);
    stage.addChild(nose);
    BodyTube body = new BodyTube();
    body.setLength(.3);
    body.setOuterRadius(.0125);
    stage.addChild(body);
    TrapezoidFinSet fins = new TrapezoidFinSet();
    fins.setFinCount(3);
    fins.setHeight(.04);
    fins.setRootChord(.06);
    body.addChild(fins);
    InnerTube mount = new InnerTube();
    mount.setLength(.075);
    mount.setOuterRadius(.0095);
    mount.setThickness(.0005);
    body.addChild(mount);
    Parachute chute = new Parachute();
    body.addChild(chute);
    var motor = Engine.motors()
      .stream()
      .filter(
        m ->
          m.getDesignation().equals("A8") &&
          m.getManufacturer().getDisplayName().equals("Estes")
      )
      .findFirst()
      .orElseThrow();
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"motor\",\"componentId\":\"" +
        mount.getID() +
        "\",\"motorId\":\"" +
        motor.getDigest() +
        "\",\"delay\":3}"
      )
    );
    Server.mutate(d, Store.JSON.readTree("{\"op\":\"simulation\"}"));
    var sim = d.getSimulation(0);
    ReferenceGenerator.configure(sim);
    sim.simulate();
    assertTrue(sim.getSimulatedData().getMaxAltitude() > 0);
    assertTrue(
      sim
        .getSimulatedData()
        .getBranch(0)
        .getEvents()
        .stream()
        .anyMatch(e -> e.getType() == FlightEvent.Type.BURNOUT)
    );
  }

  @Test
  void numericalReferenceRoundTripComparison() throws Exception {
    var reference = Store.JSON.readTree(
      Files.readAllBytes(Path.of("../tests/reference.json"))
    );
    assertEquals(Engine.REVISION, reference.path("engineCommit").asText());
    List<Object> report = new ArrayList<>();
    for (var ref : reference.path("cases")) {
      String fixture = ref.path("fixture").asText();
      int index = ref.path("simulationIndex").asInt();
      var d = fixture(fixture);
      ReferenceGenerator.configure(d.getSimulation(index));
      d = Engine.load(Engine.save(d)).document();
      var sim = d.getSimulation(index);
      ReferenceGenerator.configure(sim);
      var inspection = Engine.inspect(
        Engine.load(Engine.save(d)).document(),
        sim.getFlightConfigurationId()
      );
      for (String q : List.of(
        "dryMass",
        "loadedMass",
        "dryCG",
        "loadedCG",
        "cp"
      )) {
        var v = Store.JSON.valueToTree(inspection.get("quantities")).path(q);
        if (ref.path(q).isNumber()) near(
          ref.path(q).asDouble(),
          v.asDouble(),
          1e-9,
          1e-8,
          fixture + " " + q,
          report
        );
      }
      sim.simulate();
      var actual = Store.JSON.valueToTree(Jobs.data(sim.getSimulatedData()));
      for (String k : List.of(
        "maxAltitude",
        "maxSpeed",
        "maxAcceleration",
        "flightTime"
      )) near(
        ref.path("summary").path(k).asDouble(),
        actual.path("summary").path(k).asDouble(),
        1e-5,
        1e-6,
        fixture + " " + index + " " + k,
        report
      );
      assertEquals(ref.path("warnings"), actual.path("warnings"));
      assertEquals(ref.path("branches").size(), actual.path("branches").size());
      for (int b = 0; b < ref.path("branches").size(); b++) {
        var expectedVariables = ref.path("branches").get(b).path("variables");
        var variables = actual.path("branches").get(b).path("variables");
        assertEquals(
          expectedVariables.size(),
          variables.size(),
          fixture + " variable inventory"
        );
        for (var vector : expectedVariables) {
          var key = vector.path("key").asText();
          com.fasterxml.jackson.databind.JsonNode series = null;
          for (var v : variables) if (
            v.path("key").asText().equals(key)
          ) series = v;
          assertNotNull(series, fixture + " missing " + key);
          assertEquals(vector.path("unit"), series.path("unit"));
          assertEquals(
            vector.path("values").size(),
            series.path("values").size()
          );
          if (key.equals("tc")) {
            double previous = -1;
            for (var sample : series.path("values")) {
              if (sample.isNull()) continue;
              assertTrue(sample.isNumber() && sample.asDouble() >= 0);
              assertTrue(sample.asDouble() >= previous);
              previous = sample.asDouble();
            }
            report.add(
              Map.of(
                "quantity",
                fixture + " " + index + " branch " + b + " tc",
                "status",
                "structural telemetry check only",
                "reason",
                "Upstream SimulationStatus writes wall-clock elapsed computation time, not a deterministic flight quantity",
                "sampleCount",
                series.path("values").size()
              )
            );
            continue;
          }
          double maxAbs = 0, maxRel = 0;
          for (int i = 0; i < vector.path("values").size(); i++) {
            var ev = vector.path("values").get(i);
            var av = series.path("values").get(i);
            if (ev.isNull()) {
              assertTrue(
                av.isNull(),
                fixture + " nonfinite mask " + key + " sample " + i
              );
              continue;
            }
            assertTrue(av.isNumber());
            double expected = ev.asDouble(), value = av.asDouble(), delta =
              Math.abs(expected - value);
            maxAbs = Math.max(maxAbs, delta);
            maxRel = Math.max(
              maxRel,
              delta / Math.max(Math.abs(expected), 1e-30)
            );
            assertTrue(
              delta <= 1e-5 + 1e-6 * Math.abs(expected),
              fixture +
              " " +
              index +
              " " +
              key +
              " sample " +
              i +
              " difference " +
              delta
            );
          }
          report.add(
            Map.of(
              "quantity",
              fixture + " " + index + " branch " + b + " series " + key,
              "unit",
              vector.path("unit").asText(),
              "sampleCount",
              vector.path("values").size(),
              "absoluteDifference",
              maxAbs,
              "relativeDifference",
              maxRel,
              "absoluteTolerance",
              1e-5,
              "relativeTolerance",
              1e-6
            )
          );
        }
        var expectedEvents = ref.path("branches").get(b).path("events");
        var events = actual.path("branches").get(b).path("events");
        assertEquals(
          expectedEvents.size(),
          events.size(),
          fixture + " event count"
        );
        for (int e = 0; e < events.size(); e++) {
          assertEquals(
            expectedEvents.get(e).path("type"),
            events.get(e).path("type")
          );
          near(
            expectedEvents.get(e).path("time").asDouble(),
            events.get(e).path("time").asDouble(),
            1e-5,
            1e-6,
            fixture + " " + events.get(e).path("type"),
            report
          );
        }
      }
    }
    Store.JSON.writerWithDefaultPrettyPrinter()
      .writeValue(Path.of("../tests/comparison-results.json").toFile(), report);
  }

  static void near(
    double expected,
    double actual,
    double abs,
    double rel,
    String label,
    List<Object> report
  ) {
    double delta = Math.abs(expected - actual), relative =
      delta / Math.max(Math.abs(expected), 1e-30);
    report.add(
      Map.of(
        "quantity",
        label,
        "expected",
        expected,
        "actual",
        actual,
        "absoluteDifference",
        delta,
        "relativeDifference",
        relative,
        "absoluteTolerance",
        abs,
        "relativeTolerance",
        rel
      )
    );
    assertTrue(
      delta <= abs + rel * Math.abs(expected),
      label + " expected=" + expected + " actual=" + actual
    );
  }
}

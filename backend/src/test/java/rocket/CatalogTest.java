package rocket;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class CatalogTest {

  @TempDir
  Path temp;

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @Test
  void archivesRetainEveryEmbeddedAsset() throws Exception {
    byte[] original = Files.readAllBytes(
      Path.of("../tests/fixtures/simple.ork")
    );
    var d = Engine.load(original).document();
    byte[] saved = Engine.save(d);
    Map<String, byte[]> a = new HashMap<>(), b = new HashMap<>();
    Engine.unpack(original, a);
    Engine.unpack(saved, b);
    assertEquals(a.keySet(), b.keySet());
    a.forEach((k, v) -> assertArrayEquals(v, b.get(k)));
  }

  @Test
  void realMotorImportUsesPinnedParserAndSurvivesReload() throws Exception {
    var s = new Store(temp);
    byte[] bytes = Files.readAllBytes(Path.of("../tests/fixtures/WECO_A8.eng"));
    var records = MotorImports.save(s, bytes, "WECO_A8.eng");
    assertFalse(records.isEmpty());
    assertTrue((double) records.get(0).get("impulse") > 0);
    assertTrue(
      records.get(0).get("source").toString().contains(Store.hash(bytes))
    );
    MotorImports.load(s);
    assertTrue(
      Engine.motors()
        .stream()
        .anyMatch(m -> m.getDigest().equals(records.get(0).get("id")))
    );
  }

  @Test
  void expressionsUseActualMathParserAndProduceFlightVariables()
    throws Exception {
    var d = EngineTest.fixture("simple");
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"expression\",\"name\":\"Kinetic energy browser fixture\",\"symbol\":\"Ek\",\"unit\":\"J\",\"expression\":\"0.5*m*Vt^2\"}"
      )
    );
    d = Engine.load(Engine.save(d)).document();
    assertEquals(1, d.getCustomExpressions().size());
    var sim = d.getSimulation(0);
    ReferenceGenerator.configure(sim);
    sim.simulate(
      new info.openrocket.core.simulation.customexpression.CustomExpressionSimulationListener(
        d.getCustomExpressions()
      )
    );
    assertTrue(
      Arrays.stream(sim.getSimulatedData().getBranch(0).getTypes()).anyMatch(
        t -> t.getSymbol().equals("Ek")
      )
    );
  }

  @Test
  void recoveryMaterialsClusterAndMultiLevelWindRoundTrip() throws Exception {
    var d = EngineTest.fixture("simple");
    var parachute = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof info.openrocket.core.rocketcomponent.Parachute)
      .findFirst()
      .orElseThrow();
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"material\",\"componentId\":\"" +
        parachute.getID() +
        "\",\"name\":\"Test surface material\",\"density\":0.05}"
      )
    );
    var tube = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof info.openrocket.core.rocketcomponent.InnerTube)
      .findFirst()
      .orElseThrow();
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"cluster\",\"componentId\":\"" +
        tube.getID() +
        "\",\"pattern\":\"double\"}"
      )
    );
    Server.mutate(
      d,
      Store.JSON.readTree(
        "{\"op\":\"settings\",\"simulationIndex\":0,\"changes\":{\"windModelType\":\"MULTI_LEVEL\"},\"windLevels\":[{\"altitude\":0,\"speed\":2,\"direction\":0.4,\"standardDeviation\":0.2},{\"altitude\":100,\"speed\":5,\"direction\":0.5,\"standardDeviation\":0.3}]}"
      )
    );
    var copy = Engine.load(Engine.save(d)).document();
    assertEquals(
      .05,
      ((info.openrocket.core.rocketcomponent.Parachute) Engine.find(
          copy.getRocket(),
          parachute.getID().toString()
        )).getMaterial()
        .getDensity()
    );
    assertEquals(
      2,
      ((info.openrocket.core.rocketcomponent.InnerTube) Engine.find(
          copy.getRocket(),
          tube.getID().toString()
        )).getClusterConfiguration()
        .getClusterCount()
    );
    assertEquals(
      2,
      copy
        .getSimulation(0)
        .getOptions()
        .getMultiLevelWindModel()
        .getLevels()
        .size()
    );
    assertEquals(
      5,
      copy
        .getSimulation(0)
        .getOptions()
        .getMultiLevelWindModel()
        .getLevels()
        .get(1)
        .getSpeed()
    );
  }

  @Test
  void actualInterchangeReadersConvertWithExplicitWarnings() throws Exception {
    var d = EngineTest.fixture("simple");
    for (String format : List.of("rocksim", "rasaero")) {
      var export = Exports.interchange(d, format);
      var loaded = Engine.load(export.bytes());
      assertTrue(loaded.document().getRocket().getChildCount() > 0);
      assertFalse(loaded.warnings().isEmpty());
    }
  }
}

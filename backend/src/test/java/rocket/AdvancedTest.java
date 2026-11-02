package rocket;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class AdvancedTest {

  @TempDir
  Path temp;

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @Test
  void analysisMatchesDirectCoreAndSweepIsBounded() throws Exception {
    var d = EngineTest.fixture("simple");
    var n = Store.JSON.readTree("{\"mach\":0.3}");
    var a = Advanced.analysis(d, n);
    assertFalse(((List<?>) a.get("components")).isEmpty());
    var s = new Store(temp);
    var p = s.create(d, List.of());
    var j = new Jobs.Job(p);
    var result = Advanced.execute(
      p,
      Store.JSON.readTree(
        "{\"kind\":\"sweep\",\"steps\":3,\"axis\":\"mach\",\"min\":0.1,\"max\":0.8}"
      ),
      j
    );
    assertEquals(3, ((List<?>) result.get("values")).size());
    j.cancel = true;
    assertThrows(InterruptedException.class, () ->
      Advanced.execute(
        p,
        Store.JSON.readTree("{\"kind\":\"sweep\",\"steps\":3}"),
        j
      )
    );
  }

  @Test
  void upstreamOptimizationProposesWithoutMutatingProject() throws Exception {
    var d = EngineTest.fixture("simple");
    ReferenceGenerator.configure(d.getSimulation(0));
    var tube = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof info.openrocket.core.rocketcomponent.BodyTube)
      .findFirst()
      .orElseThrow();
    var s = new Store(temp);
    var p = s.create(d, List.of());
    var request = Store.JSON.readTree(
      "{\"kind\":\"optimization\",\"objective\":\"maxAltitude\",\"parameters\":[{\"componentId\":\"" +
      tube.getID() +
      "\",\"property\":\"length\",\"min\":0.2,\"max\":0.4}]}"
    );
    var result = Advanced.execute(p, request, new Jobs.Job(p));
    assertFalse(((List<?>) result.get("evaluations")).isEmpty());
    assertEquals(1, ((List<?>) result.get("changes")).size());
    assertArrayEquals(p.bytes(), s.read(p.id()).bytes());
    assertEquals(true, result.get("acceptanceRequired"));
  }

  @Test
  void realMeshAndFinExportAndInterchange() throws Exception {
    var d = EngineTest.fixture("simple");
    var mesh = Exports.mesh(d);
    assertTrue(((List<?>) mesh.get("vertices")).size() > 50);
    assertTrue(((List<?>) mesh.get("faces")).size() > 50);
    var f = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(c -> c instanceof info.openrocket.core.rocketcomponent.FinSet)
      .findFirst()
      .orElseThrow();
    assertTrue(
      new String(Exports.finSvg(d, f.getID().toString())).contains("<svg")
    );
    assertTrue(Exports.interchange(d, "rocksim").bytes().length > 100);
    assertTrue(Exports.interchange(d, "rasaero").bytes().length > 100);
  }

  @Test
  void cancellationAndQueueIsolationPersistTerminalRecords() throws Exception {
    var s = new Store(temp);
    var d = EngineTest.fixture("simple");
    ReferenceGenerator.configure(d.getSimulation(0));
    var p = s.create(d, List.of());
    Jobs jobs = new Jobs(s);
    Jobs.Job first, second;
    synchronized (Engine.LOCK) {
      first = jobs.start(p, 0);
      second = jobs.start(p, 0);
      jobs.cancel(second.id);
    }
    assertEquals("cancelled", second.view().get("state"));
    assertEquals("cancelled", s.run(second.id).path("status").asText());
    long deadline =
      System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(20);
    while (
      Set.of("pending", "running").contains(first.view().get("state")) &&
      System.nanoTime() < deadline
    ) Thread.sleep(10);
    assertEquals("completed", first.view().get("state"));
    assertEquals(p.revision(), s.run(first.id).path("revision").asLong());
    assertArrayEquals(p.bytes(), s.read(p.id()).bytes());
    jobs.worker.shutdownNow();
  }
}

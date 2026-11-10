package rocket;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class VisitorAccessTest {

  @TempDir
  Path data;

  @BeforeAll
  static void initialize() {
    Engine.initialize();
  }

  @Test
  void publicModeRequiresAnOwnerPasswordAndDoesNotAcceptArbitraryBearerTokens() {
    assertThrows(IllegalArgumentException.class, () ->
      new RequestAccess(Map.of("PUBLIC_VISITORS", "true"))
    );
    var access = new RequestAccess(
      Map.of(
        "APP_ACCESS_PASSWORD",
        "owner-password-for-test",
        "PUBLIC_VISITORS",
        "true"
      )
    );
    assertFalse(access.authorized("Bearer " + "a".repeat(64)));
    assertFalse(access.visitor.test("Bearer " + "a".repeat(64)));
  }

  @Test
  void anonymousWorkspacesCannotReadOrChangeOwnerOrOtherVisitorData()
    throws Exception {
    var app = new Server(
      data,
      Path.of("../frontend/dist"),
      Map.of(
        "APP_ACCESS_PASSWORD",
        "owner-password-for-test",
        "REQUIRE_AUTH",
        "true",
        "PUBLIC_VISITORS",
        "true"
      )
    );
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", app::handle);
    server.start();
    String base = "http://127.0.0.1:" + server.getAddress().getPort();
    var client = HttpClient.newHttpClient();
    class Requests {

      HttpResponse<String> send(String auth, String path, String body)
        throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(base + "/api" + path));
        if (auth != null) builder.header("Authorization", auth);
        if (body != null) builder
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(
          builder.build(),
          HttpResponse.BodyHandlers.ofString()
        );
      }

      String session() throws Exception {
        var response = send(null, "/visitor-session", "{}");
        assertEquals(201, response.statusCode());
        return (
          "Bearer " +
          Store.JSON.readTree(response.body()).path("token").asText()
        );
      }
    }
    var req = new Requests();
    String owner =
      "Basic " +
      Base64.getEncoder()
        .encodeToString(
          "rocket:owner-password-for-test".getBytes(
              java.nio.charset.StandardCharsets.UTF_8
            )
        );
    try {
      assertTrue(
        Store.JSON.readTree(req.send(null, "/health", null).body())
          .path("publicVisitorsEnabled")
          .asBoolean()
      );
      assertEquals(401, req.send(null, "/projects", null).statusCode());
      assertEquals(
        401,
        req.send("Bearer " + "f".repeat(64), "/projects", null).statusCode()
      );
      var privateProject = req.send(
        owner,
        "/projects",
        "{\"name\":\"Owner private rocket\"}"
      );
      assertEquals(201, privateProject.statusCode());
      String ownerId = Store.JSON.readTree(privateProject.body())
        .path("id")
        .asText();
      String a = req.session(), b = req.session();
      assertNotEquals(a, b);
      var created = req.send(
        a,
        "/projects",
        "{\"example\":\"A simple model rocket.ork\"}"
      );
      assertEquals(201, created.statusCode());
      var project = Store.JSON.readTree(created.body());
      String id = project.path("id").asText();
      assertEquals(
        0,
        Store.JSON.readTree(req.send(b, "/projects", null).body()).size()
      );
      assertEquals(
        1,
        Store.JSON.readTree(req.send(owner, "/projects", null).body()).size()
      );
      for (String other : List.of(ownerId)) {
        assertEquals(404, req.send(a, "/projects/" + other, null).statusCode());
        assertEquals(
          404,
          req.send(a, "/projects/" + other + "/export", null).statusCode()
        );
        assertEquals(
          404,
          req
            .send(
              a,
              "/projects/" + other + "/mutate",
              "{\"revision\":1,\"op\":\"set\",\"componentId\":\"" +
              ownerId +
              "\",\"changes\":{\"name\":\"changed\"}}"
            )
            .statusCode()
        );
      }
      assertEquals(404, req.send(b, "/projects/" + id, null).statusCode());
      assertEquals(
        404,
        req.send(b, "/projects/" + id + "/export", null).statusCode()
      );
      assertEquals(403, req.send(a, "/motors/import", "{}").statusCode());
      // An owner-imported curve cannot leak through the native document loader.
      String motorText = Files.readString(
        Path.of("../tests/fixtures/WECO_A8.eng")
      )
        .replace(
          "A8 18 70 3 0.00312 0.0153 SF",
          "PrivateA8 18 70 3 0.00312 0.0153 PRIVATE"
        )
        .replace("0.065 0.44", "0.065 0.441234567");
      var imported = MotorImports.save(
        app.store,
        motorText.getBytes(java.nio.charset.StandardCharsets.UTF_8),
        "owner-private-motor.eng"
      );
      String motorId = imported.get(0).get("id").toString();
      var privateMotor = Engine.motors()
        .stream()
        .filter(m -> m.getDigest().equals(motorId))
        .findFirst()
        .orElseThrow();
      var privateDoc = EngineTest.fixture("simple");
      privateDoc
        .getRocket()
        .getSelectedConfiguration()
        .getAllMotors()
        .iterator()
        .next()
        .setMotor(privateMotor);
      var blockedImport = client.send(
        HttpRequest.newBuilder(URI.create(base + "/api/import"))
          .header("Authorization", a)
          .POST(HttpRequest.BodyPublishers.ofByteArray(Engine.save(privateDoc)))
          .build(),
        HttpResponse.BodyHandlers.ofString()
      );
      assertEquals(422, blockedImport.statusCode());
      assertFalse(blockedImport.body().contains("owner-private-motor"));
      assertEquals(404, req.send(a, "/motors/" + motorId, null).statusCode());
      var workspace = app.visitors.resolve(a);
      assertSame(app.jobs.worker, workspace.jobs.worker);
      assertFalse(workspace.assistant.configured());
      workspace.requests = 240;
      assertEquals(429, req.send(a, "/projects", null).statusCode());
      assertEquals(200, req.send(owner, "/projects", null).statusCode());
      workspace.requests = 0;
      int index = 0;
      for (int i = 0; i < project.path("simulations").size(); i++) if (
        project
          .path("simulations")
          .get(i)
          .path("configurationId")
          .asText()
          .equals(project.path("selectedConfigurationId").asText())
      ) {
        index = i;
        break;
      }
      var start = req.send(
        a,
        "/projects/" + id + "/jobs",
        "{\"revision\":" +
        project.path("revision").asLong() +
        ",\"simulationIndex\":" +
        index +
        "}"
      );
      assertEquals(202, start.statusCode());
      String jobId = Store.JSON.readTree(start.body()).path("id").asText();
      long until =
        System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(45);
      String state = "pending";
      while (
        Set.of("pending", "running").contains(state) &&
        System.nanoTime() < until
      ) {
        Thread.sleep(25);
        state = Store.JSON.readTree(req.send(a, "/jobs/" + jobId, null).body())
          .path("state")
          .asText();
      }
      assertEquals("completed", state);
      var run = req.send(a, "/runs/" + jobId, null);
      assertEquals(200, run.statusCode());
      assertTrue(
        Store.JSON.readTree(run.body())
          .path("summary")
          .path("maxAltitude")
          .asDouble() >
        10
      );
      assertEquals(404, req.send(b, "/runs/" + jobId, null).statusCode());
      assertEquals(404, req.send(owner, "/runs/" + jobId, null).statusCode());
      assertEquals(
        200,
        req.send(a, "/runs/" + jobId + "/csv", null).statusCode()
      );
      assertEquals(
        200,
        req.send(a, "/projects/" + id + "/export", null).statusCode()
      );
      // Reopening the registry keeps the browser capability scoped to its original store.
      var reopened = new VisitorWorkspaces(data, app.jobs);
      assertTrue(reopened.valid(a));
      assertEquals(1, reopened.resolve(a).store.list().size());
      Files.write(
        app.visitors.directory(a).resolve("session.json"),
        Store.JSON.writeValueAsBytes(Map.of("expires", 0))
      );
      assertEquals(401, req.send(a, "/projects", null).statusCode());
      assertEquals(
        "Owner private rocket",
        Store.JSON.readTree(
          req.send(owner, "/projects/" + ownerId, null).body()
        )
          .path("name")
          .asText()
      );
    } finally {
      server.stop(0);
      app.jobs.worker.shutdownNow();
    }
  }
}

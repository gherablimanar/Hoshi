package rocket;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;

class AssistantTest {

  @TempDir
  Path temp;

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @Test
  void missingProviderDoesNotMutateOrFakeAnAnswer() throws Exception {
    Store s = new Store(temp);
    var p = s.create(EngineTest.fixture("simple"), List.of());
    Assistant a = new Assistant(
      s,
      null,
      null,
      "https://api.openai.com/v1/chat/completions"
    );
    assertFalse(a.configured());
    assertThrows(Assistant.Unavailable.class, () ->
      a.ask(p, Store.JSON.readTree("{\"message\":\"Explain\"}"))
    );
    assertEquals(1, s.read(p.id()).revision());
  }

  @Test
  void proposalsAreValidatedInspectableGuardedAndUndoable() throws Exception {
    Store s = new Store(temp);
    var p = s.create(EngineTest.fixture("simple"), List.of());
    var d = Engine.load(p.bytes()).document();
    var c = d
      .getRocket()
      .getAllChildren()
      .stream()
      .filter(x -> x instanceof info.openrocket.core.rocketcomponent.BodyTube)
      .findFirst()
      .orElseThrow();
    Assistant a = new Assistant(s, null, null, "");
    var patch = a.propose(
      p,
      Store.JSON.readTree(
        "{\"reason\":\"Test hypothesis\",\"expectedTradeoff\":\"Mass may change\",\"changes\":[{\"componentId\":\"" +
        c.getID() +
        "\",\"property\":\"length\",\"after\":0.31}]}"
      )
    );
    assertEquals(1, s.read(p.id()).revision());
    assertTrue(((List<?>) patch.get("changes")).size() == 1);
    var accepted = a.accept(p, (String) patch.get("id"));
    assertEquals(2, accepted.revision());
    assertEquals(
      .31,
      Engine.find(
        Engine.load(accepted.bytes()).document().getRocket(),
        c.getID().toString()
      ).getLength()
    );
    assertThrows(Store.Stale.class, () ->
      a.accept(accepted, (String) patch.get("id"))
    );
    var undo = s.append(
      p.id(),
      accepted.revision(),
      p.bytes(),
      List.of(),
      true
    );
    assertArrayEquals(p.bytes(), undo.bytes());
  }

  @Test
  void providerContractResolvesNumericClaimsFromStoredEngineEvidence()
    throws Exception {
    Store s = new Store(temp);
    var p = s.create(EngineTest.fixture("simple"), List.of());
    String runId = UUID.randomUUID().toString();
    s.saveRun(
      runId,
      Map.of(
        "id",
        runId,
        "projectId",
        p.id(),
        "revision",
        1,
        "summary",
        Map.of("maxAltitude", 51.05382007963538),
        "status",
        "completed"
      )
    );
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", x -> {
      var request = Store.JSON.readTree(x.getRequestBody());
      assertTrue(request.has("tools"));
      var args = Map.of(
        "narrative",
        "The selected flight reached apogee. No improvement has been demonstrated.",
        "claims",
        List.of(Map.of("runId", runId, "quantity", "maxAltitude"))
      );
      var response = Map.of(
        "choices",
        List.of(
          Map.of(
            "message",
            Map.of(
              "role",
              "assistant",
              "tool_calls",
              List.of(
                Map.of(
                  "id",
                  "test-call",
                  "type",
                  "function",
                  "function",
                  Map.of(
                    "name",
                    "answer",
                    "arguments",
                    Store.JSON.writeValueAsString(args)
                  )
                )
              )
            )
          )
        )
      );
      byte[] b = Store.JSON.writeValueAsBytes(response);
      x.sendResponseHeaders(200, b.length);
      x.getResponseBody().write(b);
      x.close();
    });
    server.start();
    try {
      Assistant a = new Assistant(
        s,
        "test-key",
        "test-model",
        "http://127.0.0.1:" + server.getAddress().getPort() + "/"
      );
      var response = a.ask(
        p,
        Store.JSON.readTree("{\"message\":\"Explain this result\"}")
      );
      var claims = Store.JSON.valueToTree(response.get("claims"));
      assertEquals(51.05382007963538, claims.path(0).path("value").asDouble());
      assertEquals("m", claims.path(0).path("unit").asText());
      assertEquals(1, s.read(p.id()).revision());
    } finally {
      server.stop(0);
    }
  }
}

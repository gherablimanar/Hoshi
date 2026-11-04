package rocket;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;

class RequestAccessTest {

  @Test
  void publicDeploymentFailsClosedWithoutPassword() {
    assertThrows(IllegalArgumentException.class, () ->
      new RequestAccess(Map.of("REQUIRE_AUTH", "true"))
    );
  }

  @Test
  void authenticationAndOriginsAreExplicit() {
    var p = new RequestAccess(
      Map.of(
        "REQUIRE_AUTH",
        "true",
        "APP_ACCESS_PASSWORD",
        "test-password-for-hosted-tests",
        "RENDER_EXTERNAL_HOSTNAME",
        "test-engine.onrender.com",
        "ALLOWED_ORIGINS",
        "https://gherablimanar.github.io"
      )
    );
    assertTrue(p.hostAllowed("test-engine.onrender.com"));
    assertFalse(p.hostAllowed("evil.invalid"));
    assertTrue(
      p.originAllowed(
        "test-engine.onrender.com",
        "https://gherablimanar.github.io"
      )
    );
    assertFalse(
      p.originAllowed(
        "test-engine.onrender.com",
        "https://gherablimanar.github.io.evil.invalid"
      )
    );
    assertFalse(p.authorized(null));
    assertFalse(p.authorized("Basic invalid!"));
    String encoded = Base64.getEncoder()
      .encodeToString(
        "rocket:test-password-for-hosted-tests".getBytes(StandardCharsets.UTF_8)
      );
    assertTrue(p.authorized("Basic " + encoded));
  }

  @Test
  void hostedHttpPreflightHealthAndProtectedData() throws Exception {
    var p = new RequestAccess(
      Map.of(
        "APP_ACCESS_PASSWORD",
        "test-password-for-hosted-tests",
        "ALLOWED_ORIGINS",
        "https://gherablimanar.github.io"
      )
    );
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", x -> {
      try {
        if (p.apply(x)) Server.json(x, 200, Map.of("ok", true));
      } finally {
        x.close();
      }
    });
    server.start();
    var client = HttpClient.newHttpClient();
    String root = "http://127.0.0.1:" + server.getAddress().getPort();
    try {
      var pre = client.send(
        HttpRequest.newBuilder(URI.create(root + "/api/projects"))
          .header("Origin", "https://gherablimanar.github.io")
          .header("Access-Control-Request-Method", "POST")
          .header(
            "Access-Control-Request-Headers",
            "authorization,content-type"
          )
          .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
          .build(),
        HttpResponse.BodyHandlers.ofString()
      );
      assertEquals(204, pre.statusCode());
      assertEquals(
        "https://gherablimanar.github.io",
        pre.headers().firstValue("Access-Control-Allow-Origin").orElseThrow()
      );
      var denied = client.send(
        HttpRequest.newBuilder(URI.create(root + "/api/projects"))
          .header("Origin", "https://gherablimanar.github.io")
          .build(),
        HttpResponse.BodyHandlers.ofString()
      );
      assertEquals(401, denied.statusCode());
      assertTrue(
        denied.headers().firstValue("Access-Control-Allow-Origin").isPresent()
      );
      var health = client.send(
        HttpRequest.newBuilder(URI.create(root + "/api/health")).build(),
        HttpResponse.BodyHandlers.ofString()
      );
      assertEquals(200, health.statusCode());
      var allowed = client.send(
        HttpRequest.newBuilder(URI.create(root + "/api/projects"))
          .header("Origin", "https://gherablimanar.github.io")
          .header(
            "Authorization",
            "Basic " +
            Base64.getEncoder()
              .encodeToString(
                "rocket:test-password-for-hosted-tests".getBytes(
                    StandardCharsets.UTF_8
                  )
              )
          )
          .build(),
        HttpResponse.BodyHandlers.ofString()
      );
      assertEquals(200, allowed.statusCode());
    } finally {
      server.stop(0);
    }
  }
}

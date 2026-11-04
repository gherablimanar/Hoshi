package rocket;

import com.sun.net.httpserver.HttpExchange;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Explicit browser origins and single-owner access for hosted deployments. */
final class RequestAccess {

  final Set<String> hosts;
  final Set<String> origins;
  final String password;

  RequestAccess(Map<String, String> env) {
    hosts = values(
      env.getOrDefault("ALLOWED_HOSTS", "127.0.0.1,localhost,[::1]")
    );
    String renderHost = env.get("RENDER_EXTERNAL_HOSTNAME");
    if (renderHost != null && !renderHost.isBlank()) hosts.add(
      renderHost.toLowerCase(Locale.ROOT)
    );
    origins = values(env.getOrDefault("ALLOWED_ORIGINS", ""));
    for (String origin : origins) {
      URI uri = URI.create(origin);
      if (
        uri.getHost() == null ||
        !Set.of("https", "http").contains(uri.getScheme()) ||
        uri.getUserInfo() != null ||
        uri.getQuery() != null ||
        uri.getFragment() != null ||
        !(uri.getPath().isEmpty() || uri.getPath().equals("/"))
      ) throw new IllegalArgumentException(
        "ALLOWED_ORIGINS must contain exact HTTP(S) website origins"
      );
    }
    password = env.getOrDefault("APP_ACCESS_PASSWORD", "");
    if (
      Boolean.parseBoolean(env.getOrDefault("REQUIRE_AUTH", "false")) &&
      password.length() < 16
    ) throw new IllegalArgumentException(
      "Hosted mode requires APP_ACCESS_PASSWORD with at least 16 characters"
    );
  }

  static Set<String> values(String text) {
    Set<String> out = new HashSet<>();
    for (String s : text.split(",")) if (!s.isBlank()) out.add(s.trim());
    return out;
  }

  boolean passwordRequired() {
    return !password.isEmpty();
  }

  boolean hostAllowed(String host) {
    try {
      return (
        host != null &&
        hosts.contains(
          URI.create("http://" + host).getHost().toLowerCase(Locale.ROOT)
        )
      );
    } catch (Exception e) {
      return false;
    }
  }

  boolean originAllowed(String host, String origin) {
    return (
      origin == null ||
      origin.equals("http://" + host) ||
      origin.equals("https://" + host) ||
      origins.contains(origin)
    );
  }

  boolean authorized(String header) {
    if (!passwordRequired()) return true;
    if (
      header == null || !header.startsWith("Basic ") || header.length() > 8192
    ) return false;
    try {
      String credentials = new String(
        Base64.getDecoder().decode(header.substring(6)),
        StandardCharsets.UTF_8
      );
      return MessageDigest.isEqual(
        credentials.getBytes(StandardCharsets.UTF_8),
        ("rocket:" + password).getBytes(StandardCharsets.UTF_8)
      );
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  boolean apply(HttpExchange x) throws java.io.IOException {
    String host = x.getRequestHeaders().getFirst("Host"), origin = x
      .getRequestHeaders()
      .getFirst("Origin");
    if (!hostAllowed(host)) {
      Server.error(
        x,
        403,
        "host_rejected",
        "Host is not allowed for this service"
      );
      return false;
    }
    if (!originAllowed(host, origin)) {
      Server.error(
        x,
        403,
        "origin_rejected",
        "This website is not allowed to connect to the engine"
      );
      return false;
    }
    if (origin != null) {
      x.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
      x.getResponseHeaders().set("Vary", "Origin");
      x
        .getResponseHeaders()
        .set("Access-Control-Expose-Headers", "Content-Disposition");
    }
    if (x.getRequestMethod().equals("OPTIONS")) {
      String method = x
        .getRequestHeaders()
        .getFirst("Access-Control-Request-Method");
      String requested = x
        .getRequestHeaders()
        .getFirst("Access-Control-Request-Headers");
      boolean valid = method != null && Set.of("GET", "POST").contains(method);
      if (requested != null) for (String h : requested.split(",")) valid &=
        Set.of("content-type", "authorization", "x-filename").contains(
          h.trim().toLowerCase(Locale.ROOT)
        );
      if (!valid) {
        Server.error(
          x,
          403,
          "preflight_rejected",
          "Unsupported method or request headers"
        );
        return false;
      }
      x
        .getResponseHeaders()
        .set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      x
        .getResponseHeaders()
        .set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Filename"
        );
      x.getResponseHeaders().set("Access-Control-Max-Age", "600");
      x.sendResponseHeaders(204, -1);
      return false;
    }
    boolean health =
      x.getRequestMethod().equals("GET") &&
      x.getRequestURI().getPath().equals("/api/health");
    if (
      x.getRequestURI().getPath().startsWith("/api/") &&
      !health &&
      !authorized(x.getRequestHeaders().getFirst("Authorization"))
    ) {
      Server.error(
        x,
        401,
        "access_required",
        "Enter the engine access password"
      );
      return false;
    }
    return true;
  }
}

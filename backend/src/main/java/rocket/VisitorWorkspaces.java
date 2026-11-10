package rocket;

import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;

/** Opaque visitor capabilities select isolated stores, never the owner's root. */
final class VisitorWorkspaces {

  static final long LIFETIME = 24 * 60 * 60 * 1000L;
  static final int MAX_SESSIONS = 128;
  final Path root;
  final Jobs ownerJobs;
  final Map<String, Workspace> cache = new HashMap<>();
  final SecureRandom random = new SecureRandom();

  static final class Limit extends RuntimeException {

    Limit(String message) {
      super(message);
    }
  }

  static final class Workspace {

    final Store store;
    final Jobs jobs;
    final Assistant assistant;
    final long expires;
    long window;
    int requests;

    Workspace(Store store, Jobs jobs, long expires) {
      this.store = store;
      this.jobs = jobs;
      this.expires = expires;
      this.assistant = new Assistant(
        store,
        null,
        null,
        "https://api.openai.com/v1/chat/completions"
      );
    }

    synchronized void check(boolean write) throws Exception {
      long now = System.currentTimeMillis();
      if (now - window > 60_000) {
        window = now;
        requests = 0;
      }
      if (++requests > 240) throw new Limit(
        "Visitor request limit reached. Wait one minute and try again."
      );
      if (!write) return;
      if (
        jobs.jobs.size() >= 100 ||
        count(store.root, false) > 2000 ||
        count(store.root, true) > 64L * 1024 * 1024
      ) throw new Limit(
        "Visitor workspace limit reached. Export your designs and flight data."
      );
    }
  }

  VisitorWorkspaces(Path data, Jobs ownerJobs) throws Exception {
    root = data.resolve("visitors");
    this.ownerJobs = ownerJobs;
    Files.createDirectories(root);
  }

  static long count(Path dir, boolean bytes) throws Exception {
    try (var files = Files.walk(dir)) {
      long total = 0;
      for (var p : files.filter(Files::isRegularFile).toList()) total += bytes
        ? Files.size(p)
        : 1;
      return total;
    }
  }

  Path directory(String header) {
    if (header == null || !header.matches("Bearer [0-9a-f]{64}")) return null;
    return root.resolve(
      Store.hash(
        header.substring(7).getBytes(java.nio.charset.StandardCharsets.UTF_8)
      )
    );
  }

  long expiration(Path dir) {
    try {
      return Store.JSON.readTree(
        Files.readAllBytes(dir.resolve("session.json"))
      )
        .path("expires")
        .asLong();
    } catch (Exception ignored) {
      return 0;
    }
  }

  synchronized boolean valid(String header) {
    Path dir = directory(header);
    return dir != null && expiration(dir) > System.currentTimeMillis();
  }

  synchronized Workspace resolve(String header) throws Exception {
    Path dir = directory(header);
    if (dir == null || !valid(header)) throw new IllegalArgumentException(
      "Visitor session expired"
    );
    String id = dir.getFileName().toString();
    Workspace workspace = cache.get(id);
    if (workspace == null) {
      var store = new Store(dir);
      workspace = new Workspace(
        store,
        new Jobs(store, ownerJobs.worker, true),
        expiration(dir)
      );
      cache.put(id, workspace);
    }
    return workspace;
  }

  synchronized Map<String, Object> create() throws Exception {
    long now = System.currentTimeMillis();
    try (var dirs = Files.list(root)) {
      for (var dir : dirs.filter(Files::isDirectory).toList()) {
        String id = dir.getFileName().toString();
        if (!id.matches("[0-9a-f]{64}")) continue;
        var workspace = cache.get(id);
        boolean active =
          workspace != null &&
          workspace.jobs.jobs
            .values()
            .stream()
            .anyMatch(j -> Set.of("pending", "running").contains(j.state));
        if (expiration(dir) + 600_000 <= now && !active) {
          cache.remove(id);
          try (var files = Files.walk(dir)) {
            for (var p : files
              .sorted(Comparator.reverseOrder())
              .toList()) Files.deleteIfExists(p);
          }
        }
      }
    }
    try (var dirs = Files.list(root)) {
      if (
        dirs.filter(Files::isDirectory).count() >= MAX_SESSIONS
      ) throw new Limit(
        "All visitor workspaces are currently in use. Try again later."
      );
    }
    if (count(root, true) > 256L * 1024 * 1024) throw new Limit(
      "The public service is at its storage limit. Try again later."
    );
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = HexFormat.of().formatHex(bytes);
    Path dir = directory("Bearer " + token);
    Files.createDirectory(dir);
    long expires = now + LIFETIME;
    Files.write(
      dir.resolve("session.json"),
      Store.JSON.writeValueAsBytes(Map.of("expires", expires)),
      StandardOpenOption.CREATE_NEW
    );
    return Map.of(
      "token",
      token,
      "expiresAt",
      java.time.Instant.ofEpochMilli(expires).toString()
    );
  }

  synchronized void checkStorage() throws Exception {
    if (count(root, true) > 256L * 1024 * 1024) throw new Limit(
      "Public storage limit reached. Export your designs; try editing later."
    );
  }
}

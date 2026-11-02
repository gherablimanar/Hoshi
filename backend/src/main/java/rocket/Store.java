package rocket;

import com.fasterxml.jackson.databind.*;
import info.openrocket.core.document.*;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;

/** Append-only project revisions; atomic current pointer. Runs are separate immutable files. */
public final class Store {

  public static final ObjectMapper JSON = new ObjectMapper();
  final Path root;

  public Store(Path root) throws IOException {
    this.root = root;
    Files.createDirectories(root.resolve("projects"));
    Files.createDirectories(root.resolve("runs"));
  }

  public record Project(
    String id,
    long revision,
    byte[] bytes,
    List<String> importWarnings,
    boolean conversionAccepted
  ) {}

  public record Conflict(String message) {}

  public static class Stale extends RuntimeException {

    public Stale() {
      super("Project changed; reload before applying this mutation");
    }
  }

  Path dir(String id) {
    UUID.fromString(id);
    return root.resolve("projects").resolve(id);
  }

  public Project read(String id) throws Exception {
    var dir = dir(id);
    var n = JSON.readTree(Files.readAllBytes(dir.resolve("current.json")));
    long rev = n.path("revision").asLong();
    List<String> w = new ArrayList<>();
    n.path("importWarnings").forEach(x -> w.add(x.asText()));
    return new Project(
      id,
      rev,
      Files.readAllBytes(dir.resolve(rev + ".ork")),
      w,
      n.path("conversionAccepted").asBoolean()
    );
  }

  public Project create(OpenRocketDocument d, List<String> w) throws Exception {
    String id = UUID.randomUUID().toString();
    Files.createDirectory(dir(id));
    return append(id, 0, Engine.save(d), w, w.isEmpty());
  }

  public Project append(
    String id,
    long previous,
    byte[] b,
    List<String> w,
    boolean accepted
  ) throws Exception {
    if (previous > 0 && read(id).revision() != previous) throw new Stale();
    long rev = previous + 1;
    Path dir = dir(id);
    Files.write(dir.resolve(rev + ".ork"), b, StandardOpenOption.CREATE_NEW);
    Map<String, Object> n = Map.of(
      "id",
      id,
      "revision",
      rev,
      "hash",
      hash(b),
      "updatedAt",
      Instant.now().toString(),
      "importWarnings",
      w,
      "conversionAccepted",
      accepted
    );
    atomic(dir.resolve("current.json"), JSON.writeValueAsBytes(n));
    return new Project(id, rev, b, w, accepted);
  }

  static void atomic(Path p, byte[] b) throws IOException {
    Path temp = Files.createTempFile(p.getParent(), ".save-", ".tmp");
    try {
      Files.write(temp, b);
      Files.move(
        temp,
        p,
        StandardCopyOption.ATOMIC_MOVE,
        StandardCopyOption.REPLACE_EXISTING
      );
    } finally {
      Files.deleteIfExists(temp);
    }
  }

  public Map<String, Object> view(Project p) throws Exception {
    var d = Engine.load(p.bytes()).document();
    var m = Engine.inspect(d);
    m.put("id", p.id());
    m.put("revision", p.revision());
    m.put("hash", hash(p.bytes()));
    m.put("importWarnings", p.importWarnings());
    m.put("conversionAccepted", p.conversionAccepted());
    m.put(
      "savedAt",
      Instant.ofEpochMilli(
        Files.getLastModifiedTime(
          dir(p.id()).resolve("current.json")
        ).toMillis()
      ).toString()
    );
    return m;
  }

  public List<Object> list() throws Exception {
    List<Object> a = new ArrayList<>();
    try (var s = Files.list(root.resolve("projects"))) {
      for (Path p : s.sorted().toList()) {
        Project pr = read(p.getFileName().toString());
        var d = Engine.load(pr.bytes()).document();
        a.add(
          Map.of(
            "id",
            pr.id(),
            "name",
            d.getRocket().getName(),
            "revision",
            pr.revision()
          )
        );
      }
    }
    return a;
  }

  public void saveRun(String id, Map<String, Object> run) throws IOException {
    UUID.fromString(id);
    Files.write(
      root.resolve("runs").resolve(id + ".json"),
      JSON.writeValueAsBytes(run),
      StandardOpenOption.CREATE_NEW
    );
  }

  public JsonNode run(String id) throws IOException {
    UUID.fromString(id);
    return JSON.readTree(
      Files.readAllBytes(root.resolve("runs").resolve(id + ".json"))
    );
  }

  public List<JsonNode> runs(String projectId) throws IOException {
    List<JsonNode> a = new ArrayList<>();
    try (var s = Files.list(root.resolve("runs"))) {
      for (Path p : s.sorted().toList()) {
        JsonNode n = JSON.readTree(Files.readAllBytes(p));
        if (n.path("projectId").asText().equals(projectId)) a.add(n);
      }
    }
    return a;
  }

  public static String hash(byte[] b) {
    try {
      return HexFormat.of()
        .formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    } catch (NoSuchAlgorithmException e) {
      throw new AssertionError(e);
    }
  }
}

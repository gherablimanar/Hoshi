package rocket;

import com.fasterxml.jackson.databind.*;
import com.sun.net.httpserver.*;
import info.openrocket.core.document.*;
import info.openrocket.core.material.Material;
import info.openrocket.core.motor.*;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

public final class Server {

  final Store store;
  final Jobs jobs;
  final Path web;
  final Assistant assistant;
  final RequestAccess access;
  final VisitorWorkspaces visitors;
  final Set<String> bundledMotors;

  public Server(Path data, Path web) throws Exception {
    this(data, web, System.getenv());
  }

  Server(Path data, Path web, Map<String, String> env) throws Exception {
    this.bundledMotors = new HashSet<>();
    Engine.motors().forEach(m -> bundledMotors.add(m.getDigest()));
    this.store = new Store(data);
    MotorImports.load(store);
    this.jobs = new Jobs(store);
    this.visitors = new VisitorWorkspaces(data, jobs);
    this.access = new RequestAccess(env, visitors::valid);
    this.assistant = new Assistant(store);
    this.web = web.toAbsolutePath().normalize();
  }

  public static void main(String[] args) throws Exception {
    System.setProperty("java.awt.headless", "true");
    new RequestAccess(System.getenv());
    Engine.initialize();
    Server app = new Server(
      Path.of(System.getenv().getOrDefault("DATA_DIR", "data")),
      Path.of(System.getenv().getOrDefault("WEB_DIR", "frontend/dist"))
    );
    HttpServer server = HttpServer.create(
      new InetSocketAddress(
        System.getenv().getOrDefault("BIND_HOST", "127.0.0.1"),
        Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"))
      ),
      32
    );
    server.createContext("/", app::handle);
    server.setExecutor(
      new ThreadPoolExecutor(
        8,
        8,
        0,
        TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(32)
      )
    );
    server.start();
    System.out.println(
      "Rocket Designer listening on " +
      server.getAddress() +
      "; OpenRocket " +
      Engine.VERSION +
      " " +
      Engine.REVISION
    );
  }

  void handle(HttpExchange x) throws IOException {
    try {
      if (!access.apply(x)) return;
      String path = x.getRequestURI().getPath();
      if (!path.startsWith("/api/")) {
        staticFile(x, path);
        return;
      }
      route(x, path, x.getRequestMethod());
    } catch (VisitorWorkspaces.Limit e) {
      x.getResponseHeaders().set("Retry-After", "60");
      error(x, 429, "visitor_limit", e.getMessage());
    } catch (Assistant.Unavailable e) {
      error(x, 503, "ai_unavailable", e.getMessage());
    } catch (Store.Stale e) {
      error(x, 409, "stale_revision", e.getMessage());
    } catch (NoSuchFileException e) {
      error(x, 404, "not_found", "Project or run not found");
    } catch (
      info.openrocket.core.file.RocketLoadException | org.xml.sax.SAXException e
    ) {
      error(x, 422, "invalid_import", e.getMessage());
    } catch (IllegalArgumentException e) {
      error(x, 422, "invalid_request", e.getMessage());
    } catch (Exception e) {
      e.printStackTrace();
      error(
        x,
        500,
        "operation_failed",
        e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()
      );
    } finally {
      x.close();
    }
  }

  static Map<String, Object> motorView(
    ThrustCurveMotor motor,
    boolean curve,
    boolean visitor
  ) {
    var view = new LinkedHashMap<String, Object>(Engine.motor(motor, curve));
    if (visitor) view.put("source", "Bundled OpenRocket 24.12 motor database");
    return view;
  }

  void route(HttpExchange x, String path, String method) throws Exception {
    if (path.equals("/api/health")) {
      json(
        x,
        200,
        Map.of(
          "status",
          "ok",
          "accessPasswordRequired",
          access.passwordRequired(),
          "publicVisitorsEnabled",
          access.publicVisitors,
          "ephemeralStorage",
          Boolean.parseBoolean(
            System.getenv().getOrDefault("EPHEMERAL_STORAGE", "false")
          ),
          "engine",
          Engine.VERSION,
          "commit",
          Engine.REVISION,
          "aiConfigured",
          assistant.configured() &&
          (!access.publicVisitors ||
            access.authorized(x.getRequestHeaders().getFirst("Authorization"))),
          "aiStatus",
          access.publicVisitors &&
            !access.authorized(x.getRequestHeaders().getFirst("Authorization"))
            ? Map.of("configured", false, "message", "Owner-only assistant")
            : assistant.status()
        )
      );
      return;
    }
    if (
      access.publicVisitors &&
      path.equals("/api/visitor-session") &&
      method.equals("POST")
    ) {
      json(x, 201, visitors.create());
      return;
    }
    boolean visitor =
      access.publicVisitors &&
      !access.authorized(x.getRequestHeaders().getFirst("Authorization"));
    var workspace = visitor
      ? visitors.resolve(x.getRequestHeaders().getFirst("Authorization"))
      : null;
    Store store = visitor ? workspace.store : this.store;
    Jobs jobs = visitor ? workspace.jobs : this.jobs;
    Assistant assistant = visitor ? workspace.assistant : this.assistant;
    if (visitor) {
      workspace.check(!method.equals("GET"));
      if (!method.equals("GET")) visitors.checkStorage();
      if (path.equals("/api/motors/import")) {
        error(
          x,
          403,
          "owner_only",
          "Shared motor database imports require owner access"
        );
        return;
      }
      if (
        (path.endsWith("/jobs") || path.endsWith("/analysis")) &&
        method.equals("POST") &&
        jobs.jobs
          .values()
          .stream()
          .anyMatch(j -> Set.of("pending", "running").contains(j.state))
      ) throw new VisitorWorkspaces.Limit(
        "Wait for your current calculation to finish before starting another."
      );
    }
    if (path.equals("/api/visitor-session") && method.equals("GET")) {
      json(x, 200, Map.of("visitor", visitor));
      return;
    }
    if (path.equals("/api/catalog") && method.equals("GET")) {
      json(
        x,
        200,
        Map.of("components", Engine.TYPES.keySet(), "engine", Engine.VERSION)
      );
      return;
    }
    if (path.equals("/api/examples") && method.equals("GET")) {
      json(x, 200, examples());
      return;
    }
    if (path.equals("/api/projects") && method.equals("GET")) {
      synchronized (Engine.LOCK) {
        json(x, 200, store.list());
      }
      return;
    }
    if (path.equals("/api/projects") && method.equals("POST")) {
      JsonNode n = body(x);
      synchronized (Engine.LOCK) {
        OpenRocketDocument d;
        List<String> w = List.of();
        if (n.has("example")) {
          String name = n.path("example").asText();
          if (!examples().contains(name)) throw new IllegalArgumentException(
            "Unknown upstream example"
          );
          try (
            var in =
              Engine.class.getResourceAsStream("/datafiles/examples/" + name)
          ) {
            var l = Engine.load(
              Engine.limited(in),
              visitor ? bundledMotors : null
            );
            d = l.document();
            w = l.warnings();
          }
        } else {
          d = OpenRocketDocumentFactory.createEmptyRocket();
          d.getRocket().setName(n.path("name").asText("Untitled rocket"));
        }
        json(x, 201, store.view(store.create(d, w)));
      }
      return;
    }
    if (path.equals("/api/import") && method.equals("POST")) {
      byte[] b = Engine.limited(x.getRequestBody());
      synchronized (Engine.LOCK) {
        var l = Engine.load(b, visitor ? bundledMotors : null);
        Store.Project p = store.create(l.document(), l.warnings());
        Files.write(store.dir(p.id()).resolve("original-import.bin"), b);
        json(x, 201, store.view(p));
      }
      return;
    }
    if (path.equals("/api/presets") && method.equals("GET")) {
      var q = query(x);
      String type = q.getOrDefault("type", "");
      String search = q.getOrDefault("q", "").toLowerCase(Locale.ROOT);
      synchronized (Engine.LOCK) {
        json(
          x,
          200,
          info.openrocket.core.startup.Application.getComponentPresetDao()
            .listAll()
            .stream()
            .filter(
              p ->
                p
                  .get(info.openrocket.core.preset.ComponentPreset.TYPE)
                  .name()
                  .equals(type) &&
                p.toString().toLowerCase(Locale.ROOT).contains(search)
            )
            .limit(100)
            .map(p ->
              Map.of(
                "id",
                p.getDigest(),
                "description",
                p.toString(),
                "type",
                p.get(info.openrocket.core.preset.ComponentPreset.TYPE).name()
              )
            )
            .toList()
        );
      }
      return;
    }
    if (path.equals("/api/motors/import") && method.equals("POST")) {
      String name = x.getRequestHeaders().getFirst("X-Filename");
      if (name == null) throw new IllegalArgumentException(
        "X-Filename header required"
      );
      name = java.net.URLDecoder.decode(
        name,
        java.nio.charset.StandardCharsets.UTF_8
      );
      if (name.length() > 160) throw new IllegalArgumentException(
        "Filename too long"
      );
      byte[] bytes = Engine.limited(x.getRequestBody());
      synchronized (Engine.LOCK) {
        json(x, 201, MotorImports.save(store, bytes, name));
      }
      return;
    }
    if (path.equals("/api/motors") && method.equals("GET")) {
      var q = query(x);
      String search = q.getOrDefault("q", "").toLowerCase(Locale.ROOT);
      double diameter = Double.parseDouble(q.getOrDefault("diameter", "100"));
      synchronized (Engine.LOCK) {
        json(
          x,
          200,
          Engine.motors()
            .stream()
            .filter(m -> !visitor || bundledMotors.contains(m.getDigest()))
            .filter(
              m ->
                (m.getManufacturer() + " " + m.getDesignation()).toLowerCase(
                    Locale.ROOT
                  ).contains(search) &&
                m.getDiameter() <= diameter + 0.00001
            )
            .limit(100)
            .map(m -> motorView(m, false, visitor))
            .toList()
        );
      }
      return;
    }
    if (path.startsWith("/api/motors/") && method.equals("GET")) {
      String digest = path.substring("/api/motors/".length());
      if (
        visitor && !bundledMotors.contains(digest)
      ) throw new NoSuchFileException("Motor");
      synchronized (Engine.LOCK) {
        var m = Engine.motors()
          .stream()
          .filter(a -> a.getDigest().equals(digest))
          .findFirst()
          .orElseThrow(() -> new IllegalArgumentException("Motor not found"));
        json(x, 200, motorView(m, true, visitor));
      }
      return;
    }
    String[] a = path.split("/");
    if (a.length >= 4 && a[2].equals("jobs")) {
      var j = jobs.get(a[3]);
      if (
        a.length == 5 && a[4].equals("cancel") && method.equals("POST")
      ) jobs.cancel(j.id);
      json(x, 200, j.view());
      return;
    }
    if (a.length >= 4 && a[2].equals("runs")) {
      var run = store.run(a[3]);
      if (a.length == 5 && a[4].equals("csv")) {
        csv(x, run, query(x).get("variables"));
        return;
      }
      json(x, 200, run);
      return;
    }
    if (a.length >= 4 && a[2].equals("projects")) {
      String id = a[3];
      if (a.length == 4 && method.equals("GET")) {
        synchronized (Engine.LOCK) {
          json(x, 200, store.view(store.read(id)));
        }
        return;
      }
      if (a.length == 5 && a[4].equals("runs") && method.equals("GET")) {
        json(x, 200, store.runs(id));
        return;
      }
      if (a.length == 5 && a[4].equals("original") && method.equals("GET")) {
        send(
          x,
          200,
          "application/octet-stream",
          Files.readAllBytes(store.dir(id).resolve("original-import.bin")),
          "original.ork"
        );
        return;
      }
      if (a.length == 5 && a[4].equals("export") && method.equals("GET")) {
        var p = store.read(id);
        if (!p.conversionAccepted()) throw new IllegalArgumentException(
          "Import warnings require explicit conversion acceptance before export"
        );
        send(x, 200, "application/xml", p.bytes(), "rocket.ork");
        return;
      }
      if (
        a.length == 5 &&
        Set.of("mesh", "obj", "interchange", "finSvg").contains(a[4]) &&
        method.equals("GET")
      ) {
        synchronized (Engine.LOCK) {
          var p = store.read(id);
          var d = Engine.load(p.bytes()).document();
          var q = query(x);
          if (a[4].equals("mesh")) {
            json(x, 200, Exports.mesh(d));
            return;
          }
          if (a[4].equals("obj")) {
            var result = Exports.obj(d, q.get("componentId"));
            if (
              !result.warnings().isEmpty() &&
              !q.getOrDefault("acceptWarnings", "false").equals("true")
            ) {
              json(
                x,
                422,
                Map.of(
                  "error",
                  Map.of(
                    "code",
                    "export_warnings",
                    "message",
                    "Explicit conversion acceptance required",
                    "warnings",
                    result.warnings()
                  )
                )
              );
              return;
            }
            send(x, 200, "text/plain", result.bytes(), "rocket.obj");
            return;
          }
          if (a[4].equals("finSvg")) {
            send(
              x,
              200,
              "image/svg+xml",
              Exports.finSvg(d, q.get("componentId")),
              "fin.svg"
            );
            return;
          }
          String format = q.getOrDefault("format", "rocksim");
          var result = Exports.interchange(d, format);
          if (
            !result.warnings().isEmpty() &&
            !q.getOrDefault("acceptWarnings", "false").equals("true")
          ) {
            json(
              x,
              422,
              Map.of(
                "error",
                Map.of(
                  "code",
                  "export_warnings",
                  "message",
                  "Inspect conversion warnings before export",
                  "warnings",
                  result.warnings()
                )
              )
            );
            return;
          }
          if (!q.getOrDefault("download", "false").equals("true")) {
            json(
              x,
              200,
              Map.of("warnings", result.warnings(), "format", format)
            );
            return;
          }
          send(
            x,
            200,
            "application/xml",
            result.bytes(),
            format.equals("rocksim") ? "rocket.rkt" : "rocket.CDX1"
          );
          return;
        }
      }
      if (a.length == 5 && a[4].equals("analysis") && method.equals("POST")) {
        var n = body(x);
        var p = store.read(id);
        guard(p, n);
        json(x, 202, jobs.startAdvanced(p, n).view());
        return;
      }
      if (
        a.length == 5 &&
        a[4].equals("acceptOptimization") &&
        method.equals("POST")
      ) {
        var n = body(x);
        synchronized (Engine.LOCK) {
          var p = store.read(id);
          guard(p, n);
          var run = store.run(n.path("runId").asText());
          if (
            !run.path("projectId").asText().equals(id) ||
            !run.path("kind").asText().equals("optimization") ||
            !run.path("status").asText().equals("completed") ||
            run.path("revision").asLong() != p.revision() ||
            !run.path("designHash").asText().equals(Store.hash(p.bytes()))
          ) throw new Store.Stale();
          var d = Engine.load(p.bytes()).document();
          for (var change : run.path("changes")) Engine.set(
            Engine.find(d.getRocket(), change.path("componentId").asText()),
            change.path("property").asText(),
            change.path("after"),
            Engine.PROPERTIES
          );
          json(
            x,
            200,
            store.view(
              store.append(
                id,
                p.revision(),
                Engine.save(d),
                p.importWarnings(),
                p.conversionAccepted()
              )
            )
          );
        }
        return;
      }
      if (a.length == 5 && a[4].equals("jobs") && method.equals("POST")) {
        JsonNode n = body(x);
        Store.Project p = store.read(id);
        guard(p, n);
        json(x, 202, jobs.start(p, n.path("simulationIndex").asInt(0)).view());
        return;
      }
      if (a.length == 5 && a[4].equals("mutate") && method.equals("POST")) {
        JsonNode n = body(x);
        if (
          visitor &&
          n.path("op").asText().equals("motor") &&
          !bundledMotors.contains(n.path("motorId").asText())
        ) throw new IllegalArgumentException(
          "Choose a bundled motor in visitor mode"
        );
        synchronized (Engine.LOCK) {
          var p = store.read(id);
          guard(p, n);
          var d = Engine.load(p.bytes()).document();
          mutate(d, n);
          boolean accepted =
            p.conversionAccepted() ||
            n.path("op").asText().equals("acceptConversion");
          var next = store.append(
            id,
            p.revision(),
            Engine.save(d),
            p.importWarnings(),
            accepted
          );
          json(x, 200, store.view(next));
        }
        return;
      }
      if (a.length == 5 && a[4].equals("restore") && method.equals("POST")) {
        JsonNode n = body(x);
        if (
          visitor &&
          n.path("op").asText().equals("motor") &&
          !bundledMotors.contains(n.path("motorId").asText())
        ) throw new IllegalArgumentException(
          "Choose a bundled motor in visitor mode"
        );
        synchronized (Engine.LOCK) {
          var p = store.read(id);
          guard(p, n);
          long target = n.path("targetRevision").asLong();
          if (
            target < 1 || target > p.revision()
          ) throw new IllegalArgumentException("Invalid revision");
          byte[] b = Files.readAllBytes(store.dir(id).resolve(target + ".ork"));
          json(
            x,
            200,
            store.view(
              store.append(
                id,
                p.revision(),
                b,
                p.importWarnings(),
                p.conversionAccepted()
              )
            )
          );
        }
        return;
      }
      if (a.length == 5 && a[4].equals("validate") && method.equals("POST")) {
        synchronized (Engine.LOCK) {
          json(x, 200, store.view(store.read(id)));
        }
        return;
      }
      if (
        a.length == 5 && a[4].equals("acceptPatch") && method.equals("POST")
      ) {
        var n = body(x);
        synchronized (Engine.LOCK) {
          var p = store.read(id);
          guard(p, n);
          json(
            x,
            200,
            store.view(assistant.accept(p, n.path("proposalId").asText()))
          );
        }
        return;
      }
      if (a.length == 5 && a[4].equals("ai") && method.equals("POST")) {
        var n = body(x);
        var p = store.read(id);
        guard(p, n);
        json(x, 200, assistant.ask(p, n));
        return;
      }
    }
    error(x, 404, "not_found", "API operation not found");
  }

  static void guard(Store.Project p, JsonNode n) {
    if (
      !n.has("revision") || n.path("revision").asLong(-1) != p.revision()
    ) throw new Store.Stale();
  }

  static void mutate(OpenRocketDocument d, JsonNode n) throws Exception {
    Rocket r = d.getRocket();
    String op = n.path("op").asText();
    switch (op) {
      case "set" -> {
        RocketComponent c = Engine.find(r, n.path("componentId").asText());
        var fields = n.path("changes").fields();
        while (fields.hasNext()) {
          var e = fields.next();
          Engine.set(c, e.getKey(), e.getValue(), Engine.PROPERTIES);
        }
      }
      case "add" -> {
        RocketComponent p = Engine.find(r, n.path("parentId").asText());
        var t = Engine.TYPES.get(n.path("type").asText());
        if (t == null || !p.isCompatible(t)) throw new IllegalArgumentException(
          "Select a compatible parent: " +
          p.getName() +
          " does not accept " +
          n.path("type").asText()
        );
        var c = t.getDeclaredConstructor().newInstance();
        p.addChild(c);
        r.getSelectedConfiguration().setAllStages();
      }
      case "remove" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (c.getParent() == null) throw new IllegalArgumentException(
          "Cannot remove the rocket root"
        );
        c.getParent().removeChild(c);
      }
      case "duplicate", "paste" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        var parent = op.equals("paste")
          ? Engine.find(r, n.path("parentId").asText())
          : c.getParent();
        if (
          parent == null || !parent.isCompatible(c.getClass())
        ) throw new IllegalArgumentException("Incompatible paste parent");
        var copy = c.copy();
        copy.setName(c.getName() + " copy");
        parent.addChild(copy);
      }
      case "move" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        var p = c.getParent();
        if (p == null) throw new IllegalArgumentException(
          "Cannot reorder root"
        );
        int target = p.getChildPosition(c) + n.path("delta").asInt();
        if (
          target < 0 || target >= p.getChildCount()
        ) throw new IllegalArgumentException("Already at boundary");
        p.moveChild(c, target);
      }
      case "reparent" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        var parent = Engine.find(r, n.path("parentId").asText());
        if (
          c == r ||
          c == parent ||
          c.containsChild(parent) ||
          !parent.isCompatible(c.getClass())
        ) throw new IllegalArgumentException("Invalid parent");
        c.getParent().removeChild(c);
        parent.addChild(c);
      }
      case "material" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        double density = n.path("density").asDouble(Double.NaN);
        if (
          !Double.isFinite(density) || density <= 0
        ) throw new IllegalArgumentException("Density must be positive");
        Material current;
        try {
          current = (Material) c.getClass().getMethod("getMaterial").invoke(c);
        } catch (NoSuchMethodException ex) {
          throw new IllegalArgumentException("This component has no material");
        }
        var mat = Material.newMaterial(
          current.getType(),
          n.path("name").asText("Custom material"),
          density,
          true
        );
        mat.setDocumentMaterial(true);
        c.getClass().getMethod("setMaterial", Material.class).invoke(c, mat);
        d.getDocumentPreferences().addMaterial(mat);
      }
      case "appearance" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        String color = n.path("color").asText();
        if (
          !color.matches("#[0-9a-fA-F]{6}")
        ) throw new IllegalArgumentException("RGB hex color required");
        var rgb = java.awt.Color.decode(color);
        double shine = n.path("shine").asDouble(.3);
        if (
          !Double.isFinite(shine) || shine < 0 || shine > 1
        ) throw new IllegalArgumentException("Shine must be 0–1");
        var old = c.getAppearance();
        c.setAppearance(
          new info.openrocket.core.appearance.Appearance(
            new info.openrocket.core.util.ORColor(
              rgb.getRed(),
              rgb.getGreen(),
              rgb.getBlue()
            ),
            shine,
            old == null ? null : old.getTexture()
          )
        );
      }
      case "preset" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        var preset =
          info.openrocket.core.startup.Application.getComponentPresetDao()
            .listAll()
            .stream()
            .filter(a -> a.getDigest().equals(n.path("presetId").asText()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Preset not found")
            );
        if (
          c.getPresetType() !=
          preset.get(info.openrocket.core.preset.ComponentPreset.TYPE)
        ) throw new IllegalArgumentException(
          "Preset type does not match component"
        );
        c.loadPreset(preset);
      }
      case "expression" -> {
        if (
          d.getCustomExpressions().size() >= 16
        ) throw new IllegalArgumentException("Maximum 16 expressions");
        String expression = n.path("expression").asText();
        if (expression.length() > 1000) throw new IllegalArgumentException(
          "Expression too long"
        );
        var exp =
          new info.openrocket.core.simulation.customexpression.CustomExpression(
            d,
            n.path("name").asText(),
            n.path("symbol").asText(),
            n.path("unit").asText(),
            expression
          );
        if (!exp.checkAll()) throw new IllegalArgumentException(
          "Invalid or duplicate expression name/symbol or expression syntax"
        );
        d.addCustomExpression(exp);
      }
      case "removeExpression" -> {
        var exp = d
          .getCustomExpressions()
          .stream()
          .filter(e -> e.getSymbol().equals(n.path("symbol").asText()))
          .findFirst()
          .orElseThrow(() ->
            new IllegalArgumentException("Expression not found")
          );
        d.removeCustomExpression(exp);
      }
      case "finPoints" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (
          !(c instanceof FreeformFinSet f)
        ) throw new IllegalArgumentException("Select freeform fins");
        var points = n.path("points");
        if (
          !points.isArray() || points.size() < 3 || points.size() > 128
        ) throw new IllegalArgumentException("3–128 fin points required");
        Coordinate[] coords = new Coordinate[points.size()];
        for (int i = 0; i < coords.length; i++) {
          double px = points.get(i).path(0).asDouble(Double.NaN), py = points
            .get(i)
            .path(1)
            .asDouble(Double.NaN);
          if (
            !Double.isFinite(px) || !Double.isFinite(py) || py < 0
          ) throw new IllegalArgumentException("Invalid fin point");
          coords[i] = new Coordinate(px, py);
        }
        f.setPoints(coords);
      }
      case "cluster" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (!(c instanceof InnerTube tube)) throw new IllegalArgumentException(
          "Clusters require an inner tube"
        );
        var cluster = Arrays.stream(ClusterConfiguration.CONFIGURATIONS)
          .filter(x -> x.getXMLName().equals(n.path("pattern").asText()))
          .findFirst()
          .orElseThrow(() ->
            new IllegalArgumentException("Unknown cluster pattern")
          );
        tube.setClusterConfiguration(cluster);
      }
      case "stageEnabled" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (
          !(c instanceof AxialStage stage)
        ) throw new IllegalArgumentException("Select a stage");
        r
          .getSelectedConfiguration()
          ._setStageActive(
            stage.getStageNumber(),
            n.path("enabled").asBoolean()
          );
      }
      case "separation" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (
          !(c instanceof AxialStage stage)
        ) throw new IllegalArgumentException("Select a stage");
        var cfg = stage
          .getSeparationConfigurations()
          .get(r.getSelectedConfiguration().getId())
          .clone();
        var fields = n.path("changes").fields();
        while (fields.hasNext()) {
          var e = fields.next();
          Engine.set(
            cfg,
            e.getKey(),
            e.getValue(),
            Set.of("separationEvent", "separationDelay", "separationAltitude")
          );
        }
        stage
          .getSeparationConfigurations()
          .set(r.getSelectedConfiguration().getId(), cfg);
      }
      case "ignition" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (!(c instanceof MotorMount mm)) throw new IllegalArgumentException(
          "Select a motor mount"
        );
        var mc = mm.getMotorConfig(r.getSelectedConfiguration().getId());
        var fields = n.path("changes").fields();
        while (fields.hasNext()) {
          var e = fields.next();
          Engine.set(
            mc,
            e.getKey(),
            e.getValue(),
            Set.of("ignitionEvent", "ignitionDelay", "ejectionDelay")
          );
        }
      }
      case "configuration" -> {
        var f = r.createFlightConfiguration(new FlightConfigurationId());
        f.setName(n.path("name").asText("Flight configuration"));
        r.setSelectedConfiguration(f.getId());
      }
      case "selectConfiguration" -> {
        var id = new FlightConfigurationId(n.path("configurationId").asText());
        r.setSelectedConfiguration(id);
      }
      case "motor" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (
          !(c instanceof MotorMount mount)
        ) throw new IllegalArgumentException("Select a motor mount");
        var motor = Engine.motors()
          .stream()
          .filter(m -> m.getDigest().equals(n.path("motorId").asText()))
          .findFirst()
          .orElseThrow(() -> new IllegalArgumentException("Motor not found"));
        if (
          motor.getDiameter() > mount.getMotorMountDiameter() + 0.0001
        ) throw new IllegalArgumentException(
          "Motor diameter exceeds mount diameter"
        );
        if (
          motor.getLength() >
          mount.getLength() + mount.getMotorOverhang() + 0.0001
        ) throw new IllegalArgumentException(
          "Motor length exceeds mount and overhang"
        );
        mount.setMotorMount(true);
        var id = r.getSelectedConfiguration().getId();
        if (id.isDefaultId()) {
          id = new FlightConfigurationId();
          r.createFlightConfiguration(id);
          r.setSelectedConfiguration(id);
        }
        var mc = new MotorConfiguration(mount, id);
        mc.setMotor(motor);
        double delay = n.path("delay").asDouble(3);
        if (
          !Double.isFinite(delay) || delay < 0
        ) throw new IllegalArgumentException(
          "Nonnegative ejection delay required"
        );
        mc.setEjectionDelay(delay);
        if (n.has("ignitionEvent")) mc.setIgnitionEvent(
          IgnitionEvent.valueOf(n.path("ignitionEvent").asText())
        );
        if (n.has("ignitionDelay")) mc.setIgnitionDelay(
          n.path("ignitionDelay").asDouble()
        );
        mount.setMotorConfig(mc, id);
        r.getSelectedConfiguration().update();
      }
      case "recovery" -> {
        var c = Engine.find(r, n.path("componentId").asText());
        if (
          !(c instanceof RecoveryDevice rec)
        ) throw new IllegalArgumentException("Select parachute or streamer");
        var cfg = rec
          .getDeploymentConfigurations()
          .get(r.getSelectedConfiguration().getId())
          .clone();
        Engine.set(
          cfg,
          "deployEvent",
          n.path("event"),
          Set.of("deployEvent", "deployDelay", "deployAltitude")
        );
        if (n.has("delay")) Engine.set(
          cfg,
          "deployDelay",
          n.path("delay"),
          Set.of("deployDelay")
        );
        if (n.has("altitude")) Engine.set(
          cfg,
          "deployAltitude",
          n.path("altitude"),
          Set.of("deployAltitude")
        );
        rec
          .getDeploymentConfigurations()
          .set(r.getSelectedConfiguration().getId(), cfg);
      }
      case "simulation" -> {
        var sim = new Simulation(d, r);
        sim.setName(n.path("name").asText("Launch simulation"));
        var cfg = r.getSelectedConfiguration().getId();
        if (cfg.isDefaultId()) {
          cfg = new FlightConfigurationId();
          r.createFlightConfiguration(cfg);
          r.setSelectedConfiguration(cfg);
        }
        sim.setFlightConfigurationId(cfg);
        sim.getOptions().setRandomSeed(24012);
        d.addSimulation(sim);
      }
      case "settings" -> {
        int i = n.path("simulationIndex").asInt();
        var sim = d.getSimulation(i);
        if (n.has("configurationId")) sim.setFlightConfigurationId(
          new FlightConfigurationId(n.path("configurationId").asText())
        );
        var fields = n.path("changes").fields();
        while (fields.hasNext()) {
          var e = fields.next();
          Engine.set(
            sim.getOptions(),
            e.getKey(),
            e.getValue(),
            Engine.OPTIONS
          );
        }
        if (n.has("wind")) {
          var w = n.path("wind");
          for (String k : List.of(
            "average",
            "standardDeviation",
            "direction"
          )) if (w.has(k)) Engine.set(
            sim.getOptions().getAverageWindModel(),
            k,
            w.get(k),
            Set.of("average", "standardDeviation", "direction")
          );
        }
        if (n.has("windAltitudeReference")) Engine.set(
          sim.getOptions().getMultiLevelWindModel(),
          "altitudeReference",
          n.path("windAltitudeReference"),
          Set.of("altitudeReference")
        );
        if (n.has("windLevels")) {
          var w = sim.getOptions().getMultiLevelWindModel();
          w.clearLevels();
          if (
            n.path("windLevels").isEmpty()
          ) throw new IllegalArgumentException(
            "At least one wind level required"
          );
          for (var l : n.path("windLevels")) {
            double alt = l.path("altitude").asDouble(Double.NaN), speed = l
              .path("speed")
              .asDouble(Double.NaN), dir = l
              .path("direction")
              .asDouble(Double.NaN), std = l
              .path("standardDeviation")
              .asDouble(0);
            if (
              !Double.isFinite(alt) ||
              !Double.isFinite(speed) ||
              !Double.isFinite(dir) ||
              !Double.isFinite(std) ||
              speed < 0 ||
              std < 0
            ) throw new IllegalArgumentException("Invalid wind level");
            w.addWindLevel(alt, speed, dir, std);
          }
        }
      }
      case "acceptConversion" -> {}
      default -> throw new IllegalArgumentException("Unknown mutation: " + op);
    }
    r.getSelectedConfiguration().update();
    r.checkComponentStructure();
  }

  static List<String> examples() {
    return List.of(
      "A simple model rocket.ork",
      "Three stage low power rocket.ork",
      "Clustered motors.ork",
      "Dual parachute deployment.ork",
      "Tube fin rocket.ork",
      "Two stage high power rocket.ork",
      "Parallel booster staging.ork"
    );
  }

  static JsonNode body(HttpExchange x) throws IOException {
    return Store.JSON.readTree(Engine.limited(x.getRequestBody()));
  }

  static Map<String, String> query(HttpExchange x) {
    Map<String, String> m = new HashMap<>();
    String q = x.getRequestURI().getRawQuery();
    if (q != null) for (String pair : q.split("&")) {
      String[] a = pair.split("=", 2);
      m.put(
        URLDecoder.decode(a[0], java.nio.charset.StandardCharsets.UTF_8),
        a.length == 2
          ? URLDecoder.decode(a[1], java.nio.charset.StandardCharsets.UTF_8)
          : ""
      );
    }
    return m;
  }

  static void json(HttpExchange x, int status, Object o) throws IOException {
    send(x, status, "application/json", Store.JSON.writeValueAsBytes(o), null);
  }

  static void error(HttpExchange x, int code, String kind, String detail)
    throws IOException {
    json(
      x,
      code,
      Map.of(
        "error",
        Map.of("code", kind, "message", detail == null ? kind : detail)
      )
    );
  }

  static void send(
    HttpExchange x,
    int status,
    String type,
    byte[] b,
    String filename
  ) throws IOException {
    x.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
    x.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
    x.getResponseHeaders().set("Cache-Control", "no-store");
    if (filename != null) x
      .getResponseHeaders()
      .set("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    x.sendResponseHeaders(status, b.length);
    x.getResponseBody().write(b);
  }

  void staticFile(HttpExchange x, String path) throws IOException {
    if (!x.getRequestMethod().equals("GET")) {
      error(x, 405, "method_not_allowed", "GET required");
      return;
    }
    Path file = web
      .resolve(path.equals("/") ? "index.html" : path.substring(1))
      .normalize();
    if (!file.startsWith(web)) {
      error(x, 403, "invalid_path", "Invalid path");
      return;
    }
    if (!Files.isRegularFile(file)) {
      error(x, 404, "not_found", "Build the frontend first");
      return;
    }
    String type = file.toString().endsWith(".js")
      ? "application/javascript"
      : file.toString().endsWith(".css")
        ? "text/css"
        : file.toString().endsWith(".svg") ? "image/svg+xml" : "text/html";
    x
      .getResponseHeaders()
      .set(
        "Content-Security-Policy",
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; script-src 'self'"
      );
    send(x, 200, type, Files.readAllBytes(file), null);
  }

  static void csv(HttpExchange x, JsonNode run, String selected)
    throws IOException {
    StringBuilder s = new StringBuilder(
      "# engine OpenRocket 24.12; run=" +
      run.path("id").asText() +
      "; revision=" +
      run.path("revision").asText() +
      "; hash=" +
      run.path("designHash").asText() +
      "\n"
    );
    for (var b : run.path("branches")) {
      s
        .append("# branch: ")
        .append(b.path("name").asText().replace('\n', ' '))
        .append('\n');
      List<JsonNode> vars = new ArrayList<>();
      b
        .path("variables")
        .forEach(v -> {
          if (
            selected == null ||
            Arrays.asList(selected.split(",")).contains(v.path("key").asText())
          ) vars.add(v);
        });
      s
        .append(
          String.join(
            ",",
            vars
              .stream()
              .map(v ->
                quote(
                  v.path("name").asText() + " [" + v.path("unit").asText() + "]"
                )
              )
              .toList()
          )
        )
        .append('\n');
      int count = vars.isEmpty() ? 0 : vars.get(0).path("values").size();
      for (int i = 0; i < count; i++) {
        for (int k = 0; k < vars.size(); k++) {
          if (k > 0) s.append(',');
          var v = vars.get(k).path("values").path(i);
          if (v.isNumber()) s.append(v.asText());
        }
        s.append('\n');
      }
      for (var e : b.path("events")) s
        .append("# event ")
        .append(e.path("type").asText())
        .append("; t=")
        .append(e.path("time").asText())
        .append(" s\n");
    }
    send(
      x,
      200,
      "text/csv",
      s.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),
      "flight.csv"
    );
  }

  static String quote(String s) {
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }
}

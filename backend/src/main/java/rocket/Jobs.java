package rocket;

import info.openrocket.core.document.*;
import info.openrocket.core.simulation.*;
import info.openrocket.core.simulation.exception.*;
import info.openrocket.core.simulation.listeners.AbstractSimulationListener;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

/** Single bounded engine worker; documents never shared with edits or other jobs. */
public final class Jobs {

  final Store store;
  final ThreadPoolExecutor worker = new ThreadPoolExecutor(
    1,
    1,
    0,
    TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(16),
    r -> {
      Thread t = new Thread(r, "engine-worker");
      t.setDaemon(true);
      return t;
    }
  );
  final ConcurrentMap<String, Job> jobs = new ConcurrentHashMap<>();

  public static class Job {

    final String id = UUID.randomUUID().toString();
    final String projectId;
    final long revision;
    volatile String state = "pending", error;
    volatile boolean cancel = false;
    volatile Future<?> future;
    volatile int evaluations = 0;
    volatile boolean persisted = false, started = false;
    final Store.Project snapshot;
    final String createdAt = Instant.now().toString();

    Job(Store.Project p) {
      snapshot = p;
      projectId = p.id();
      revision = p.revision();
    }

    public Map<String, Object> view() {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", id);
      m.put("projectId", projectId);
      m.put("revision", revision);
      m.put(
        "state",
        started &&
          !persisted &&
          Set.of("completed", "failed", "cancelled").contains(state)
          ? "running"
          : state
      );
      m.put("error", error);
      m.put("progress", null);
      m.put("evaluations", evaluations);
      m.put("createdAt", createdAt);
      return m;
    }
  }

  public Jobs(Store s) {
    store = s;
  }

  public Job start(Store.Project p, int index) throws Exception {
    // Check bounds and executable content before enqueueing. Snapshot bytes are immutable.
    synchronized (Engine.LOCK) {
      var d = Engine.load(p.bytes()).document();
      if (
        index < 0 || index >= d.getSimulationCount()
      ) throw new IllegalArgumentException("Create simulation settings first");
    }
    Job j = new Job(p);
    jobs.put(j.id, j);
    try {
      j.future = worker.submit(() -> run(j, p, index));
    } catch (RejectedExecutionException e) {
      jobs.remove(j.id);
      throw new IllegalArgumentException(
        "Simulation queue is full (16 pending maximum)"
      );
    }
    return j;
  }

  public Job startAdvanced(
    Store.Project p,
    com.fasterxml.jackson.databind.JsonNode request
  ) {
    Job j = new Job(p);
    jobs.put(j.id, j);
    try {
      j.future = worker.submit(() -> {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", j.id);
        result.put("projectId", p.id());
        result.put("revision", p.revision());
        result.put("designHash", Store.hash(p.bytes()));
        result.put("kind", request.path("kind").asText());
        result.put(
          "engine",
          Map.of(
            "version",
            Engine.VERSION,
            "commit",
            Engine.REVISION,
            "solver",
            "OpenRocket core"
          )
        );
        result.put("inputs", request);
        result.put("startedAt", java.time.Instant.now().toString());
        try {
          synchronized (Engine.LOCK) {
            if (j.cancel) return;
            j.started = true;
            j.state = "running";
            result.putAll(Advanced.execute(p, request, j));
            j.state = j.cancel ? "cancelled" : "completed";
          }
        } catch (Exception e) {
          j.state = j.cancel ? "cancelled" : "failed";
          j.error = e.getMessage();
        }
        result.put("status", j.state);
        result.put("error", j.error);
        result.put("completedAt", java.time.Instant.now().toString());
        try {
          store.saveRun(j.id, result);
          j.persisted = true;
        } catch (Exception e) {
          j.state = "failed";
          j.error = e.getMessage();
          j.persisted = true;
        }
      });
    } catch (java.util.concurrent.RejectedExecutionException e) {
      jobs.remove(j.id);
      throw new IllegalArgumentException("Queue is full");
    }
    return j;
  }

  public Job get(String id) {
    Job j = jobs.get(id);
    if (j == null) throw new IllegalArgumentException("Unknown job");
    return j;
  }

  public void cancel(String id) {
    Job j = get(id);
    synchronized (j) {
      if (!Set.of("pending", "running").contains(j.state)) return;
      j.cancel = true;
      if (j.state.equals("pending")) {
        j.state = "cancelled";
        if (j.future != null) j.future.cancel(false);
        try {
          store.saveRun(
            j.id,
            Engine.nullableMap(
              "id",
              j.id,
              "kind",
              "flight",
              "projectId",
              j.projectId,
              "revision",
              j.revision,
              "designHash",
              Store.hash(j.snapshot.bytes()),
              "status",
              "cancelled",
              "error",
              "Cancelled before execution",
              "engine",
              Map.of(
                "version",
                Engine.VERSION,
                "commit",
                Engine.REVISION,
                "solver",
                "not executed"
              ),
              "sourceProject",
              Base64.getEncoder().encodeToString(j.snapshot.bytes()),
              "startedAt",
              j.createdAt,
              "completedAt",
              Instant.now().toString()
            )
          );
          j.persisted = true;
        } catch (Exception e) {
          j.state = "failed";
          j.error = "Cancellation could not be persisted";
          j.persisted = true;
        }
      }
    }
  }

  void run(Job j, Store.Project p, int index) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("kind", "flight");
    result.put("id", j.id);
    result.put("projectId", p.id());
    result.put("revision", p.revision());
    result.put("designHash", Store.hash(p.bytes()));
    result.put(
      "engine",
      Map.of(
        "version",
        Engine.VERSION,
        "commit",
        Engine.REVISION,
        "solver",
        "OpenRocket BasicEventSimulationEngine / RK4 6-DOF"
      )
    );
    result.put(
      "database",
      Map.of(
        "components",
        "1512874ace50917e25ccf7d7df1f616b5f39a8b5",
        "motors",
        "bundled 24.12 thrustcurves.ser",
        "importedMotors",
        Map.copyOf(MotorImports.SOURCES)
      )
    );
    result.put("startedAt", Instant.now().toString());
    result.put("units", "SI");
    Simulation currentSimulation = null;
    try {
      synchronized (Engine.LOCK) {
        synchronized (j) {
          if (j.cancel) {
            j.state = "cancelled";
            return;
          }
          j.started = true;
          j.state = "running";
        }
        var d = Engine.load(p.bytes()).document();
        var sim = d.getSimulation(index);
        currentSimulation = sim;
        result.put("simulationIndex", index);
        result.put(
          "configurationId",
          sim.getFlightConfigurationId().key.toString()
        );
        result.put(
          "options",
          Engine.properties(sim.getOptions(), Engine.OPTIONS)
        );
        var snapshot = Engine.inspect(
          Engine.load(p.bytes()).document(),
          sim.getFlightConfigurationId()
        );
        result.put("configurationSnapshot", snapshot);
        result.put(
          "configurationHash",
          Store.hash(Store.JSON.writeValueAsBytes(snapshot))
        );
        result.put(
          "stochasticLimitations",
          "Simulation seed persisted; bundled wind model seeds are not exposed by the public upstream API. Deterministic fixtures use zero wind deviation."
        );
        result.put(
          "sourceProject",
          Base64.getEncoder().encodeToString(p.bytes())
        );
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(120);
        sim.simulate(
          new info.openrocket.core.simulation.customexpression.CustomExpressionSimulationListener(
            d.getCustomExpressions()
          ),
          new AbstractSimulationListener() {
            @Override
            public boolean preStep(SimulationStatus status)
              throws SimulationException {
              if (j.cancel) throw new SimulationException("Cancelled by user");
              if (System.nanoTime() > deadline) throw new SimulationException(
                "Simulation exceeded 120 s wall-clock limit"
              );
              return true;
            }

            @Override
            public boolean isSystemListener() {
              return true;
            }
          }
        );
        result.putAll(data(sim.getSimulatedData()));
        boolean abort = sim
          .getSimulatedData()
          .getBranches()
          .stream()
          .flatMap(b -> b.getEvents().stream())
          .anyMatch(e -> e.getType() == FlightEvent.Type.SIM_ABORT);
        synchronized (j) {
          j.state = j.cancel ? "cancelled" : abort ? "failed" : "completed";
        }
        if (abort) j.error =
          "OpenRocket reported SIM_ABORT; inspect events and warnings";
      }
    } catch (Exception e) {
      if (
        currentSimulation != null &&
        currentSimulation.getSimulatedData() != null
      ) {
        try {
          result.putAll(data(currentSimulation.getSimulatedData()));
        } catch (Exception partialError) {
          result.put("partialDataError", partialError.getMessage());
        }
      }
      synchronized (j) {
        j.state = j.cancel ? "cancelled" : "failed";
      }
      j.error = e.getMessage();
    }
    result.put("status", j.state);
    result.put("error", j.error);
    result.put("completedAt", Instant.now().toString());
    try {
      store.saveRun(j.id, result);
      j.persisted = true;
    } catch (Exception e) {
      j.state = "failed";
      j.error = "Could not persist run: " + e.getMessage();
      j.persisted = true;
    }
  }

  public static Map<String, Object> data(FlightData data) {
    Map<String, Object> out = new LinkedHashMap<>();
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("maxAltitude", Engine.finite(data.getMaxAltitude()));
    summary.put("maxSpeed", Engine.finite(data.getMaxVelocity()));
    summary.put("maxAcceleration", Engine.finite(data.getMaxAcceleration()));
    summary.put("flightTime", Engine.finite(data.getFlightTime()));
    out.put("summary", summary);
    out.put("warnings", Engine.strings(data.getWarningSet()));
    List<Object> branches = new ArrayList<>();
    for (var b : data.getBranches()) {
      Map<String, Object> branch = new LinkedHashMap<>();
      branch.put("name", b.getName());
      List<Object> variables = new ArrayList<>();
      for (var t : b.getTypes()) {
        var m = new LinkedHashMap<String, Object>();
        m.put("key", t.getSymbol());
        m.put("name", t.getName());
        m.put("unit", t.getUnitGroup().getSIUnit().getUnit());
        m.put(
          "values",
          b
            .get(t)
            .stream()
            .map(x -> x == null ? null : Engine.finite(x))
            .toList()
        );
        variables.add(m);
      }
      branch.put("variables", variables);
      List<Object> events = new ArrayList<>();
      for (var e : b.getEvents()) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", e.getType().name());
        m.put("time", e.getTime());
        m.put(
          "sourceId",
          e.getSource() == null ? null : e.getSource().getID().toString()
        );
        m.put("detail", e.getData() == null ? null : e.getData().toString());
        events.add(m);
      }
      branch.put("events", events);
      branches.add(branch);
    }
    out.put("branches", branches);
    return out;
  }
}

package rocket;

import info.openrocket.core.database.motor.ThrustCurveMotorSetDatabase;
import info.openrocket.core.motor.*;
import info.openrocket.core.startup.Application;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public final class MotorImports {

  static final Map<String, String> SOURCES = new HashMap<>();

  static List<ThrustCurveMotor> parse(byte[] bytes, String filename)
    throws Exception {
    if (bytes.length > 1024 * 1024) throw new IllegalArgumentException(
      "Motor file limit is 1 MiB"
    );
    if (
      !filename.toLowerCase(Locale.ROOT).matches(".*\\.(eng|rse)")
    ) throw new IllegalArgumentException(
      "Use RASP .eng or RockSim .rse; archives not supported"
    );
    String text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
    if (
      text.toUpperCase(Locale.ROOT).contains("<!DOCTYPE") ||
      text.toUpperCase(Locale.ROOT).contains("<!ENTITY")
    ) throw new IllegalArgumentException(
      "DTD/entities are not allowed in motor files"
    );
    var result = new info.openrocket.core.file.motor.GeneralMotorLoader()
      .load(new ByteArrayInputStream(bytes), filename)
      .stream()
      .map(ThrustCurveMotor.Builder::build)
      .toList();
    if (
      result.isEmpty() || result.size() > 100
    ) throw new IllegalArgumentException(
      "Motor file must contain 1–100 motors"
    );
    for (var m : result) if (
      !Double.isFinite(m.getDiameter()) ||
      m.getDiameter() <= 0 ||
      !Double.isFinite(m.getLength()) ||
      m.getLength() <= 0 ||
      !Double.isFinite(m.getTotalImpulseEstimate()) ||
      m.getTotalImpulseEstimate() <= 0
    ) throw new IllegalArgumentException("Invalid motor geometry or impulse");
    return result;
  }

  static void register(List<ThrustCurveMotor> motors, String source) {
    var db = (ThrustCurveMotorSetDatabase) Application.getMotorSetDatabase();
    for (var m : motors) {
      if (
        Engine.motors()
          .stream()
          .noneMatch(x -> x.getDigest().equals(m.getDigest()))
      ) db.addMotor(m);
      SOURCES.put(m.getDigest(), source);
    }
  }

  static void load(Store store) throws Exception {
    Path dir = store.root.resolve("motors");
    Files.createDirectories(dir);
    try (var files = Files.list(dir)) {
      for (var p : files
        .filter(
          f -> f.toString().endsWith(".eng") || f.toString().endsWith(".rse")
        )
        .sorted()
        .toList()) {
        byte[] bytes = Files.readAllBytes(p);
        register(
          parse(bytes, p.getFileName().toString()),
          "User imported motor file SHA-256 " + Store.hash(bytes)
        );
      }
    }
  }

  static List<Map<String, Object>> save(
    Store store,
    byte[] bytes,
    String filename
  ) throws Exception {
    var motors = parse(bytes, filename);
    String hash = Store.hash(bytes);
    Path dir = store.root.resolve("motors");
    Files.createDirectories(dir);
    String ext = filename.toLowerCase(Locale.ROOT).endsWith(".rse")
      ? ".rse"
      : ".eng";
    Path file = dir.resolve(hash + ext);
    if (!Files.exists(file)) Files.write(
      file,
      bytes,
      StandardOpenOption.CREATE_NEW
    );
    register(motors, "User imported " + filename + "; SHA-256 " + hash);
    return motors.stream().map(m -> Engine.motor(m, true)).toList();
  }
}

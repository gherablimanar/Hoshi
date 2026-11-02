package rocket;

import info.openrocket.core.document.*;
import info.openrocket.core.file.wavefrontobj.ObjUtils;
import info.openrocket.core.file.wavefrontobj.export.*;
import info.openrocket.core.logging.*;
import info.openrocket.core.rocketcomponent.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public final class Exports {

  public record Export(byte[] bytes, List<String> warnings) {}

  static Export obj(OpenRocketDocument d, String componentId) throws Exception {
    Path tmp = Files.createTempDirectory("rocket-mesh-");
    try {
      var r = d.getRocket();
      var opts = new OBJExportOptions(r);
      opts.setExportChildren(true);
      opts.setExportAllInstances(true);
      opts.setExportMotors(false);
      opts.setExportAppearance(false);
      opts.setRemoveOffset(false);
      opts.setTriangulate(true);
      opts.setTriangulationMethod(ObjUtils.TriangulationMethod.SIMPLE);
      var warnings = new WarningSet();
      var chosen = componentId == null ? r : Engine.find(r, componentId);
      Path output = tmp.resolve("rocket.obj");
      new OBJExporterFactory(
        List.of(chosen),
        r.getSelectedConfiguration(),
        output.toFile(),
        opts,
        warnings
      ).doExport();
      return new Export(Files.readAllBytes(output), Engine.strings(warnings));
    } finally {
      try (var s = Files.walk(tmp)) {
        for (var p : s
          .sorted(Comparator.reverseOrder())
          .toList()) Files.deleteIfExists(p);
      }
    }
  }

  static Map<String, Object> mesh(OpenRocketDocument d) throws Exception {
    var export = obj(d, null);
    List<double[]> vertices = new ArrayList<>();
    List<int[]> faces = new ArrayList<>();
    List<String> groups = new ArrayList<>();
    String group = "";
    for (String line : new String(
      export.bytes(),
      java.nio.charset.StandardCharsets.UTF_8
    ).split("\\R")) {
      String[] parts = line.trim().split("\\s+");
      if (parts[0].equals("v")) {
        vertices.add(
          new double[] {
            Double.parseDouble(parts[1]),
            Double.parseDouble(parts[2]),
            Double.parseDouble(parts[3]),
          }
        );
      } else if (parts[0].equals("g")) {
        group = parts.length > 1 ? parts[1] : "";
      } else if (parts[0].equals("f")) {
        for (int i = 2; i < parts.length - 1; i++) {
          faces.add(
            new int[] {
              Integer.parseInt(parts[1].split("/")[0]) - 1,
              Integer.parseInt(parts[i].split("/")[0]) - 1,
              Integer.parseInt(parts[i + 1].split("/")[0]) - 1,
            }
          );
          groups.add(group);
        }
      }
    }
    return Map.of(
      "vertices",
      vertices,
      "faces",
      faces,
      "groups",
      groups,
      "warnings",
      export.warnings(),
      "coordinates",
      "OpenRocket DefaultCoordTransform, meters; y is longitudinal"
    );
  }

  static Export interchange(OpenRocketDocument d, String format)
    throws Exception {
    var w = new WarningSet();
    var e = new ErrorSet();
    var out = new ByteArrayOutputStream();
    var options = new StorageOptions();
    if (
      format.equals("rocksim")
    ) new info.openrocket.core.file.rocksim.export.RockSimSaver()
      .save(out, d, options, w, e);
    else if (
      format.equals("rasaero")
    ) new info.openrocket.core.file.rasaero.export.RASAeroSaver()
      .save(out, d, options, w, e);
    else throw new IllegalArgumentException("Unknown interchange format");
    var warnings = Engine.strings(w);
    warnings.addAll(Engine.strings(e));
    return new Export(out.toByteArray(), warnings);
  }

  static byte[] finSvg(OpenRocketDocument d, String id) throws Exception {
    var c = Engine.find(d.getRocket(), id);
    if (!(c instanceof FinSet f)) throw new IllegalArgumentException(
      "Select a planar fin set"
    );
    Path tmp = Files.createTempFile("fin-", ".svg");
    try {
      var svg = new info.openrocket.core.file.svg.export.SVGBuilder();
      svg.addPath(
        f.getFinPoints(),
        java.awt.Color.WHITE,
        java.awt.Color.BLACK,
        .1
      );
      svg.finalizeSVG();
      svg.writeToFile(tmp.toFile());
      return Files.readAllBytes(tmp);
    } finally {
      Files.deleteIfExists(tmp);
    }
  }
}

package rocket;

import com.fasterxml.jackson.databind.*;
import info.openrocket.core.aerodynamics.*;
import info.openrocket.core.document.*;
import info.openrocket.core.file.*;
import info.openrocket.core.file.openrocket.OpenRocketSaver;
import info.openrocket.core.logging.*;
import info.openrocket.core.masscalc.*;
import info.openrocket.core.material.Material;
import info.openrocket.core.motor.*;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.simulation.*;
import info.openrocket.core.startup.*;
import java.beans.*;
import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.zip.*;

/** Thin adapter. Every engineering quantity comes from the pinned core. */
public final class Engine {

  public static final String VERSION = "24.12", REVISION =
    "133b558de556f0282f51c3f53f3b3fc633b4310a";
  public static final Object LOCK = new Object();
  public static final Map<String, Class<? extends RocketComponent>> TYPES =
    new LinkedHashMap<>();

  static {
    for (Class<? extends RocketComponent> c : List.of(
      AxialStage.class,
      ParallelStage.class,
      PodSet.class,
      NoseCone.class,
      BodyTube.class,
      Transition.class,
      InnerTube.class,
      TubeCoupler.class,
      CenteringRing.class,
      Bulkhead.class,
      EngineBlock.class,
      LaunchLug.class,
      RailButton.class,
      MassComponent.class,
      Parachute.class,
      Streamer.class,
      ShockCord.class,
      TrapezoidFinSet.class,
      EllipticalFinSet.class,
      FreeformFinSet.class,
      TubeFinSet.class
    )) TYPES.put(c.getSimpleName(), c);
  }

  // Explicit property boundary: only these public scalar setters are exposed, never arbitrary reflection.
  static final Set<String> PROPERTIES = Set.of(
    "CD",
    "CDAutomatic",
    "CDOverridden",
    "CGOverridden",
    "aftRadius",
    "aftRadiusAutomatic",
    "aftShoulderCapped",
    "aftShoulderLength",
    "aftShoulderRadius",
    "aftShoulderThickness",
    "angleMethod",
    "angleOffset",
    "angleSeparation",
    "area",
    "aspectRatio",
    "axialMethod",
    "axialOffset",
    "baseHeight",
    "baseRadius",
    "baseRadiusAutomatic",
    "baseRotation",
    "cantAngle",
    "cantPivot",
    "clipped",
    "clusterConfiguration",
    "clusterRotation",
    "clusterScale",
    "clusterScaleAbsolute",
    "comment",
    "componentMass",
    "cordLength",
    "crossSection",
    "customReferenceLength",
    "density",
    "designer",
    "diameter",
    "displayOrder_back",
    "displayOrder_side",
    "filled",
    "filletRadius",
    "finCount",
    "finish",
    "flangeHeight",
    "flipped",
    "foreRadius",
    "foreRadiusAutomatic",
    "foreShoulderCapped",
    "foreShoulderLength",
    "foreShoulderRadius",
    "foreShoulderThickness",
    "height",
    "innerDiameter",
    "innerRadius",
    "innerRadiusAutomatic",
    "instanceCount",
    "instanceSeparation",
    "kitName",
    "length",
    "lineCount",
    "lineLength",
    "mass",
    "massOverridden",
    "motorMount",
    "motorOverhang",
    "name",
    "optimizationAppearance",
    "optimizationConstruction",
    "optimizationFlight",
    "outerDiameter",
    "outerRadius",
    "outerRadiusAutomatic",
    "overrideCD",
    "overrideCGX",
    "overrideMass",
    "packedLength",
    "packedRadius",
    "perfectFinish",
    "radialDirection",
    "radialPosition",
    "radius",
    "radiusAutomatic",
    "radiusMethod",
    "radiusOffset",
    "revision",
    "rootChord",
    "screwHeight",
    "shapeParameter",
    "shapeType",
    "shoulderCapped",
    "shoulderLength",
    "shoulderRadius",
    "shoulderThickness",
    "stageNumber",
    "stripLength",
    "stripWidth",
    "subcomponentsOverriddenCD",
    "subcomponentsOverriddenCG",
    "subcomponentsOverriddenMass",
    "sweep",
    "sweepAngle",
    "tabHeight",
    "tabLength",
    "tabOffset",
    "tabOffsetMethod",
    "thickness",
    "tipChord",
    "totalHeight"
  );
  static final Set<String> OPTIONS = Set.of(
    "launchRodLength",
    "launchRodAngle",
    "launchRodDirection",
    "launchIntoWind",
    "launchAltitude",
    "launchLatitude",
    "launchLongitude",
    "ISAAtmosphere",
    "launchTemperature",
    "launchPressure",
    "timeStep",
    "maxSimulationTime",
    "maximumStepAngle",
    "randomSeed",
    "geodeticComputation",
    "windModelType"
  );

  public static void initialize() {
    OpenRocketCore.initialize();
    ((info.openrocket.core.database.motor.ThrustCurveMotorSetDatabase) Application.getMotorSetDatabase()).getMotorSets();
  }

  static final Map<OpenRocketDocument, Map<String, byte[]>> ATTACHMENTS =
    Collections.synchronizedMap(new WeakHashMap<>());

  public record Loaded(OpenRocketDocument document, List<String> warnings) {}

  public static Loaded load(byte[] bytes) throws Exception {
    return load(bytes, null);
  }

  static Loaded load(byte[] bytes, Set<String> allowedMotors) throws Exception {
    Map<String, byte[]> attachments = new LinkedHashMap<>();
    byte[] xml = unpack(bytes, attachments);
    String text = new String(xml, java.nio.charset.StandardCharsets.UTF_8);
    if (
      text.toUpperCase(Locale.ROOT).contains("<!DOCTYPE") ||
      text.toUpperCase(Locale.ROOT).contains("<!ENTITY")
    ) throw new IllegalArgumentException("DTD and entities are not allowed");
    var f = javax.xml.parsers.DocumentBuilderFactory.newInstance();
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setFeature(
      "http://xml.org/sax/features/external-general-entities",
      false
    );
    f.setFeature(
      "http://xml.org/sax/features/external-parameter-entities",
      false
    );
    f.setXIncludeAware(false);
    f.setExpandEntityReferences(false);
    var parsed = f.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
    String format = parsed.getDocumentElement().getTagName();
    if (
      !Set.of("openrocket", "RockSimDocument", "RASAeroDocument").contains(
        format
      )
    ) throw new IllegalArgumentException(
      "Unsupported rocket document root: " + format
    );
    if (
      parsed.getElementsByTagName("extension").getLength() > 0 ||
      parsed.getElementsByTagName("listener").getLength() > 0
    ) throw new IllegalArgumentException(
      "Simulation extensions/listeners are not executable on this server; import rejected without changing the project"
    );
    var d = OpenRocketDocumentFactory.createEmptyRocket();
    var context = new DocumentLoadingContext();
    context.setOpenRocketDocument(d);
    var finder = new DatabaseMotorFinder();
    context.setMotorFinder(
      (type, manufacturer, designation, diameter, length, digest, warnings) -> {
        var selectionWarnings = allowedMotors == null
          ? warnings
          : new info.openrocket.core.logging.WarningSet();
        var motor = finder.findMotor(
          type,
          manufacturer,
          designation,
          diameter,
          length,
          digest,
          selectionWarnings
        );
        if (allowedMotors != null) {
          if (
            motor != null &&
            (!(motor instanceof ThrustCurveMotor curve) ||
              !allowedMotors.contains(curve.getDigest()))
          ) throw new IllegalArgumentException(
            "This import uses a motor unavailable in the public catalog. Use owner access or choose a bundled motor."
          );
          if (!selectionWarnings.isEmpty()) warnings.add(
            info.openrocket.core.logging.Warning.fromString(
              "Review motor selection in the imported design"
            )
          );
        }
        return motor;
      }
    );
    List<String> missing = new ArrayList<>();
    context.setAttachmentFactory(name -> {
      if (!attachments.containsKey(name)) missing.add(
        "Missing embedded attachment: " +
        name +
        "; no filesystem or network access attempted"
      );
      return new Attachment(name) {
        @Override
        public InputStream getBytes() throws IOException {
          byte[] data = attachments.get(name);
          if (data == null) throw new FileNotFoundException(
            "Missing embedded attachment: " + name
          );
          return new ByteArrayInputStream(data);
        }
      };
    });
    AbstractRocketLoader loader =
      switch (format) {
        case "openrocket" -> new info.openrocket.core.file.openrocket.importt.OpenRocketLoader();
        case "RockSimDocument" -> new info.openrocket.core.file.rocksim.importt.RockSimLoader();
        default -> new info.openrocket.core.file.rasaero.importt.RASAeroLoader();
      };
    loader.load(context, new ByteArrayInputStream(xml), "project.ork");
    d.getRocket().enableEvents();
    d.reloadDocumentMaterials();
    ATTACHMENTS.put(d, attachments);
    var metadata = java.util.regex.Pattern.compile(
      "<!-- RocketDesignerSeeds: ([0-9, -]*) -->"
    ).matcher(text);
    if (metadata.find()) {
      String[] seeds = metadata.group(1).split(",");
      if (
        seeds.length != d.getSimulationCount()
      ) throw new IllegalArgumentException("Invalid seed metadata");
      for (int i = 0; i < seeds.length; i++) d
        .getSimulation(i)
        .getOptions()
        .setRandomSeed(Integer.parseInt(seeds[i].trim()));
    }
    var warnings = strings(loader.getWarnings());
    warnings.addAll(missing);
    if (!format.equals("openrocket")) warnings.add(
      "Converted " +
      format +
      " using the pinned upstream reader. This interchange format cannot represent all OpenRocket settings; inspect before accepting conversion/export."
    );
    return new Loaded(d, warnings);
  }

  static byte[] unpack(byte[] b, Map<String, byte[]> attachments)
    throws IOException {
    if (b.length > 8 * 1024 * 1024) throw new IllegalArgumentException(
      "Import limit is 8 MiB"
    );
    if (b.length > 2 && b[0] == 'P' && b[1] == 'K') {
      byte[] xml = null;
      int total = 0;
      try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(b))) {
        ZipEntry e;
        int count = 0;
        Set<String> names = new HashSet<>();
        while ((e = z.getNextEntry()) != null) {
          if (++count > 128) throw new IOException("Too many ZIP entries");
          String name = e.getName();
          if (
            name.startsWith("/") ||
            name.contains("..") ||
            name.contains("\\") ||
            name.indexOf(0) >= 0 ||
            !names.add(name)
          ) throw new IllegalArgumentException("Unsafe/duplicate archive path");
          if (e.isDirectory()) continue;
          byte[] data = limited(z);
          total += data.length;
          if (total > 8 * 1024 * 1024) throw new IOException(
            "Total uncompressed archive exceeds 8 MiB"
          );
          if (name.equals("rocket.ork")) xml = data;
          else attachments.put(name, data);
        }
      }
      if (xml != null) return xml;
      throw new IllegalArgumentException("ZIP does not contain rocket.ork");
    }
    if (b.length > 2 && (b[0] & 255) == 31 && (b[1] & 255) == 139) try (
      var g = new GZIPInputStream(new ByteArrayInputStream(b))
    ) {
      return limited(g);
    }
    return b;
  }

  public static byte[] limited(InputStream in) throws IOException {
    byte[] b = in.readNBytes(8 * 1024 * 1024 + 1);
    if (b.length > 8 * 1024 * 1024) throw new IOException(
      "Uncompressed size exceeds 8 MiB"
    );
    return b;
  }

  public static byte[] save(OpenRocketDocument d) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    StorageOptions o = new StorageOptions();
    o.setSaveSimulationData(false);
    WarningSet w = new WarningSet();
    ErrorSet e = new ErrorSet();
    new OpenRocketSaver().save(out, d, o, w, e);
    if (!e.isEmpty()) throw new IOException(e.toString());
    String xml = out.toString(java.nio.charset.StandardCharsets.UTF_8);
    if (d.getSimulationCount() > 0) {
      String seeds = d
        .getSimulations()
        .stream()
        .map(sim -> Integer.toString(sim.getOptions().getRandomSeed()))
        .collect(java.util.stream.Collectors.joining(","));
      xml = xml.replaceFirst(
        "\\?>",
        "?>\n<!-- RocketDesignerSeeds: " + seeds + " -->"
      );
    }
    byte[] xmlBytes = xml.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    var assets = ATTACHMENTS.getOrDefault(d, Map.of());
    if (assets.isEmpty()) return xmlBytes;
    ByteArrayOutputStream zip = new ByteArrayOutputStream();
    try (var z = new ZipOutputStream(zip)) {
      ZipEntry main = new ZipEntry("rocket.ork");
      main.setTime(0);
      z.putNextEntry(main);
      z.write(xmlBytes);
      z.closeEntry();
      for (var a : assets.entrySet()) {
        ZipEntry entry = new ZipEntry(a.getKey());
        entry.setTime(0);
        z.putNextEntry(entry);
        z.write(a.getValue());
        z.closeEntry();
      }
    }
    return zip.toByteArray();
  }

  static List<String> strings(Iterable<?> values) {
    List<String> a = new ArrayList<>();
    for (Object v : values) a.add(v.toString());
    return a;
  }

  public static RocketComponent find(Rocket r, String id) {
    for (RocketComponent c : r) if (c.getID().toString().equals(id)) return c;
    throw new IllegalArgumentException("Component not found: " + id);
  }

  public static List<Map<String, Object>> properties(
    Object o,
    Set<String> allowed
  ) throws Exception {
    List<Map<String, Object>> result = new ArrayList<>();
    for (PropertyDescriptor p : Introspector.getBeanInfo(
      o.getClass()
    ).getPropertyDescriptors()) {
      if (
        !allowed.contains(p.getName()) ||
        p.getReadMethod() == null ||
        p.getWriteMethod() == null
      ) continue;
      Class<?> t = p.getPropertyType();
      if (
        !(t == double.class ||
          t == int.class ||
          t == boolean.class ||
          t == String.class ||
          t.isEnum())
      ) continue;
      Object v = p.getReadMethod().invoke(o);
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("key", p.getName());
      m.put("value", v instanceof Enum<?> en ? en.name() : v);
      m.put(
        "type",
        t.isEnum()
          ? "enum"
          : t == boolean.class
            ? "boolean"
            : t == String.class ? "string" : "number"
      );
      m.put("unit", unit(p.getName()));
      if (t.isEnum()) m.put(
        "choices",
        Arrays.stream(t.getEnumConstants())
          .map(x -> ((Enum<?>) x).name())
          .toList()
      );
      result.add(m);
    }
    return result;
  }

  static String unit(String p) {
    if (p.equals("launchLatitude") || p.equals("launchLongitude")) return "°";
    String k = p.toLowerCase(Locale.ROOT);
    if (k.contains("mass")) return "kg";
    if (
      k.contains("angle") ||
      k.contains("cant") ||
      k.contains("direction") ||
      k.contains("latitude") ||
      k.contains("longitude") ||
      k.contains("rotation")
    ) return "rad";
    if (k.contains("density")) return "kg/m³";
    if (k.contains("time") || k.contains("delay")) return "s";
    if (k.contains("pressure")) return "Pa";
    if (k.contains("temperature")) return "K";
    if (
      k.contains("length") ||
      k.contains("radius") ||
      k.contains("chord") ||
      k.contains("height") ||
      k.contains("width") ||
      k.contains("thickness") ||
      k.contains("offset") ||
      k.contains("position") ||
      k.contains("sweep") ||
      k.contains("altitude") ||
      k.equals("overridecgx") ||
      k.contains("diameter") ||
      k.contains("separation")
    ) return "m";
    return "";
  }

  @SuppressWarnings({ "unchecked", "rawtypes" })
  public static void set(Object o, String key, JsonNode v, Set<String> allowed)
    throws Exception {
    if (!allowed.contains(key)) throw new IllegalArgumentException(
      "Unsupported property: " + key
    );
    for (PropertyDescriptor p : Introspector.getBeanInfo(
      o.getClass()
    ).getPropertyDescriptors()) if (
      p.getName().equals(key) && p.getWriteMethod() != null
    ) {
      Class<?> t = p.getPropertyType();
      Object value;
      if (t == double.class) {
        if (!v.isNumber()) throw new IllegalArgumentException(
          "Number required"
        );
        double n = v.asDouble(Double.NaN);
        if (!Double.isFinite(n)) throw new IllegalArgumentException(
          "Finite number required"
        );
        if (
          unit(key).equals("m") &&
          !key.toLowerCase().contains("offset") &&
          !key.equals("sweep") &&
          !key.equals("overrideCGX") &&
          n < 0
        ) throw new IllegalArgumentException("Dimension must be nonnegative");
        value = n;
      } else if (t == int.class) {
        if (
          !v.isIntegralNumber() || !v.canConvertToInt()
        ) throw new IllegalArgumentException("Integer required");
        value = v.intValue();
      } else if (t == boolean.class) {
        if (!v.isBoolean()) throw new IllegalArgumentException(
          "Boolean required"
        );
        value = v.booleanValue();
      } else if (t == String.class) {
        if (
          !v.isTextual() || v.asText().length() > 10000
        ) throw new IllegalArgumentException(
          "Text required (max 10000 characters)"
        );
        value = v.asText();
      } else if (t.isEnum()) value = Enum.valueOf((Class<Enum>) t, v.asText());
      else throw new IllegalArgumentException("Unsupported property type");
      try {
        p.getWriteMethod().invoke(o, value);
      } catch (InvocationTargetException e) {
        throw new IllegalArgumentException(e.getCause().getMessage());
      }
      return;
    }
    throw new IllegalArgumentException(
      "Property is not editable on this component: " + key
    );
  }

  public static Map<String, Object> component(RocketComponent c)
    throws Exception {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", c.getID().toString());
    m.put("name", c.getName());
    m.put("type", c.getClass().getSimpleName());
    m.put(
      "parentId",
      c.getParent() == null ? null : c.getParent().getID().toString()
    );
    m.put("length", c.getLength());
    m.put("mass", finite(c.getMass()));
    m.put("properties", properties(c, PROPERTIES));
    m.put(
      "locations",
      Arrays.stream(c.getComponentLocations())
        .map(x -> List.of(x.x, x.y, x.z))
        .toList()
    );
    Map<String, Object> shape = new LinkedHashMap<>();
    for (String k : List.of(
      "outerRadius",
      "baseRadius",
      "foreRadius",
      "aftRadius",
      "height",
      "rootChord",
      "tipChord",
      "sweep",
      "finCount"
    )) {
      try {
        shape.put(
          k,
          c
            .getClass()
            .getMethod(
              "get" + Character.toUpperCase(k.charAt(0)) + k.substring(1)
            )
            .invoke(c)
        );
      } catch (ReflectiveOperationException ignored) {}
    }
    if (c instanceof FreeformFinSet f) m.put(
      "finPoints",
      Arrays.stream(f.getFinPoints()).map(x -> List.of(x.x, x.y)).toList()
    );
    if (c instanceof RecoveryDevice rec) m.put(
      "deployment",
      properties(
        rec
          .getDeploymentConfigurations()
          .get(c.getRocket().getSelectedConfiguration().getId()),
        Set.of("deployEvent", "deployDelay", "deployAltitude")
      )
    );
    if (c instanceof AxialStage stage) m.put(
      "separation",
      properties(
        stage
          .getSeparationConfigurations()
          .get(c.getRocket().getSelectedConfiguration().getId()),
        Set.of("separationEvent", "separationDelay", "separationAltitude")
      )
    );
    if (c instanceof MotorMount mm) {
      var mc = mm.getMotorConfig(
        c.getRocket().getSelectedConfiguration().getId()
      );
      m.put(
        "motorConfiguration",
        properties(
          mc,
          Set.of("ejectionDelay", "ignitionDelay", "ignitionEvent")
        )
      );
    }
    if (c instanceof InnerTube t) m.put(
      "cluster",
      Map.of(
        "pattern",
        t.getClusterConfiguration().getXMLName(),
        "choices",
        Arrays.stream(ClusterConfiguration.CONFIGURATIONS)
          .map(ClusterConfiguration::getXMLName)
          .toList()
      )
    );
    if (c instanceof AxialStage stage) m.put(
      "stageEnabled",
      c
        .getRocket()
        .getSelectedConfiguration()
        .isStageActive(stage.getStageNumber())
    );
    m.put("shape", shape);
    m.put(
      "compatibleTypes",
      TYPES.entrySet()
        .stream()
        .filter(x -> c.isCompatible(x.getValue()))
        .map(Map.Entry::getKey)
        .toList()
    );
    try {
      Material mat = (Material) c.getClass().getMethod("getMaterial").invoke(c);
      m.put(
        "material",
        Map.of(
          "name",
          mat.getName(),
          "density",
          mat.getDensity(),
          "type",
          mat.getType().name()
        )
      );
    } catch (NoSuchMethodException ignored) {}
    if (c.getAppearance() != null) {
      var a = c.getAppearance();
      m.put(
        "appearance",
        Map.of(
          "color",
          String.format(
            "#%02x%02x%02x",
            a.getPaint().getRed(),
            a.getPaint().getGreen(),
            a.getPaint().getBlue()
          ),
          "shine",
          a.getShine(),
          "hasTexture",
          a.getTexture() != null
        )
      );
    }
    m.put(
      "presetType",
      c.getPresetType() == null ? null : c.getPresetType().name()
    );
    List<Map<String, Object>> children = new ArrayList<>();
    for (RocketComponent ch : c.getChildren()) children.add(component(ch));
    m.put("children", children);
    return m;
  }

  public static Map<String, Object> inspect(OpenRocketDocument d)
    throws Exception {
    return inspect(d, null);
  }

  public static Map<String, Object> inspect(
    OpenRocketDocument d,
    FlightConfigurationId configId
  ) throws Exception {
    Rocket r = d.getRocket();
    var cfg = configId == null
      ? r.getSelectedConfiguration()
      : r.getFlightConfiguration(configId);
    // Some upstream geometry getters update lazy auto-radius state. Measure the engineering model
    // before collecting drawing/editor metadata, and never inspect a job's live simulation document.
    var dry = MassCalculator.calculateStructure(cfg);
    var loaded = MassCalculator.calculateLaunch(cfg);
    WarningSet w = new WarningSet();
    var calc = new BarrowmanCalculator();
    CoordinateHolder holder = cp(calc, cfg, w);
    calc.checkGeometry(cfg, r, w);
    Map<String, Object> out = new LinkedHashMap<>();
    var drawing = r.copyWithOriginalID();
    if (configId != null) drawing.setSelectedConfiguration(configId);
    out.put("rocket", component(drawing));
    out.put("name", r.getName());
    out.put(
      "quantities",
      nullableMap(
        "dryMass",
        finite(dry.getMass()),
        "loadedMass",
        finite(loaded.getMass()),
        "dryCG",
        finite(dry.getCM().x),
        "loadedCG",
        finite(loaded.getCM().x),
        "cp",
        holder.x,
        "length",
        cfg.getLength(),
        "referenceDiameter",
        cfg.getReferenceLength(),
        "stability",
        stability(d, configId)
      )
    );
    out.put("warnings", strings(w));
    out.put("hasMotors", cfg.hasMotors());
    out.put(
      "selectedConfigurationId",
      cfg.getFlightConfigurationID().key.toString()
    );
    List<Object> configs = new ArrayList<>();
    for (int i = 0; i < r.getFlightConfigurationCount(); i++) {
      var f = r.getFlightConfigurationByIndex(i);
      configs.add(Map.of("id", f.getId().key.toString(), "name", f.getName()));
    }
    out.put("configurations", configs);
    List<Object> sims = new ArrayList<>();
    for (Simulation s : d.getSimulations()) {
      Map<String, Object> a = new LinkedHashMap<>();
      a.put("name", s.getName());
      a.put("configurationId", s.getFlightConfigurationId().key.toString());
      a.put("options", properties(s.getOptions(), OPTIONS));
      a.put(
        "windLevels",
        s
          .getOptions()
          .getMultiLevelWindModel()
          .getLevels()
          .stream()
          .map(l ->
            Map.of(
              "altitude",
              l.getAltitude(),
              "speed",
              l.getSpeed(),
              "direction",
              l.getDirection(),
              "standardDeviation",
              l.getStandardDeviation()
            )
          )
          .toList()
      );
      a.put(
        "windAltitudeReference",
        s.getOptions().getMultiLevelWindModel().getAltitudeReference().name()
      );
      a.put(
        "wind",
        Map.of(
          "average",
          s.getOptions().getAverageWindModel().getAverage(),
          "standardDeviation",
          s.getOptions().getAverageWindModel().getStandardDeviation(),
          "direction",
          s.getOptions().getAverageWindModel().getDirection()
        )
      );
      sims.add(a);
    }
    out.put("simulations", sims);
    out.put(
      "expressions",
      d
        .getCustomExpressions()
        .stream()
        .map(e ->
          Map.of(
            "name",
            e.getName(),
            "symbol",
            e.getSymbol(),
            "unit",
            e.getUnit(),
            "expression",
            e.getExpressionString()
          )
        )
        .toList()
    );
    List<Object> mounts = new ArrayList<>();
    for (RocketComponent c : r) if (
      c instanceof MotorMount mm && mm.isMotorMount()
    ) {
      var mc = mm.getMotorConfig(cfg.getId());
      Map<String, Object> a = new LinkedHashMap<>();
      a.put("id", c.getID().toString());
      a.put("name", c.getName());
      a.put(
        "motor",
        mc.getMotor() == null ? null : mc.getMotor().getDesignation()
      );
      a.put("delay", finite(mc.getEjectionDelay()));
      mounts.add(a);
    }
    out.put("mounts", mounts);
    return out;
  }

  static Object stability(OpenRocketDocument d, FlightConfigurationId id) {
    try {
      var r = load(save(d)).document().getRocket();
      var sim = new Simulation(r);
      sim.setFlightConfigurationId(
        id == null ? d.getRocket().getSelectedConfiguration().getId() : id
      );
      return finite(
        new info.openrocket.core.optimization.rocketoptimization.parameters.StabilityParameter(
          false
        ).computeValue(sim)
      );
    } catch (Exception ex) {
      return null;
    }
  }

  static Map<String, Object> nullableMap(Object... pairs) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) m.put(
      (String) pairs[i],
      pairs[i + 1]
    );
    return m;
  }

  record CoordinateHolder(Object x) {}

  static CoordinateHolder cp(
    BarrowmanCalculator calc,
    FlightConfiguration cfg,
    WarningSet w
  ) {
    try {
      var fc = new FlightConditions(cfg);
      fc.setMach(0.3);
      var c = calc.getCP(cfg, fc, w);
      return new CoordinateHolder(c.weight > 0 ? finite(c.x) : null);
    } catch (Exception e) {
      return new CoordinateHolder(null);
    }
  }

  static Object finite(double x) {
    return Double.isFinite(x) ? x : null;
  }

  public static Map<String, Object> motor(ThrustCurveMotor m, boolean curve) {
    Map<String, Object> a = new LinkedHashMap<>();
    a.put("id", m.getDigest());
    a.put("designation", m.getDesignation());
    a.put("manufacturer", m.getManufacturer().getDisplayName());
    a.put("diameter", m.getDiameter());
    a.put("length", m.getLength());
    a.put("impulse", m.getTotalImpulseEstimate());
    a.put("launchMass", m.getLaunchMass());
    a.put("burnTime", m.getBurnTimeEstimate());
    a.put(
      "delays",
      Arrays.stream(m.getStandardDelays()).mapToObj(Engine::finite).toList()
    );
    a.put(
      "source",
      MotorImports.SOURCES.getOrDefault(
        m.getDigest(),
        "OpenRocket 24.12 bundled thrustcurves.ser"
      )
    );
    a.put("description", m.getDescription());
    if (curve) {
      a.put("time", m.getTimePoints());
      a.put("thrust", m.getThrustPoints());
    }
    return a;
  }

  public static List<ThrustCurveMotor> motors() {
    return (
      (info.openrocket.core.database.motor.ThrustCurveMotorSetDatabase) Application.getMotorSetDatabase()
    ).getMotorSets()
      .stream()
      .flatMap(x -> x.getMotors().stream())
      .toList();
  }
}

# Pinned component API inventory

Source commit `133b558de556f0282f51c3f53f3b3fc633b4310a`. This audit includes all concrete component classes found in the pinned package, including the source-only Sleeve class. Sleeve is excluded from the browser palette: the pinned DocumentConfig reader has no sleeve constructor, so a native .ork round trip cannot restore it. Inherited scalar setters are exposed only if present in Engine.PROPERTIES; other APIs below remain required integration work. A listed setter is an upstream capability, not a verified web feature.

| Class | Declared public setters (inherited APIs also apply) | Browser status |
|---|---|---|
| Rocket | `setDesigner(String s)`; `setDesignType(DesignType type)`; `setKitName(String s)`; `setOptimizationFlight(boolean b)`; `setOptimizationAppearance(boolean b)`; `setOptimizationConstruction(boolean b)`; `setRevision(String s)`; `setDocument(OpenRocketDocument document)`; `setAxialMethod(final AxialMethod newAxialMethod)`; `setAxialOffset(final double requestOffset)`; `setReferenceType(ReferenceType type)`; `setCustomReferenceLength(double length)`; `setPerfectFinish(boolean perfectFinish)`; `setSelectedConfiguration(final FlightConfigurationId selectId)`; `setFlightConfiguration(final FlightConfigurationId fcid, FlightConfiguration newConfig)` | in progress |
| AxialStage | `setStageNumber(final int newStageNumber)` | in progress |
| ParallelStage | `setInstanceCount(final int newCount)`; `setAxialMethod(final AxialMethod _newPosition)`; `setRadiusOffset(final double radius_m)`; `setAngleOffset(final double angle_rad)`; `setRadius(RadiusMethod requestedMethod, double requestedRadius)`; `setAngleMethod(AngleMethod newAngleMethod)`; `setRadiusMethod(RadiusMethod newMethod)` | in progress |
| PodSet | `setAxialMethod(final AxialMethod newMethod)`; `setInstanceCount(int newCount)`; `setAngleOffset(double angle_rad)`; `setAngleMethod(final AngleMethod newMethod)`; `setRadiusOffset(double radius_m)`; `setRadiusMethod(RadiusMethod newMethod)`; `setRadius(RadiusMethod requestMethod, double requestRadius)` | in progress |
| NoseCone | `setBaseRadius(double radius)`; `setBaseRadiusAutomatic(boolean auto)`; `setShoulderLength(double length)`; `setShoulderRadius(double radius, boolean doClamping)`; `setShoulderRadius(double radius)`; `setShoulderThickness(double thickness)`; `setShoulderCapped(boolean capped)`; `setFlipped(boolean flipped, boolean sanityCheck)`; `setFlipped(boolean flipped)`; `setClipped(boolean b)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| BodyTube | `setOuterRadius(double radius)`; `setOuterRadiusAutomatic(boolean auto)`; `setInnerRadius(double r)`; `setMotorConfig(MotorConfiguration newMotorConfig, FlightConfigurationId fcid)`; `setMotorMount(boolean _active)`; `setMotorOverhang(double overhang)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| Transition | `setLength(double length)`; `setForeRadius(double radius, boolean doClamping)`; `setForeRadius(double radius)`; `setForeRadiusAutomatic(boolean auto, boolean sanityCheck)`; `setForeRadiusAutomatic(boolean auto)`; `setAftRadius(double radius, boolean doClamping)`; `setAftRadius(double radius)`; `setAftRadiusAutomatic(boolean auto, boolean sanityCheck)`; `setAftRadiusAutomatic(boolean auto)`; `setShapeType(Shape type)`; `setShapeParameter(double n)`; `setClipped(boolean c)`; `setForeShoulderRadius(double foreShoulderRadius, boolean doClamping)`; `setForeShoulderRadius(double foreShoulderRadius)`; `setForeShoulderThickness(double foreShoulderThickness)`; `setForeShoulderLength(double foreShoulderLength)`; `setForeShoulderCapped(boolean capped)`; `setAftShoulderRadius(double aftShoulderRadius, boolean doClamping)`; `setAftShoulderRadius(double aftShoulderRadius)`; `setAftShoulderThickness(double aftShoulderThickness)`; `setAftShoulderLength(double aftShoulderLength)`; `setAftShoulderCapped(boolean capped)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| InnerTube | `setClusterConfiguration(final ClusterConfiguration cluster)`; `setInstanceCount(final int newCount)`; `setClusterScale(double scale)`; `setClusterScaleAbsolute(double scale)`; `setClusterRotation(double rotation)`; `setMotorConfig(final MotorConfiguration newMotorConfig, final FlightConfigurationId fcid)`; `setMotorMount(boolean _active)`; `setMotorOverhang(double overhang)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| TubeCoupler | `setOuterRadiusAutomatic(boolean auto)` | in progress |
| CenteringRing | `setOuterRadiusAutomatic(boolean auto)`; `setInnerRadiusAutomatic(boolean auto)` | in progress |
| Bulkhead | `setInnerRadius(double r)`; `setOuterRadiusAutomatic(boolean auto)` | in progress |
| EngineBlock | `setOuterRadiusAutomatic(boolean auto)` | in progress |
| LaunchLug | `setOuterRadius(double radius)`; `setInnerRadius(double innerRadius)`; `setThickness(double thickness)`; `setAngleOffset(double newAngleRadians)`; `setLength(double length)`; `setInstanceSeparation(final double _separation)`; `setInstanceCount(final int newCount)`; `setAngleMethod(AngleMethod newMethod)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| RailButton | `setBaseHeight(double newBaseHeight)`; `setFlangeHeight(double newFlangeHeight)`; `setTotalHeight(double newHeight)`; `setScrewHeight(double height)`; `setInnerDiameter(double newID)`; `setOuterDiameter(double newOD)`; `setAngleMethod(AngleMethod newMethod)`; `setAngleOffset(double angle_rad)`; `setAxialMethod(AxialMethod position)`; `setInstanceSeparation(double _separation)`; `setInstanceCount(int newCount)` | in progress |
| MassComponent | `setComponentMass(double mass)`; `setDensity(double density)`; `setMassComponentType(MassComponent.MassComponentType compType)` | in progress |
| Parachute | `setDiameter(double d)`; `setArea(double area)`; `setLineCount(int n)`; `setLineLength(double length)`; `setLineMaterial(Material mat)` | in progress |
| Streamer | `setStripLength(double stripLength)`; `setStripWidth(double stripWidth)`; `setAspectRatio(double ratio)`; `setArea(double area)` | in progress |
| ShockCord | `setMaterial(Material m)`; `setCordLength(double length)` | in progress |
| TrapezoidFinSet | `setFinShape(double rootChord, double tipChord, double sweep, double height, double thickness)`; `setRootChord(double r)`; `setTipChord(double r)`; `setSweep(double r)`; `setSweepAngle(double r)`; `setHeight(double r)` | in progress |
| EllipticalFinSet | `setHeight(double height)`; `setLength(double length)` | in progress |
| FreeformFinSet | `setPoints(Coordinate[] newPoints)`; `setPoints(Coordinate[] newPoints, boolean validateFinTab)`; `setPoints(ArrayList<Coordinate> newPoints)`; `setPoints(ArrayList<Coordinate> newPoints, boolean validateFinTab)`; `setPoint(final int index, final double xRequest, final double yRequest)` | in progress |
| TubeFinSet | `setLength(double length)`; `setOuterRadius(double radius)`; `setOuterRadiusAutomatic(boolean auto)`; `setInnerRadius(double r)`; `setThickness(double thickness)`; `setFinCount(int n)`; `setBaseRotation(double r)`; `setAxialMethod(AxialMethod position)`; `setInstanceCount(int newCount)`; `setRadius(RadiusMethod method, double radius)`; `setAngleOffset(double angleRadians)`; `setAngleMethod(AngleMethod newAngleMethod)`; `setRadiusOffset(double radius)`; `setRadiusMethod(RadiusMethod method)`; `setInsideColorComponentHandler(InsideColorComponentHandler handler)` | in progress |
| Sleeve (source-only; native reader unsupported) | `setOuterRadius(double r)`; `setInnerRadius(double r)`; `setThickness(double t)`; `setInnerRadiusAutomatic(boolean auto)` | in progress |

## Common inherited families

### RocketComponent

`setAppearance(Appearance appearance)`, `setColor(ORColor c)`, `setLineStyle(LineStyle style)`, `setOverrideMass(double m)`, `setMassOverridden(boolean o)`, `setOverrideCGX(double x)`, `setCGOverridden(boolean o)`, `setOverrideCD(double x)`, `setCDOverridden(boolean o)`, `setSubcomponentsOverridden(boolean override)`, `setSubcomponentsOverriddenMass(boolean override)`, `setSubcomponentsOverriddenCG(boolean override)`, `setSubcomponentsOverriddenCD(boolean override)`, `setInstanceCount(int count)`, `setName(String name)`, `setComment(String comment)`, `setIgnorePresetClearing(boolean ignorePresetClearing)`, `setID(UUID newID)`, `setID(String newID)`, `setAxialMethod(final AxialMethod newAxialMethod)`, `setAxialOffset(double newOffset)`, `setBypassChangeEvent(boolean newValue)`, `setVisible(boolean value)`, `setDisplayOrder_side(int displayOrder_side)`, `setDisplayOrder_back(int displayOrder_back)`

### ExternalComponent

`setMaterial(Material mat)`, `setFinish(Finish finish)`

### StructuralComponent

`setMaterial(Material mat)`

### SymmetricComponent

`setThickness(double thickness, boolean doClamping)`, `setThickness(double thickness)`, `setFilled(boolean filled)`

### BodyComponent

`setLength(double length)`

### FinSet

`setOverrideMass()`, `setFinCount(int n)`, `setBaseRotation(double r)`, `setCantAngle(final double newCantRadians)`, `setThickness(double r)`, `setCrossSection(CrossSection cs)`, `setTabHeight(final double newTabHeight)`, `setTabHeight(double newTabHeight, boolean validateTabHeight)`, `setTabLength(final double lengthRequest)`, `setTabLength(final double lengthRequest, boolean updateTabPosition)`, `setTabOffset(final double offsetRequest)`, `setTabOffsetMethod(final AxialMethod newPositionMethod)`, `setAngleOffset(final double angleRadians)`, `setAngleMethod(AngleMethod newAngleMethod)`, `setRadiusMethod(RadiusMethod newRadiusMethod)`, `setRadius(final RadiusMethod newMethod, final double newRadius_m)`, `setRadiusOffset(double radius)`, `setInstanceCount(int newCount)`, `setFilletMaterial(Material mat)`, `setFilletRadius(double r)`, `setInsideColorComponentHandler(InsideColorComponentHandler handler)`

### Tube



### RingComponent

`setLength(double length)`, `setRadialDirection(double dir)`, `setRadialPosition(double pos)`, `setRadialShift(double y, double z)`

### RadiusRingComponent

`setOuterRadius(double r)`, `setInnerRadius(double r)`, `setThickness(double thickness)`, `setInstanceSeparation(final double _separation)`, `setInstanceCount(final int newCount)`

### ThicknessRingComponent

`setOuterRadius(double r)`, `setThickness(double thickness)`, `setInnerRadius(double r)`

### MassObject

`setLength(double length)`, `setRadius(double radius)`, `setRadiusAutomatic(boolean auto)`, `setRadialPosition(double radialPosition)`, `setRadialDirection(double radialDirection)`

### RecoveryDevice

`setCD(double cd)`, `setCDAutomatic(boolean auto)`, `setMaterial(Material mat)`

### ComponentAssembly

`setAxialOffset(final double _pos)`, `setAxialMethod(final AxialMethod newMethod)`

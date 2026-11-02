package rocket;

import static org.junit.jupiter.api.Assertions.*;

import java.util.stream.*;
import org.junit.jupiter.api.*;

class ComponentInventoryTest {

  @BeforeAll
  static void init() {
    Engine.initialize();
  }

  @TestFactory
  Stream<DynamicTest> everyNativeComponentFamilyPersistsWithIdentity() {
    return Engine.TYPES.entrySet()
      .stream()
      .map(entry ->
        DynamicTest.dynamicTest(entry.getKey(), () -> {
          var d = EngineTest.fixture("simple");
          var r = d.getRocket();
          var parent = StreamSupport.stream(r.spliterator(), false)
            .filter(c -> c.isCompatible(entry.getValue()))
            .findFirst()
            .orElseThrow(() ->
              new AssertionError("No compatible parent for " + entry.getKey())
            );
          var c = entry.getValue().getDeclaredConstructor().newInstance();
          parent.addChild(c);
          c.setName("Inventory " + entry.getKey());
          c.setComment("Round-trip inventory fixture");
          String id = c.getID().toString();
          var loaded = Engine.load(Engine.save(d));
          assertTrue(
            loaded.warnings().isEmpty(),
            entry.getKey() + " import warnings " + loaded.warnings()
          );
          var actual = Engine.find(loaded.document().getRocket(), id);
          assertEquals(c.getClass(), actual.getClass());
          assertEquals(c.getName(), actual.getName());
          assertEquals(c.getComment(), actual.getComment());
          assertEquals(parent.getID(), actual.getParent().getID());
          assertFalse(Engine.properties(actual, Engine.PROPERTIES).isEmpty());
        })
      );
  }
}

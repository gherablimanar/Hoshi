# Using the docked editor

The first-visit walkthrough explains the purpose of the application and its main panels. Replay it from the launcher's **Quick start guide**, or the editor's **Help / walkthrough**. The latter also opens a searchable glossary of component and flight settings. Hover property labels for short descriptions.

## Choose a project first

Connect the hosted engine when prompted, then choose a blank design, an upstream OpenRocket example or an imported file. Opening the launcher alone creates no project. A blank design starts with one real AxialStage; choosing an example creates an independent project. **New** and **Open / Import** return to the launcher. **Recent projects** puts the last opened project first.

The launcher's project list can scroll within its window. Projects remain on the engine server subject to that host's storage lifetime. Export `.ork` copies, especially on free ephemeral hosting.

## Assemble and edit

Select a part in the hierarchy or side scene. The single **Add Component** button below the hierarchy searches friendly part names, groups them by purpose, finds compatible parents using the engine's compatibility metadata, and lets you confirm the attachment. It prefers the selected part or a compatible ancestor, then a compatible body tube. If no suitable parent exists, the part is disabled with an explanation. A new physical part is selected, labelled in the scene and fitted into view automatically. Stages and pods are explicitly labelled as assembly containers; empty containers have no solid shape or material. The picker starts with Airframe parts to make the first physical components easy to find.

Edit dimensions and press Enter or leave the field to apply a revision. Normal dimensions show mm, masses g and angles degrees. The Inspector groups available physical fields into **Dimensions & shape**, **Automatic sizing**, **Position & attachment**, **Shoulders & fin tabs**, **Mass & balance**, **Surface & aerodynamics**, and **Motor mount & cluster spacing**. Its search opens matching groups. Diameter fields use native diameter setters where available or convert exactly to the corresponding native radius. Set motor assignments and recovery using the relevant Inspector controls. Blank designs still require a compatible motor and flight settings before simulation.

## Move parts with the mouse

Drag a physical part left/right in the side scene. Nose cones, body tubes and transitions snap into the native airframe assembly order when you drag past a neighbouring part's centre. Fins and internal components change their native axial offset. Attached children preview the parent movement. The preview is temporary: release saves one guarded mutation; Escape or pointer cancellation discards it. Hold Shift for 1 mm drag increments. Clicks alone create no revision. Undo/Redo and exports use actual engine state.

In the hierarchy, drag to a row's top or bottom edge to reorder siblings. Drop onto the centre of a compatible parent to reattach a part. A line marks the insertion boundary; an outline marks a parent target. Root movement, incompatible parents and ancestor cycles are rejected. Manual Inspector placement remains available for fins/internal parts, and hierarchy arrow controls remain available for reordering. Exterior airframe axial reference/offset fields are read-only because native save/load resolves their placement from assembly order.

New body tubes use a fixed positive radius matched to existing airframe geometry or 25 mm, with a wall thickness up to 2 mm. This avoids the pinned core's automatic-radius case that can produce zero-diameter tubes when bodies are added before a nose. A newly added nose is placed first in its assembly. Existing zero-diameter tubes are not silently changed: select one and use **Use 50 mm tube dimensions**, or enter your measured diameter. This repair is undoable. Compound new-part setup is grouped into one Undo action.

The footer identifies this interface as **Hoshi Editor 0.4**. Older screenshots with Design tree / Components and Rear / 3D belong to an earlier deployment.

## Materials

**Material & density** offers 81 exact default material records copied from the pinned OpenRocket 24.12 `Databases.java`, with type-specific bulk (kg/m³), surface (kg/m²) and line (kg/m) densities. The source commit and upstream source URL are recorded in `frontend/src/materials.ts`. Only materials of the selected component’s native material type are offered. You can also enter a custom name and positive measured density, then **Apply material**. The existing backend persists a document material and computes mass/inertia; no new server endpoint is needed. Library values are density defaults, not structural strength or thermal ratings.

## One editor window

Hierarchy, scene and inspector share the upper workspace. Flight results are shown only in the separate **Flight Simulation** workspace. Drag a divider to resize a panel; focused dividers also accept arrow keys. Each panel owns its scrolling, so the browser document stays within the viewport. Narrow screens use **Scene / Hierarchy / Inspector** tabs.

The editor now provides only the side schematic, with selection outlines, names, pan, zoom and Fit. Rear and 3D editor controls were removed at the user’s request. Backend mesh/OBJ exports remain available through engineering exports. CG is the loaded balance point; CP and static margin are references at the displayed conditions. They do not guarantee flight success.

Keyboard shortcuts, outside form fields and dialogs:

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + Z | Undo |
| Shift + Ctrl/Cmd + Z, or Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + D | Duplicate the selected part |
| Delete / Backspace | Remove the selected part |
| Shift + Ctrl/Cmd + A | Open Add Component |
| F | Fit the side view |

## Simulate and inspect

Use **Validate design**, then **Flight settings** to check geometry, motor configurations, recovery, atmosphere and wind. Choose a simulation and use **Simulate launch**. The Flight Simulation view shows actual job results, plots, variables, events, comparisons, recorded playback and provenance. Earlier runs retain their original revisions. **Tools** contains advanced analysis/optimization, expressions and additional exports. No browser physics replaces the OpenRocket core.

## Controls removed or hidden

| Control | Reason / current behaviour |
| --- | --- |
| Unconfigured AI assistant | Hidden unless health metadata reports AI configured. Configured providers retain their existing explicit proposal/acceptance workflow. |
| Paint and shine inputs | Removed from the Inspector because the current renderers do not display those mutations. Existing imported appearance data and server APIs are retained. Physical surface finish remains available. |
| Arbitrary reflected metadata | The Inspector shows the main geometry fields and an explicit set of physical advanced fields, rather than presenting internal/cosmetic metadata as useful design controls. |
| Rear and 3D editor views | Removed from the editor. Side schematic controls remain; engineering OBJ export and server APIs are retained. |
| Competing Add Component entry points | The Components tab, scene-header button and empty-canvas button were removed. The hierarchy has the single Add Component button. |
| Print workspace / PDF | Removed because browser printing does not provide a verified export of the docked editor. Engineering file/data exports remain available. |
| Light/dark toggle | Replaced by the requested consistent dark editor. |
| Examples dialog inside the editor | Replaced by the project launcher, so the starting point is chosen before editing. |

This is a usability change, not an expansion of engineering parity. See the existing parity matrix for specialized component, rendering, interchange and simulation limitations. The UI build, eleven real-engine editor browser journeys and two protected Pages browser journeys validate the changed flow. Their JSON reports and screenshots live in `tests/`.

## Design and Flight Simulation

Editor 0.4 removes the large component-name labels from the scene while retaining selection outlines. Design workspace gives the freed height to the hierarchy, scene and Inspector; the Inspector has section shortcuts and a wider default panel. Flight Simulation owns the launch checklist and results. A missing motor, missing simulation or configuration mismatch leads to an explicit setup action instead of an invalid job. Assign a real motor, continue to flight setup, create a simulation using that configuration, then run it. Existing examples initially select a simulation matching the active drawing configuration. A different simulation configuration must be inspected or explicitly relinked. Native errors are retained; failed runs do not present zero-valued summaries as successful metrics.

The launcher includes **First time designing a rocket**, a ten-chapter tutorial on airframe, materials/mass, stability, motor fit and assignment, recovery, simulation configurations, launch conditions, results and physical preparation. It can open the real simple example for practice.

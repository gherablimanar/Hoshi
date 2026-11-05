# Using the docked editor

The first-visit walkthrough explains the purpose of the application and its main panels. Replay it from the launcher's **Quick start guide**, or the editor's **Help / walkthrough**. The latter also opens a searchable glossary of component and flight settings. Hover property labels for short descriptions.

## Choose a project first

Connect the hosted engine when prompted, then choose a blank design, an upstream OpenRocket example or an imported file. Opening the launcher alone creates no project. A blank design starts with one real AxialStage; choosing an example creates an independent project. **New** and **Open / Import** return to the launcher. **Recent projects** puts the last opened project first.

The launcher's project list can scroll within its window. Projects remain on the engine server subject to that host's storage lifetime. Export `.ork` copies, especially on free ephemeral hosting.

## Assemble and edit

Select a part in the hierarchy or side scene. **Add Component** searches friendly part names, groups them by purpose, finds compatible parents using the engine's compatibility metadata, and lets you confirm the attachment. It prefers the selected part or a compatible ancestor, then a compatible body tube. If no suitable parent exists, the part is disabled with an explanation. A new part is selected automatically in the Inspector.

Edit dimensions and press Enter or leave the field to apply a revision. Normal dimensions show mm, masses g and angles degrees. Set materials, motor assignments and recovery using the relevant Inspector controls. Physical overrides and less common settings live under **Position, overrides & advanced**. Blank designs still require a compatible motor and flight settings before simulation.

## One editor window

Hierarchy, scene and inspector share the upper workspace. Flight results occupy the lower dock. Drag a divider to resize a panel; focused dividers also accept arrow keys. Each panel owns its scrolling, so the browser document stays within the viewport. Narrow screens use **Scene / Hierarchy / Inspector / Results** tabs.

Side view is a schematic of engine geometry; rear and 3D use engine-exported meshes. Side zoom and Fit controls appear only in side view. Mesh views have their own orbit/reset controls. CG is the loaded balance point; CP and static margin are references at the displayed conditions. They do not guarantee flight success.

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

Use **Validate design**, then **Flight settings** to check geometry, motor configurations, recovery, atmosphere and wind. Choose a simulation and use **Simulate launch**. The lower dock shows actual job results, plots, variables, events, comparisons, recorded playback and provenance. Earlier runs retain their original revisions. **Tools** contains advanced analysis/optimization, expressions and additional exports. No browser physics replaces the OpenRocket core.

## Controls removed or hidden

| Control | Reason / current behaviour |
| --- | --- |
| Unconfigured AI assistant | Hidden unless health metadata reports AI configured. Configured providers retain their existing explicit proposal/acceptance workflow. |
| Paint and shine inputs | Removed from the Inspector because the current renderers do not display those mutations. Existing imported appearance data and server APIs are retained. Physical surface finish remains available. |
| Arbitrary reflected metadata | The Inspector shows the main geometry fields and an explicit set of physical advanced fields, rather than presenting internal/cosmetic metadata as useful design controls. |
| Side zoom controls in mesh views | Hidden because those buttons controlled only the side schematic. Mesh controls remain available. |
| Print workspace / PDF | Removed because browser printing does not provide a verified export of the docked editor. Engineering file/data exports remain available. |
| Light/dark toggle | Replaced by the requested consistent dark editor. |
| Examples dialog inside the editor | Replaced by the project launcher, so the starting point is chosen before editing. |

This is a usability change, not an expansion of engineering parity. See the existing parity matrix for specialized component, rendering, interchange and simulation limitations. The UI build, four real-engine editor browser journeys and two protected Pages browser journeys validate the changed flow. Their JSON reports and screenshots live in `tests/`.

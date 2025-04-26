# Development Notes - Topdown Action RPG

This file captures key decisions, techniques, and context from the development session.

## Project Goal & Setup

*   **Goal:** Web-based, top-down action RPG.
*   **Tech:** TypeScript, HTML Canvas 2D API, SVG for assets.
*   **Build:** Vite provides dev server (`npm run dev`) and hot module replacement (HMR).
*   **Styling:** Basic dark mode theme.
*   **Assets Location:** Static assets (SVGs, audio) are placed in the `public/assets/` directory and referenced using root-relative paths (e.g., `/assets/svg/player.svg`).

## Core Mechanics & Rendering

*   **Game Loop:** Standard `requestAnimationFrame` loop managed in `main.ts`, driven by `Game` class.
*   **Rendering:** `Renderer` class (`renderer.ts`) encapsulates low-level Canvas 2D drawing primitives. `SceneRenderer` (`sceneRenderer.ts`) handles drawing the actual game world (terrain, objects, player, etc.) using the `Renderer`.
*   **Coordinate System:** Distinction between fixed **World Coordinates** and **Screen Coordinates**.
*   **Camera:** Managed by `SceneRenderer` (`updateCamera`), which updates coordinates in the core `Renderer` (`cameraX`, `cameraY`). Follows the player, clamped to world boundaries.
*   **Assets:** SVGs loaded via `AssetLoader`. Audio files loaded via `AudioPlayer`.
*   **Audio:** `AudioPlayer` manages sounds via Web Audio API. Context resuming handled in `Game` constructor.

## Game Structure & Refactoring

*   **Scenes:** Abstract `Scene` class with concrete `GameScene` (`scene.ts`). `Game` class holds the `currentScene`.
*   **`GameScene` Refactoring (Major Change):** To improve maintainability and separation of concerns, the large `GameScene` class was refactored. Its responsibilities are now delegated to several specialized classes:
    *   **`EntityManager` (`entityManager.ts`):** Manages static objects (`Tree`, `House`) and `droppedItems`. Handles adding, removing, querying entities, spawning items, and tree destruction logic.
    *   **`TerrainManager` (`terrainManager.ts`):** Manages the `terrainGrid`, tile data, walkability checks, and terrain placement.
    *   **`SceneStateManager` (`sceneStateManager.ts`):** Handles saving/loading scene state (objects, items, terrain) to/from IndexedDB.
    *   **`GameplayController` (`gameplayController.ts`):** Handles input processing and game logic updates specific to the *gameplay* mode (movement, collision, tool use, item pickup/drop).
    *   **`CreativeController` (`creativeController.ts`):** Handles input processing and logic updates specific to *creative* mode (object/terrain/item placement and removal).
    *   **`SceneRenderer` (`sceneRenderer.ts`):** Handles all drawing of world-space elements (terrain, objects, items, player, overlays, etc.) using the core `Renderer`.
    *   `GameScene` now acts primarily as a coordinator, holding instances of these managers/controllers and delegating tasks.
*   **Game Objects:**
    *   `Player` (`player.ts`): Position, stats, inventory, equipped item, animation state/methods.
    *   Static Objects (`Tree`, `House`): Now managed by `EntityManager`. Tree health/state handled within `Tree` class, destruction/spawning handled by `EntityManager`.
*   **Input:** `InputHandler` (`input.ts`) captures events, manages flags, provides coordinate translation. Input state is read by `GameplayController` and `CreativeController`.
*   **Collision:**
    *   Player-Object collision checked in `GameplayController` against `EntityManager` data.
    *   Tool-Object collision checked in `GameplayController`.
    *   Terrain walkability checked in `GameplayController` via `TerrainManager.isWalkable`.
    *   AABB helper (`checkCollision`) now static in `EntityManager`.
*   **Item System (`item.ts`):** Defines item types and configurations.
*   **Dropped Items (`droppedItem.ts`):** Interface defined. Managed by `EntityManager`, rendered by `SceneRenderer`.
*   **Terrain System (`terrain.ts`):** Defines terrain types and configurations. Grid managed by `TerrainManager`, rendered by `SceneRenderer`.

## Feature: Axe, Tree Chopping & Inventory

*   **Axe & Chopping:**
    *   Handled by `GameplayController`.
    *   Checks cooldown, equipped item, calculates hitbox, checks collision via `EntityManager`.
    *   On hit: Plays sound (`AudioPlayer`), calls `Tree.takeDamage`, triggers `Player` animation.
    *   If tree health drops <= 0: Tree state updated, sound played, `EntityManager.destroyTreeAndSpawnLogs` scheduled via `setTimeout`.
*   **Item Pickup:**
    *   Proximity check and closest item tracked in `GameplayController`.
    *   Prompt drawn by `SceneRenderer` based on info from `GameplayController`.
    *   Pickup action (`E` key) handled by `GameplayController`, calls `Player.addItem`, removes item via `EntityManager.removeDroppedItem`.
*   **Inventory UI:**
    *   Drawn by core `Renderer.drawInventoryUI` (called from `Game.draw`).
*   **Equipping via UI:**
    *   Click detection and slot calculation in `Game.handleInventoryClick`.
    *   Calls `Player.equipItem`. Consumes click via `InputHandler`.
*   **Visual Feedback:**
    *   Health bars drawn by `SceneRenderer` over damaged standing trees.

## Persistence

*   **Scene Layout (IndexedDB):** Managed by `SceneStateManager`. Saves/loads objects, items, terrain grid via `db.ts`.
*   **Player Progress (localStorage):** Handled by `Game.savePlayerData`/`loadPlayerData`.

## Feature: Item Dropping

*   **Mechanics:**
    *   Dropping Equipped Item ('G' key): Handled by `GameplayController`. Calls `Player.dropEquippedItem`, then `EntityManager.spawnDroppedItem`.
    *   Dropping from Inventory UI (Shift+Click): Handled by `Game.handleInventoryClick`. Calls `Player.dropItemById`, then `GameScene.spawnDroppedItemNearPlayer` (which delegates to `EntityManager`).
*   **Refactoring:** Item spawning logic centralized in `EntityManager.spawnDroppedItem`.
*   **Audio:** Drop sound played by `EntityManager.spawnDroppedItem`.

## Feature: Creative Mode Selector & Placement

*   **Mechanics:**
    *   Toggling Mode ('C' key): Handled in `Game.update`.
    *   Selector Panel (`ui/creativeModeSelector.ts`): Manages selection state, handles its own clicks (consuming input), draws its panel via `Renderer`.
    *   Placement/Removal: Handled by `CreativeController`. Reads input state, interacts with `EntityManager` (for objects/items) and `TerrainManager` (for terrain).
    *   Preview/Highlight: Data provided by `CreativeController`, drawn by `SceneRenderer`.

## Feature: House Entry Detection (Implemented - Part 1: Detection)

*   **Goal:** Allow player to enter placed `House` objects by colliding with the door area.
*   **Initial Problem:** Standard collision detection (`GameplayController.handleMovement` checking player bounds against `House` bounds) blocked the player before their center could reach the visual door area, preventing a simple overlap check from working reliably.
*   **Solution Strategy:**
    1.  **Reduced Collision Box:** Modified the collision check in `GameplayController.handleMovement`. When checking against a `House`, use a slightly shorter bounding box (e.g., `height - 10`, center adjusted) for the actual movement blocking. This allows the player sprite to visually overlap the bottom edge/door area.
    2.  **Separate Trigger Check:** Implemented a new method `GameplayController.checkDoorEntry()`, called *after* the player's final position is determined in `handleMovement`.
    3.  **Door Trigger Area:** `checkDoorEntry()` calculates a specific rectangular trigger area (`doorBounds`) roughly corresponding to the visual door, but extended downwards below the house edge to ensure the player's center point enters it reliably.
    4.  **Detection:** If the player's center (`player.x`, `player.y`) falls within the `doorBounds` in `checkDoorEntry()`, a console message is logged (This is where scene transition logic will be added).
*   **Debug Visualization:**
    *   To aid positioning the bounds, debug drawing was added.
    *   `Renderer` got a `drawDebugRect` method for dashed outlines.
    *   `SceneRenderer` got a `drawDebugBounds` method, called by `drawScene`.
    *   `GameScene.draw` now calculates the necessary debug bounds (reduced house collision box - orange, door trigger area - cyan) *only when creative mode is enabled* and passes them to `SceneRenderer`.
    *   This required moving the bounds calculation out of `GameplayController` (which doesn't run in creative mode) into `GameScene.draw`.
*   **Tuning:** The door trigger area (`doorBounds` calculation in both `checkDoorEntry` and `GameScene.draw`) required tuning the margins (`doorTopMargin = 15`, `doorBottomMargin = 60`) and horizontal offset (`doorXOffset = 20`) to align well visually and feel responsive.
*   **Next Step:** Implement the actual scene transition when the door entry is detected.

## Feature: House Entry & Scene Transitions (Implemented)

*   **Goal:** Allow entering houses into unique, persistent interior scenes.
*   **House Identification:** `House` class now has a unique `id` property, generated via `crypto.randomUUID()` upon creation if not loaded from save data.
*   **Scene Transition Logic (`Game.changeScene`):**
    *   A central `Game.changeScene(newSceneId, contextData?)` method handles transitions.
    *   It accepts optional `contextData` to pass information between scenes (e.g., where the player should appear upon exiting).
    *   **Save Outgoing Scene:** Before switching, it calls `currentScene.save()` to persist the state of the scene being left (using `SceneStateManager`).
    *   **Player Data:** Saves player data (`localStorage`) *after* updating `Game.currentSceneId` to the *new* scene ID.
    *   **New Scene Instance:** Creates a new `GameScene` instance for the `newSceneId`, passing the `Game` instance and `contextData`.
    *   **Load New Scene:** Calls `newScene.load()`. `GameScene.load` uses `SceneStateManager` to load from IndexedDB. If no state exists for `newSceneId`, it calls `generateDefaultLayout`.
    *   **Player Positioning:** Places the player in the new scene. Uses `contextData.targetPosition` if provided (e.g., when exiting a house). For new house interiors (`interior-*`), it places the player near the bottom exit door. Otherwise, defaults to the scene center.
    *   **Input Reset:** Calls `InputHandler.resetFrameState()` and `InputHandler.resetMovement()` to prevent carried-over inputs.
*   **Entering a House (`GameplayController.checkDoorEntry`):**
    *   Detects collision with house door trigger area.
    *   Gets the specific `house.id`.
    *   Constructs `interiorSceneId = \`interior-\${house.id}\``.
    *   Gets the current scene ID (`originSceneId = game.getCurrentSceneId()`).
    *   Calculates an `exitTargetPosition` (slightly below the entry point).
    *   Calls `game.changeScene(interiorSceneId, { originSceneId, exitTargetPosition })`.
*   **Interior Scene Generation (`GameScene.generateDefaultLayout`):**
    *   Checks if `sceneId` starts with `interior-`.
    *   Resizes `TerrainManager` grid to 10x10 (`resizeGrid`).
    *   Fills grid with `TerrainType.WOOD_FLOOR` (`fillGridWith`).
    *   Creates a `DoorExit` static object at the bottom center.
    *   Uses the `contextData` (passed via `Game.changeScene`) to call `doorExit.setTarget(contextData.originSceneId, contextData.exitTargetPosition)`, linking the exit back to the exterior scene.
*   **Exiting a House (`GameplayController.checkExitTrigger`):**
    *   New method called in `update`.
    *   Checks for collision between player center and any `DoorExit` object.
    *   If collision occurs and the `DoorExit` has valid `targetSceneId` and `targetPosition`:
        *   Calls `game.changeScene(exitDoor.targetSceneId, { targetPosition: exitDoor.targetPosition })`.
*   **`DoorExit` Object (`doorExit.ts`):**
    *   New class for the static exit marker object.
    *   Stores `targetSceneId` and `targetPosition`.
    *   Has `setTarget` method.
*   **Persistence (`SceneStateManager`, `db.ts`):**
    *   `SavedObjectState` updated to include optional `id`, `targetSceneId`, `targetPosition`.
    *   `SceneStateManager.saveState` saves these properties for `House` and `DoorExit` instances.
    *   `SceneStateManager.loadState` restores these properties, passing the `id` to the `House` constructor and calling `setTarget` on loaded `DoorExit` instances.
    *   `db.ts` now includes `deleteSceneState(sceneId)` function.
*   **House Deletion (`CreativeController`):**
    *   When a `House` is deleted via the Delete key, the controller constructs the corresponding `interior-<id>` and calls `db.deleteSceneState()` to remove the interior scene data from IndexedDB.
*   **Dynamic World Size (`TerrainManager`, `SceneRenderer`):**
    *   `TerrainManager.setGrid` updated to adopt the dimensions of the loaded grid, updating its internal `rows`/`cols`.
    *   `SceneRenderer` has `updateWorldDimensions` method called by `GameScene.load`.
    *   `SceneRenderer.updateCamera` uses the renderer's current world dimensions, allowing it to correctly center smaller scenes like interiors.
*   **UI (`CreativeModeSelector`):**
    *   `DoorExit` config restored to `PLACEABLE_OBJECT_CONFIG` (so `generateDefaultLayout` can find the asset path).
    *   `initializeItems` explicitly skips adding `DoorExit` to the creative UI panel items.
*   **Debug Teleport (`Game`, `InputHandler`):**
    *   Pressing 'T' now saves the current scene via `currentScene.save()` before calling `changeScene('defaultForest')`.

## Known Issues / Next Steps (Implied)

*   Only one scene ('defaultForest') implemented.
*   No transitions between scenes.
*   No NPCs or advanced interaction system.
*   Basic collision resolution.
*   Manual saving ('F5' assumed, though Save key exists); auto-save TBD.
*   No visual feedback for falling trees (just disappear after delay).
*   Limited item types.
*   Basic swing animation.
*   No sound for item pickup.
*   Creative mode probably doesn't save/load tree health correctly (uses simpler save format).
*   No way to drop items *from* inventory yet.

## Feature: Item Dropping (Implemented)

*   **Mechanics:** Allows the player to drop items from their inventory onto the ground.
    *   **Dropping Equipped Item:** Pressing the 'G' key drops the currently equipped item.
        *   `InputHandler` sets `dropItemPressed` flag.
        *   `GameScene.handleGameplayInput` checks the flag, calls `player.dropEquippedItem()`.
        *   `Player.dropEquippedItem()` calls `removeItem(equippedItemId, 1)` (which also handles unequipping if the stack is emptied) and returns the `itemId`.
        *   `GameScene` calls `spawnDroppedItem` to create the item entity in the world near the player.
    *   **Dropping from Inventory UI:** Holding Shift and clicking an inventory slot drops one item from that stack.
        *   `InputHandler` mousedown listener checks for `e.shiftKey` and sets `uiDropActionClicked` flag (instead of `uiMouseClicked`).
        *   `Game.update` checks for *either* `uiMouseClicked` or `uiDropActionClicked` before calling `handleInventoryClick`.
        *   `Game.handleInventoryClick` detects `uiDropActionClicked`, calculates the clicked slot/item ID, calls `player.dropItemById(itemId, 1)`.
        *   `Player.dropItemById()` simply calls `removeItem(itemId, 1)`.
        *   If `dropItemById` succeeds, `Game.handleInventoryClick` calls `scene.spawnDroppedItem` to create the item entity near the player.
*   **Refactoring:** 
    *   Item spawning logic was extracted into `GameScene.spawnDroppedItem(itemId, x, y, quantity)` for reuse by both drop mechanisms.
    *   Creative mode selection panel logic (state, input handling, drawing) extracted from `Game` and `Renderer` into `ui/creativeModeSelector.ts`.
*   **Audio:** An `item-drop` sound (loaded as `/assets/audio/drop.mp3`) is played by `spawnDroppedItem`.
*   **Persistence:** Dropped items are already saved/loaded as part of the `GameScene` state persistence via IndexedDB (`droppedItems` array in `SavedSceneState`).
*   **UI Click Handling:** UI components (`CreativeModeSelector`, `Game.handleInventoryClick`) now call `InputHandler.consumeClick()` after handling a mouse click within their bounds. This prevents the click from also triggering world interactions (like placing the currently selected creative item) in the same frame.

## Feature: Creative Mode Selector (Implemented)

*   **Mechanics:** Allows the player to select and use creative mode items.
    *   **Selecting Creative Mode:** Pressing the 'C' key toggles creative mode.
        *   `InputHandler` sets `creativeModePressed` flag.
        *   `Game.update` checks the flag and toggles `Game.creativeModeEnabled`.
    *   **Using Creative Mode:** Creative mode items can be used in the game.
        *   The selector includes placeable objects (Tree, House), terrain tiles (Grass, Road, Water), and placeable items (Axe).
        *   Clicking an object/terrain/item in the selector updates the state in `CreativeModeSelector`.
        *   Clicking in the world (if not consumed by UI) triggers placement in `GameScene.handleCreativeModeInput` based on the selected type: objects are added to `staticObjects`, terrain updates `terrainGrid`, items are added to `droppedItems` via `spawnDroppedItem`.
        *   The `GameScene.drawCreativeModeOverlay` shows a ghost preview of the selected object/terrain/item.
*   **Refactoring:** Creative mode selection panel logic (state, input handling, drawing) extracted from `Game` and `Renderer` into `ui/creativeModeSelector.ts`.
*   **UI:** Creative selector panel is now visually sized to hold at least 2 rows (10 items).
*   **Audio:** An `item-drop` sound (loaded as `/assets/audio/drop.mp3`) is played by `spawnDroppedItem`.
*   **Persistence:** Dropped items are already saved/loaded as part of the `GameScene` state persistence via IndexedDB (`droppedItems` array in `SavedSceneState`).
*   **UI Click Handling:** UI components (`CreativeModeSelector`, `Game.handleInventoryClick`) now call `InputHandler.consumeClick()` after handling a mouse click within their bounds. This prevents the click from also triggering world interactions (like placing the currently selected creative item) in the same frame. 
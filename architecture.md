# Game Architecture - Topdown Action RPG

This document describes the high-level architecture of the game.

## 1. Overview

The game is a web-based, top-down action RPG built with TypeScript. It utilizes the HTML5 Canvas API for rendering, managed via a core `Renderer` class. Specific scene rendering is handled by `SceneRenderer`. Static assets (SVGs, audio files) are served from the `/public` directory. Vite serves as the build tool and development server.

The architecture is component-based, centered around a main `Game` class that manages core systems and delegates updates and drawing to the current `Scene`. The `GameScene` implementation further delegates responsibilities to specialized manager and controller classes.

## 2. Core Modules & Responsibilities

*   **`main.ts`**: Application entry point. Gets the canvas element, instantiates the `Game` class, and starts the main game loop (`requestAnimationFrame`).
*   **`game.ts`**: Central orchestrator.
    *   Initializes and holds references to core systems (`Renderer`, `InputHandler`, `AssetLoader`, `AudioPlayer`).
    *   Instantiates and holds reference to the `CreativeModeSelector` UI component.
    *   Manages the single `currentScene` instance and `currentSceneId`.
    *   Handles scene transitions via `changeScene(newSceneId, contextData?)`:
        *   Saves outgoing scene state (`currentScene.save()`).
        *   Saves player data (`savePlayerData`) including the *new* `currentSceneId`.
        *   Creates new `GameScene` instance, passing the `Game` instance and `contextData`.
        *   Calls `newScene.load()`.
        *   Positions player based on `contextData.targetPosition` or defaults (center for most scenes, near exit for interiors).
        *   Resets input state.
    *   Provides `getCurrentSceneId()` getter.
    *   Handles global states like `isLoading`, `creativeModeEnabled`.
    *   Manages player persistence (`localStorage`) via internal `savePlayerData`/`loadPlayerData` methods.
    *   Triggers scene persistence (`IndexedDB`) via `currentScene.save()` and explicit `saveGame()` method (e.g., on F5).
    *   Loads sounds via `AudioPlayer` during init.
    *   Handles resuming `AudioContext` on user interaction.
    *   Handles clicks on inventory UI (`handleInventoryClick`), calling `player` methods and `scene.spawnDroppedItemNearPlayer`.
    *   Delegates `update` and `draw` calls to the `currentScene` and `CreativeModeSelector`.
    *   Passes creative selection state (`selectedObjectType`, `selectedTerrainType`, `selectedItemId`) from `CreativeModeSelector` to the `currentScene`.
    *   Calls `Renderer.drawInventoryUI`.
    *   Handles input related to global state changes (creative mode toggle, saving, debug teleport).
*   **`scene.ts`**: Defines scene structure.
    *   `Scene` (Abstract Class): Base class defining the required interface (`load`, `update`, `draw`, `save`, `getId`, `getWorldDimensions`, `getTileSize`) and holding common references (`Game`, `Renderer`, etc.).
    *   `GameScene` (Concrete Class): Represents a playable area.
        *   Accepts `contextData` in constructor.
        *   Holds `EntityManager`, `TerrainManager`, `SceneStateManager`, `GameplayController`, `CreativeController`, `SceneRenderer`.
        *   `load()`: Loads common assets, delegates state loading to `SceneStateManager`. If state doesn't exist, calls `generateDefaultLayout`. Updates `SceneRenderer` dimensions via `updateWorldDimensions`.
        *   `generateDefaultLayout()`: Generates default scene content based on `sceneId` (forest, road room, or 10x10 interior with wood floor and `DoorExit` linked using `contextData`).
        *   `update()`: Delegates logic to `GameplayController` or `CreativeController`. Updates `Player` and `SceneRenderer` camera.
        *   `draw()`: Retrieves necessary state and delegates rendering to `SceneRenderer`. Calculates debug bounds for houses.
        *   `save()`: Delegates state saving to `SceneStateManager`.
        *   `getWorldDimensions()`: Returns world size based on `TerrainManager`'s current grid dimensions.
        *   `getTileSize()`: Returns the scene's tile size.
        *   `spawnDroppedItemNearPlayer()`: Helper for dropping items from UI.
*   **`entityManager.ts`**: `EntityManager` class.
    *   Manages collections of `staticObjects` (Trees, Houses, `DoorExit`) and `droppedItems`. Handles `DoorExit` type in methods.
    *   Provides methods for adding (`addStaticObject`), removing (`removeStaticObject`, `removeDroppedItem`), and querying (`getObjectAt`) entities.
    *   Handles spawning of dropped items (`spawnDroppedItem`), including asset loading checks and sound playback.
    *   Encapsulates logic for destroying trees and spawning logs (`destroyTreeAndSpawnLogs`).
    *   Includes logic for populating default objects (`populateTrees`).
    *   Provides a static collision checking helper (`checkCollision`).
*   **`terrainManager.ts`**: `TerrainManager` class.
    *   Manages the `terrainGrid` (2D array of `TerrainType`).
    *   Initializes the grid based on initial world size. Stores internal `rows`, `cols`.
    *   Provides methods for tile info (`getTileType`, `getTileConfig`), walkability (`isWalkable`), placing terrain (`placeTerrainAt`).
    *   `setGrid(newGrid)`: Updates internal dimensions (`rows`, `cols`) based on the loaded grid.
    *   `resizeGrid(rows, cols)`: Resizes the grid and re-initializes (used by default layout generation).
    *   `fillGridWith(type)`: Fills the current grid with a specified terrain type.
    *   Provides grid data (`getGrid`, `getGridDimensions`).
*   **`sceneStateManager.ts`**: `SceneStateManager` class.
    *   Handles saving/loading scene state (`staticObjects`, `droppedItems`, `terrainGrid`) to/from IndexedDB via `db.ts`.
    *   Serializes/deserializes entity state, including `House.id` and `DoorExit` target information (`targetSceneId`, `targetPosition`).
    *   Handles pre-loading of assets required by saved state.
*   **`sceneTransitionSystem.ts`**: `SceneTransitionSystem` class.
    *   Centralizes all scene transition logic in a dedicated module.
    *   Defines the `Direction` enum (NORTH, EAST, SOUTH, WEST) used for grid-based navigation.
    *   Handles three types of transitions:
        *   `checkSceneEdgeTransition()`: Outdoor grid-based scene transitions with bidirectional linking.
        *   `checkDoorEntry()`: House entry transitions into interior scenes.
        *   `checkExitTrigger()`: Interior exit transitions back to the exterior world.
    *   Manages coordinate systems and player positioning during transitions.
    *   Provides collision detection for exit triggers.
*   **`gameplayController.ts`**: `GameplayController` class.
    *   Receives `Game` instance in constructor.
    *   Creates and manages a `SceneTransitionSystem` instance.
    *   Handles gameplay input/logic: movement (terrain/object collision, adjusted house bounds, ignores `DoorExit`), tool use, item pickup/drop.
    *   Delegates all scene transition logic to the `SceneTransitionSystem`.
    *   Provides getter for closest pickup item.
*   **`creativeController.ts`**: `CreativeController` class.
    *   Handles creative mode input/logic: placement/removal of objects/terrain/items via `EntityManager`/`TerrainManager`.
    *   Handles deletion: If deleting a `House`, calls `db.deleteSceneState(\`interior-\${house.id}\`)` before removing the house object.
    *   Provides getters for placement preview/highlight info.
*   **`sceneRenderer.ts`**: `SceneRenderer` class.
    *   Responsible for drawing world-space elements.
    *   `updateWorldDimensions()`: Method to update internal world size, called by `GameScene.load`.
    *   `updateCamera()`: Updates camera based on player, viewport, and *current* world dimensions (allows centering smaller scenes).
    *   Draws terrain, static objects (handles `Tree`, `House`, `DoorExit`), items, player, UI prompts, creative overlays, debug bounds.
*   **`renderer.ts`**: Core Canvas rendering abstraction.
    *   Holds the canvas context (`ctx`).
    *   Manages viewport size and camera coordinates (`cameraX`, `cameraY`). Updated by `SceneRenderer`.
    *   Provides low-level drawing primitives: `clear`, `drawTile`, `drawImage`, `drawText`, `drawHighlight`, `drawGhostImage`, `drawPlaceholder`, `drawPickupPrompt`, `drawHealthBar`.
    *   Provides UI drawing methods (screen coordinates): `drawInventoryUI`.
    *   Provides debug drawing method: `drawDebugRect`.
    *   Handles canvas resizing.
*   **`input.ts`**: `InputHandler` class.
    *   Attaches listeners, tracks keys/mouse state (world/screen coords), manages single-frame action flags (`useToolPressed`, `mouseClicked`, `uiMouseClicked`, `deletePressed` etc.). Added debug teleport flag.
    *   Provides methods to query state (`getMovementDirection`, flags). Includes `consumeClick` and `resetMovement`. Requires `Renderer` reference.
*   **`assets.ts`**: `AssetLoader` class for asynchronous loading and caching of image assets (`HTMLImageElement`).
*   **`audio.ts`**: `AudioPlayer` class for loading (`loadSound`), caching (`AudioBuffer`), and playing sounds via Web Audio API. Handles context resuming.
*   **`player.ts`**: `Player` entity class.
    *   Stores state: position, dimensions, speed, rotation, SVG path.
    *   Stores inventory (`Map<string, InventorySlot>`), equipped item (`equippedItemId`).
    *   Stores animation state (`isSwinging`, timers).
    *   Provides methods for movement (`move`), updates (`update` - rotation, animation), inventory management (`addItem`, `removeItem`, `equipItem`, etc.), and animation control (`startSwing`, `getSwingAngleOffset`).
*   **`tree.ts`, `house.ts`**: Static object entity classes. (`Tree` includes health/state, `House` has `id`).
*   **`doorExit.ts`**: Static object entity class. Stores `targetSceneId` and `targetPosition`. Has `setTarget` method.
*   **`item.ts`**: Item definition module (`ItemType`, `Item` interface, `ITEM_CONFIG`, `getItemConfig`).
*   **`droppedItem.ts`**: Defines the `DroppedItem` interface used by `EntityManager` and `SceneRenderer`.
*   **`ui/creativeModeSelector.ts`**: UI component for creative mode selection panel. (`DoorExit` config restored but filtered from UI panel). Manages its own state, input handling, drawing. Loads its own assets.
*   **`db.ts`**: IndexedDB persistence layer abstraction (`saveSceneState`, `loadSceneState`). Added `deleteSceneState` function.
*   **`terrain.ts`**: Terrain definition module (`TerrainType`, `TerrainConfig`, `TERRAIN_CONFIG`, `getTerrainConfig`). (`wood-floor` added).
*   **`npc.ts`, `ui.ts`**: Placeholder modules for future features.

## 3. Data Flow & State

*   **Initialization:** `main.ts` -> `Game` -> `Game.init` -> Load sounds -> `loadPlayerData` (gets `currentSceneId`) -> Create `Player` -> Restore Player state -> Create `CreativeSelector` -> Load Creative Assets -> Create initial `GameScene` instance (passing `Game`) -> `GameScene.load` (loads common assets, `SceneStateManager.loadState`, generates default if needed, `sceneRenderer.updateWorldDimensions`) -> Game loop starts.
*   **Update Cycle:** `Game.update` -> `CreativeSelector.update` -> Check debug teleport / save keys -> `Game.currentScene.update` -> `GameScene` delegates to `GameplayController.update` OR `CreativeController.update` -> Controllers interact -> `Player.update` -> `SceneRenderer.updateCamera` -> Handle Inventory Clicks -> `InputHandler.resetFrameState`.
*   **Scene Transition Flow:** `GameplayController.update` -> `SceneTransitionSystem.update` -> `SceneTransitionSystem` checks transition conditions -> If triggered, calls `Game.changeScene`.
*   **Draw Cycle:** `Game.draw` -> `Game.currentScene.draw` -> `GameScene` gets info -> Delegates to `SceneRenderer.drawScene` -> `SceneRenderer` draws world -> `Game` draws screen-space UI (`InventoryUI`, `CreativeSelector`).
*   **Scene Transition (`Game.changeScene(newId, context?)`):** Triggered via `SceneTransitionSystem`. Saves outgoing scene -> Updates player data (`currentSceneId`) -> Creates new `GameScene` (passing `context`) -> Calls `newScene.load` -> Positions player (using `context.targetPosition` or defaults) -> Resets input.
*   **State Location:**
    *   Global Game State: `Game` class (`creativeModeEnabled`, `currentSceneId`).
    *   Creative Selection State: `CreativeModeSelector`.
    *   Scene Layout State: Managed by `EntityManager`, `TerrainManager` within `GameScene`. Persisted/loaded via `SceneStateManager` to IndexedDB, keyed by `sceneId`.
    *   Object-Specific State: `Tree` (health), `House` (ID), `DoorExit` (targetSceneId, targetPosition).
    *   Player Progress Persistence: `localStorage` (`PlayerSaveData`) via `Game` methods.
    *   Input State: `InputHandler` class.
    *   Asset Cache: `AssetLoader`, `AudioPlayer`.

## 4. Key Architectural Concepts

*   **Component-Based Design:** Functionality divided into distinct modules/classes.
*   **Separation of Concerns:** `GameScene` responsibilities broken down into specialized managers/controllers.
*   **Manager Pattern:** Used for `EntityManager`, `TerrainManager`, `SceneStateManager`.
*   **Controller Pattern:** Used for `GameplayController`, `CreativeController`.
*   **System Pattern:** Used for `SceneTransitionSystem` to encapsulate related functionality.
*   **Scene Management:** `Game` manages `currentScene` instance and `currentSceneId`. Transitions handled by `Game.changeScene`, loading/saving delegated to `Scene`/`SceneStateManager`. Default scene generation for non-existent scene IDs (including interiors).
*   **Decoupled Rendering:** Core `Renderer`, Scene-specific `SceneRenderer`. `SceneRenderer` dimensions updated dynamically.
*   **Decoupled Audio:** `AudioPlayer` hides Web Audio API details.
*   **World vs. Screen Coordinates:** Handled by camera translation (`SceneRenderer`) and UI drawing.
*   **Asynchronous Operations:** Asset/sound loading and IndexedDB operations use `async`/`await`.
*   **Dual Persistence:** IndexedDB for scene layout (keyed by scene ID, managed by `SceneStateManager`), `localStorage` for player progress (`Game`).
*   **State Management:** Game state distributed across `Game`, managers, controllers, entities, UI components.
*   **Input Handling:** Single-frame flags in `InputHandler`. UI consumes clicks, `resetMovement` added.
*   **Collision Detection:** AABB checks in `GameplayController` (player vs objects, ignores `DoorExit`), `CreativeController` (placement), `EntityManager` (static helper). Terrain walkability checked via `TerrainManager`.
*   **Scene Transition System:** Centralized in `SceneTransitionSystem`, handling edge transitions (outdoor grid navigation), interior entry (house doors), and interior exit (exit doors).
*   **House Entry/Exit Triggers:** Handled by `SceneTransitionSystem`, comparing player center to calculated trigger zones. Context data (`originSceneId`, `exitTargetPosition`, `targetPosition`) passed via `changeScene`.
*   **Simple State Machine:** Tree uses `STANDING`/`FALLING` states.
*   **Delayed Actions:** Using `setTimeout` for tree destruction effects.
*   **UI Interaction Handling:** UI components handle clicks, consume events.
*   **Debug Visuals:** Creative mode can display debug bounds.

## 5. Additional Notes

*   The refactoring significantly reduced the complexity of `GameScene` and `GameplayController`, making them primarily coordinators.
*   New classes (`EntityManager`, `TerrainManager`, `SceneStateManager`, `GameplayController`, `CreativeController`, `SceneRenderer`, `DoorExit`, `SceneTransitionSystem`) now encapsulate specific responsibilities, improving modularity and maintainability.
*   Clearer distinction between core rendering (`Renderer`) and scene-specific rendering (`SceneRenderer`).
*   Persistence logic is isolated in `SceneStateManager` (for scene) and `Game` (for player).
*   Input handling logic is separated based on game mode (`GameplayController`, `CreativeController`).
*   Scene transitions are centralized in the dedicated `SceneTransitionSystem`.
*   Dynamic world/grid dimensions handled by `TerrainManager` and `SceneRenderer`. 
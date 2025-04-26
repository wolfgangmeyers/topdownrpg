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
    *   Manages the `currentScene` instance (currently `GameScene`).
    *   Handles global states like `isLoading`, `creativeModeEnabled`.
    *   Manages player persistence (`localStorage`) via internal `savePlayerData`/`loadPlayerData` methods.
    *   Triggers scene persistence (`IndexedDB`) via `scene.save()`.
    *   Loads sounds via `AudioPlayer` during init.
    *   Handles resuming `AudioContext` on user interaction.
    *   Handles clicks on inventory UI (`handleInventoryClick`), calling `player` methods and `scene.spawnDroppedItemNearPlayer`.
    *   Delegates `update` and `draw` calls to the `currentScene` and `CreativeModeSelector`.
    *   Passes creative selection state (`selectedObjectType`, `selectedTerrainType`, `selectedItemId`) from `CreativeModeSelector` to the `currentScene`.
    *   Calls `Renderer.drawInventoryUI`.
    *   Handles input related to global state changes (creative mode toggle, saving).
*   **`scene.ts`**: Defines scene structure.
    *   `Scene` (Abstract Class): Base class defining the required interface (`load`, `update`, `draw`, `save`, `getId`) and holding common references.
    *   `GameScene` (Concrete Class): Represents a playable area. Acts as a coordinator, holding instances of and delegating tasks to managers and controllers.
        *   Holds `EntityManager`, `TerrainManager`, `SceneStateManager`, `GameplayController`, `CreativeController`, `SceneRenderer`.
        *   `load()`: Loads common assets (terrain tiles), delegates state loading to `SceneStateManager`, and populates default objects via `EntityManager` if needed.
        *   `update()`: Delegates logic to `GameplayController` or `CreativeController` based on `creativeModeEnabled`. Updates `Player` and `SceneRenderer` camera.
        *   `draw()`: Retrieves necessary state from controllers and delegates rendering to `SceneRenderer`.
        *   `save()`: Delegates state saving to `SceneStateManager`.
        *   `spawnDroppedItemNearPlayer()`: Public method called by `Game` to facilitate dropping items from UI, delegates spawning to `EntityManager`.
*   **`entityManager.ts`**: `EntityManager` class.
    *   Manages collections of `staticObjects` (Trees, Houses) and `droppedItems`.
    *   Provides methods for adding (`addStaticObject`), removing (`removeStaticObject`, `removeDroppedItem`), and querying (`getObjectAt`) entities.
    *   Handles spawning of dropped items (`spawnDroppedItem`), including asset loading checks and sound playback.
    *   Encapsulates logic for destroying trees and spawning logs (`destroyTreeAndSpawnLogs`).
    *   Includes logic for populating the scene with default objects (`populateTrees`).
    *   Provides a static collision checking helper (`checkCollision`).
*   **`terrainManager.ts`**: `TerrainManager` class.
    *   Manages the `terrainGrid` (2D array of `TerrainType`).
    *   Initializes the grid to a default state.
    *   Provides methods to get tile type/config (`getTileType`, `getTileConfig`), check walkability (`isWalkable`), place terrain (`placeTerrainAt`).
    *   Provides access to the grid data for rendering (`getGrid`) and persistence (`setGrid`).
*   **`sceneStateManager.ts`**: `SceneStateManager` class.
    *   Handles saving and loading scene state (`staticObjects`, `droppedItems`, `terrainGrid`) to/from IndexedDB via `db.ts`.
    *   Serializes/deserializes entity state (including Tree health).
    *   Coordinates with `EntityManager` and `TerrainManager` to restore loaded state.
    *   Handles pre-loading of assets required by the saved state.
*   **`gameplayController.ts`**: `GameplayController` class.
    *   Handles input processing and logic updates during normal gameplay mode.
    *   Manages player movement, checking terrain walkability (`TerrainManager`) and object collision (`EntityManager`). Uses a reduced collision box for Houses to allow overlap near the door.
    *   Handles tool usage (cooldowns, hit detection via `EntityManager`, triggering `Player` animations and `EntityManager` damage/destruction).
    *   Manages item pickup logic (proximity checks, interacting with `Player` inventory and `EntityManager`).
    *   Handles item dropping via 'G' key (interacting with `Player` inventory and `EntityManager`).
    *   Checks for player entering house door trigger areas (`checkDoorEntry`).
    *   Provides getter for closest pickup item (`getClosestPickupItem`) for UI display.
*   **`creativeController.ts`**: `CreativeController` class.
    *   Handles input processing and logic updates during creative mode.
    *   Manages placement/removal of objects (via `EntityManager`) and terrain (via `TerrainManager`) based on mouse clicks and delete key.
    *   Handles spawning of items placed via creative mode (`EntityManager`).
    *   Provides getters for placement preview info (`getPlacementPreviewInfo`) and object highlighting (`getHighlightObjectInfo`) used by the renderer.
*   **`sceneRenderer.ts`**: `SceneRenderer` class.
    *   Responsible for drawing all world-space elements for a `GameScene`.
    *   Holds references to `EntityManager`, `TerrainManager`, `Player`, etc., to get data needed for drawing.
    *   Uses the core `Renderer` to perform actual drawing operations (tiles, objects, items, player, equipped items, health bars, pickup prompts).
    *   Handles camera updates (`updateCamera`) based on player position and world boundaries.
    *   Draws creative mode overlays (placement previews, highlights) based on data from `CreativeController`.
    *   Draws debug bounds (e.g., for house collision/triggers) when provided by `GameScene`.
*   **`renderer.ts`**: Core Canvas rendering abstraction.
    *   Holds the canvas context (`ctx`).
    *   Manages viewport size and camera coordinates (`cameraX`, `cameraY`). Updated by `SceneRenderer`.
    *   Provides low-level drawing primitives: `clear`, `drawTile`, `drawImage`, `drawText`, `drawHighlight`, `drawGhostImage`, `drawPlaceholder`, `drawPickupPrompt`, `drawHealthBar`.
    *   Provides UI drawing methods (screen coordinates): `drawInventoryUI`.
    *   Provides debug drawing method: `drawDebugRect`.
    *   Handles canvas resizing.
*   **`input.ts`**: `InputHandler` class.
    *   Attaches listeners, tracks keys/mouse state (world/screen coords), manages single-frame action flags (`useToolPressed`, `mouseClicked`, `uiMouseClicked`, `deletePressed` etc.).
    *   Provides methods to query state (`getMovementDirection`, flags). Includes `consumeClick` and `wasClickConsumedThisFrame` for UI interaction management. Requires `Renderer` reference.
*   **`assets.ts`**: `AssetLoader` class for asynchronous loading and caching of image assets (`HTMLImageElement`).
*   **`audio.ts`**: `AudioPlayer` class for loading (`loadSound`), caching (`AudioBuffer`), and playing sounds via Web Audio API. Handles context resuming.
*   **`player.ts`**: `Player` entity class.
    *   Stores state: position, dimensions, speed, rotation, SVG path.
    *   Stores inventory (`Map<string, InventorySlot>`), equipped item (`equippedItemId`).
    *   Stores animation state (`isSwinging`, timers).
    *   Provides methods for movement (`move`), updates (`update` - rotation, animation), inventory management (`addItem`, `removeItem`, `equipItem`, etc.), and animation control (`startSwing`, `getSwingAngleOffset`).
*   **`tree.ts`, `house.ts`**: Static object entity classes (`Tree` includes health and state).
*   **`item.ts`**: Item definition module (`ItemType`, `Item` interface, `ITEM_CONFIG`, `getItemConfig`).
*   **`droppedItem.ts`**: Defines the `DroppedItem` interface used by `EntityManager` and `SceneRenderer`.
*   **`ui/creativeModeSelector.ts`**: UI component for creative mode selection panel. Manages its own state, input handling (consuming clicks), and drawing via `Renderer`. Loads its own assets.
*   **`db.ts`**: IndexedDB persistence layer abstraction (`saveSceneState`, `loadSceneState`).
*   **`terrain.ts`**: Terrain definition module (`TerrainType`, `TerrainConfig`, `TERRAIN_CONFIG`, `getTerrainConfig`).
*   **`npc.ts`, `ui.ts`**: Placeholder modules for future features.

## 3. Data Flow & State

*   **Initialization:** `main.ts` -> `Game` (creates core systems, `CreativeSelector`) -> `Game.init` -> Load global sounds/UI assets -> `loadPlayerData` (localStorage) -> Create `Player` -> Restore Player state -> Create `GameScene` -> `GameScene.load` (loads common assets, delegates state load to `SceneStateManager`, populates defaults via `EntityManager` if needed) -> Game loop starts.
*   **Update Cycle:** `Game.update` -> `CreativeModeSelector.update` (handles panel clicks, updates selection, consumes input) -> `Game.handleInventoryClick` (handles inv clicks, consumes input) -> `Game.currentScene.update` -> `GameScene` delegates to `GameplayController.update` OR `CreativeController.update` -> Controllers interact with `Player`, `InputHandler`, `EntityManager`, `TerrainManager` -> `Player.update` -> `SceneRenderer.updateCamera` -> `InputHandler.resetFrameState`.
*   **Draw Cycle:** `Game.draw` -> `Game.currentScene.draw` -> `GameScene` gets info from controllers (`getClosestPickupItem`, `getPlacementPreviewInfo`, etc.) -> `GameScene` delegates to `SceneRenderer.drawScene` -> `SceneRenderer` draws world elements using data from `EntityManager`, `TerrainManager`, `Player` and info from `GameScene` -> `Game` draws screen-space UI (`Renderer.drawInventoryUI`, `CreativeModeSelector.draw`).
*   **State Location:**
    *   Global Game State: `Game` class (`creativeModeEnabled`).
    *   Creative Selection State: `CreativeModeSelector`.
    *   Scene Layout State: `EntityManager` (`staticObjects`, `droppedItems`), `TerrainManager` (`terrainGrid`). Persisted/loaded via `SceneStateManager` to IndexedDB.
    *   Object-Specific State: `Tree`, `Player`, etc.
    *   Player Progress Persistence: `localStorage` (`PlayerSaveData`) via `Game` methods.
    *   Input State: `InputHandler` class.
    *   Asset Cache: `AssetLoader` (images), `AudioPlayer` (sounds).

## 4. Key Architectural Concepts

*   **Component-Based Design:** Functionality divided into distinct modules/classes.
*   **Separation of Concerns:** `GameScene` responsibilities are broken down into specialized managers and controllers (e.g., rendering, entity management, input handling per mode, state persistence).
*   **Manager Pattern:** Used for `EntityManager`, `TerrainManager`, `SceneStateManager` to encapsulate specific domains.
*   **Controller Pattern:** Used for `GameplayController`, `CreativeController` to handle mode-specific logic and input processing.
*   **Scene Management:** Centralized control of game areas via the `Scene` abstraction.
*   **Decoupled Rendering:** Core `Renderer` hides Canvas API details; `SceneRenderer` handles drawing specific game elements.
*   **Decoupled Audio:** `AudioPlayer` hides Web Audio API details.
*   **World vs. Screen Coordinates:** Explicit handling via camera translation (`SceneRenderer`) and separate UI drawing (`Renderer`, `CreativeModeSelector`).
*   **Asynchronous Operations:** Asset/sound loading and IndexedDB operations use `async`/`await`.
*   **Dual Persistence:** IndexedDB for scene layout (`SceneStateManager`), `localStorage` for player progress (`Game`).
*   **State Management:** Game state distributed across `Game`, managers (`EntityManager`, `TerrainManager`), controllers (`GameplayController`, `CreativeController`), entities (`Player`, `Tree`), and UI components (`CreativeModeSelector`).
*   **Input Handling:** Single-frame flags in `InputHandler`. UI components (`CreativeModeSelector`, inventory click logic) consume input events via `InputHandler.consumeClick()` to prevent unintended world interactions (like placing the currently selected creative item) in the same frame. Input state is read by controllers.
*   **Collision Detection:** Basic AABB checking implemented in `GameplayController` (player vs objects) and `EntityManager` (static helper, used internally for tree placement). Terrain walkability checked via `TerrainManager`.
*   **House Entry Trigger:** Uses a separate check (`GameplayController.checkDoorEntry`) after movement is finalized, comparing player center to a dedicated trigger area distinct from the house's main collision bounds.
*   **Simple State Machine:** Tree uses `STANDING`/`FALLING` states.
*   **Delayed Actions:** Using `setTimeout` for tree destruction effects (triggered by `GameplayController`, executed by `EntityManager`).
*   **UI Interaction Handling:** UI components handle their own click detection and consume input events.
*   **Debug Visuals:** Creative mode can display debug bounds calculated in `GameScene` and drawn via `SceneRenderer`/`Renderer`.

## 5. Additional Notes

*   The refactoring significantly reduced the complexity of `GameScene`, making it primarily a coordinator.
*   New classes (`EntityManager`, `TerrainManager`, `SceneStateManager`, `GameplayController`, `CreativeController`, `SceneRenderer`) now encapsulate specific responsibilities, improving modularity and maintainability.
*   Clearer distinction between core rendering (`Renderer`) and scene-specific rendering (`SceneRenderer`).
*   Persistence logic is now isolated in `SceneStateManager` (for scene) and `Game` (for player).
*   Input handling logic is separated based on game mode (`GameplayController`, `CreativeController`). 
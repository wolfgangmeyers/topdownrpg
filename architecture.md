# Game Architecture - Topdown Action RPG

This document describes the high-level architecture of the game.

## 1. Overview

The game is a web-based, top-down action RPG built with TypeScript. It utilizes the HTML5 Canvas API for rendering, managed via a custom `Renderer` class. Static assets (SVGs, audio files) are served from the `/public` directory. Vite serves as the build tool and development server.

The architecture is component-based, centered around a main `Game` class that manages core systems and delegates updates and drawing to the current `Scene`.

## 2. Core Modules & Responsibilities

*   **`main.ts`**: Application entry point. Gets the canvas element, instantiates the `Game` class, and starts the main game loop (`requestAnimationFrame`).
*   **`game.ts`**: Central orchestrator.
    *   Initializes and holds references to core systems (`Renderer`, `InputHandler`, `AssetLoader`, `AudioPlayer`).
    *   Manages the `currentScene` instance.
    *   Handles global states like `isLoading`, `creativeModeEnabled`, `selectedObjectType`.
    *   Defines placeable object configurations (`PLACEABLE_OBJECT_CONFIG`).
    *   Manages player persistence (`localStorage` for `currentSceneId`, `position`, `inventory`, `equippedItemId`) via `savePlayerData`/`loadPlayerData`. Handles restoring player state on init.
    *   Triggers scene persistence (`IndexedDB`) via `scene.saveState()`.
    *   Loads sounds via `AudioPlayer` during init.
    *   Handles resuming `AudioContext` on user interaction.
    *   Handles clicks on inventory UI (`handleInventoryClick`) to trigger `player.equipItem`.
    *   Delegates `update` and `draw` calls to the `currentScene`.
    *   Calls `Renderer.drawInventoryUI`.
    *   Handles input related to global state changes (creative mode toggle, object selection, saving).
*   **`scene.ts`**: Defines scene structure.
    *   `Scene` (Abstract Class): Base class defining the required interface (`load`, `update`, `draw`, `getId`) and holding common references (renderer, input, assets, player, sceneId, audioPlayer).
    *   `GameScene` (Concrete Class): Represents a playable area.
        *   Manages lists of world objects (`staticObjects`: Trees, Houses) and items on the ground (`droppedItems`).
        *   Stores world dimensions (`worldWidth`, `worldHeight`).
        *   `load()`: Loads scene-specific assets and attempts to load layout state (including tree health, dropped items) from IndexedDB via `loadState()`. Populates defaults if no saved state.
        *   `update()`: Handles game logic based on mode (Gameplay vs. Creative). Updates player, checks collisions (ignoring falling trees), updates camera, handles creative object placement/removal. Handles tool usage (`handleGameplayInput` -> Axe swing, hitbox check, tree damage, trigger sounds/animation), item pickup (`handleItemPickup` -> proximity check, trigger pickup), and timed tree destruction (`setTimeout`, `destroyTreeAndSpawnLogs`).
        *   `draw()`: Renders the scene content (background, static objects, dropped items, player, equipped item animation) using the `Renderer`, applying camera transformations. Renders creative mode UI overlay, item pickup prompts, and tree health bars.
        *   `saveState()`/`loadState()`: Asynchronous methods using `db.ts` helpers to persist/retrieve `staticObjects` (including tree health) and `droppedItems` layout to/from IndexedDB, keyed by `sceneId`.
*   **`renderer.ts`**: Canvas rendering abstraction.
    *   Holds the canvas context (`ctx`).
    *   Manages viewport size and camera coordinates (`cameraX`, `cameraY`).
    *   Provides drawing primitives: `clear`, `drawBackground` (using patterns), `drawImage` (handles rotation), `drawText`, `drawHighlight`, `drawGhostImage`, `drawPickupPrompt`, `drawHealthBar`.
    *   Provides UI drawing methods (screen coordinates): `drawInventoryUI`.
    *   Handles canvas resizing.
*   **`input.ts`**: Input handling.
    *   `InputHandler` class attaches listeners for `keydown`, `keyup`, `mousemove`, `mousedown`.
    *   Tracks pressed keys (`Set<string>`, lowercase for case-insensitivity), mouse position (world: `mousePosition`, screen: `mouseScreenPosition`), single-frame flags (`useToolPressed`, `interactPressed`, `uiMouseClicked`, etc.).
    *   Provides methods to query input state (`isKeyPressed`, `getMovementDirection`).
    *   Resets single-frame flags each update (`resetFrameState`).
    *   Requires `Renderer` reference for coordinate conversion.
*   **`assets.ts`**: Asset management (Images).
    *   `AssetLoader` class loads image assets (SVGs) asynchronously.
    *   Caches loaded images (`HTMLImageElement`) in a `Map`.
    *   Provides methods to load single/multiple images and retrieve cached images.
*   **`audio.ts`**: Asset management (Audio).
    *   `AudioPlayer` class manages loading (`loadSound`) and playback (`play`) of audio files using Web Audio API.
    *   Caches decoded `AudioBuffer`s.
    *   Includes context resume logic.
*   **`player.ts`**: Player entity.
    *   Stores state: `x`, `y`, `width`, `height`, `speed`, `rotation`, `svgPath`.
    *   Stores inventory state: `inventory` (Map), `equippedItemId`.
    *   Stores animation state: `isSwinging`, timers, etc.
    *   `move()` method applies movement based on dx/dy.
    *   `update()` calculates rotation based on mouse position, updates swing animation timer.
    *   Provides inventory methods: `addItem`, `removeItem`, `equipItem`, `unequipItem`, `getEquippedItem`.
    *   Provides animation methods: `startSwing`, `getSwingAngleOffset`.
*   **`tree.ts`, `house.ts`**: Static object entities.
    *   `Tree`: Stores `x`, `y`, `width`, `height`, `svgPath`, `maxHealth`, `currentHealth`, `state` ('STANDING'/'FALLING'). Includes `takeDamage` method.
    *   `House`: Basic position/dimension storage.
*   **`item.ts`**: Item definition module.
    *   Defines `ItemType` enum, `Item` interface, `ITEM_CONFIG` map, `getItemConfig` helper function.
*   **`db.ts`**: IndexedDB persistence layer.
    *   Encapsulates IndexedDB interactions (opening DB, creating store, `put`, `get`).
    *   Provides `async` functions `saveSceneState` and `loadSceneState`.
*   **`npc.ts`, `ui.ts`**: Placeholder modules for future features (NPCs, dedicated UI system).

## 3. Data Flow & State

*   **Initialization:** `main.ts` -> `Game` (creates Renderer, Input, Assets, Audio) -> `Game.init` -> `AudioPlayer.loadSound` -> `loadPlayerData` (localStorage) -> Create `Player` -> Restore Player inventory/equip state (from save data or defaults) -> Create `GameScene` (passing core systems) -> `GameScene.load` -> `AssetLoader.loadImages` -> `loadSceneState` (IndexedDB) -> Populate `staticObjects` & `droppedItems` -> Game loop starts.
*   **Update Cycle:** `Game.update` -> `InputHandler` check (tool use, interact, UI clicks, etc.) -> `Game.handleInventoryClick` (if UI click) -> `Scene.update` -> (`handleGameplayInput` -> Player/Tool actions -> Tree damage/state change -> Trigger sounds/animation -> Schedule destruction; `handleItemPickup`) -> `Player.update` (movement, rotation, animation timer) -> `InputHandler.resetFrameState`.
*   **Draw Cycle:** `Game.draw` -> `Scene.draw` -> `Renderer.clear` -> `Renderer.translate` (camera) -> `Renderer` draw calls for world elements (background, static objects, dropped items, player, equipped item with animation) -> `Renderer` draw calls for overlays (pickup prompts, creative mode UI) -> `Renderer.restore` -> `Game.draw` -> `Renderer.drawInventoryUI`.
*   **State Location:**
    *   Global Game State: `Game` class.
    *   Current Scene Layout: `GameScene.staticObjects`, `GameScene.droppedItems` (persisted to IndexedDB).
    *   Object-Specific State: `Tree` (`currentHealth`, `state`), `Player` (`x`, `y`, `rotation`, `inventory`, `equippedItemId`, animation state).
    *   Player Progress Persistence: `localStorage` (`PlayerSaveData`).
    *   Input State: `InputHandler` class.
    *   Asset Cache: `AssetLoader` (images), `AudioPlayer` (sounds).

## 4. Key Architectural Concepts

*   **Component-Based Design:** Functionality divided into distinct modules/classes.
*   **Scene Management:** Centralized control of game areas via the `Scene` abstraction.
*   **Decoupled Rendering:** `Renderer` hides Canvas API details.
*   **Decoupled Audio:** `AudioPlayer` hides Web Audio API details.
*   **World vs. Screen Coordinates:** Explicit handling via camera translation and separate UI drawing.
*   **Asynchronous Operations:** Asset/sound loading and IndexedDB operations use `async`/`await`.
*   **Dual Persistence:** IndexedDB for scene layout, `localStorage` for player progress.
*   **State Management:** Game state distributed across `Game`, `Scene`, `Player`, `Tree` etc.
*   **Input Handling:** Single-frame flags for actions (`useToolPressed`, `interactPressed`, etc.).
*   **Simple State Machine:** Tree uses `STANDING`/`FALLING` states.
*   **Delayed Actions:** Using `setTimeout` for tree destruction effects.
*   **UI Interaction Handling:** Separating world clicks (`mouseClicked`) from UI clicks (`uiMouseClicked`) and handling inventory clicks in `Game`. 
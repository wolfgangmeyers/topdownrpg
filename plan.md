# Top-Down Action RPG Development Plan

This document outlines the plan for creating a web-based, top-down action RPG using HTML, CSS, JavaScript, and SVG for assets.

## 1. Technology Stack

*   **HTML:** Structure of the game page (`index.html`).
*   **CSS:** Styling for UI elements and potentially some visual effects (`style.css`). The overall visual style will be dark mode with an edgy, retro video game aesthetic.
*   **TypeScript:** Core game logic, interaction, rendering. We'll organize this into modules (e.g., `main.ts`, `game.ts`, `player.ts`, `renderer.ts`, `entityManager.ts`, `terrainManager.ts`, `gameplayController.ts`, `sceneRenderer.ts`, etc.).
*   **SVG:** Vector graphics for characters, items, UI elements, and environment details. Assets will be stored in `assets/svg/`.
*   **Rendering:** We use the **HTML5 Canvas API** for rendering. A core `Renderer` class provides low-level primitives, while a `SceneRenderer` handles drawing specific game world elements (terrain, objects, player).

## 2. Project Setup

*   Create `index.html` in the project root with a `<canvas>` element and `<script type="module" src="/src/main.ts"></script>`.
*   Create `style.css` for basic page and UI styling.
*   Set up the project using Node.js and npm/Vite.
*   Create core TypeScript files within a `src/` directory, following a component-based architecture (see `architecture.md`).
*   Create directories: `src/`, `public/assets/svg/`, `public/assets/audio/` etc.
*   Create a `.gitignore` file.

## 3. Core Mechanics - Phase 1

*   **Rendering Engine:**
    *   Set up the main game loop (`requestAnimationFrame`) in `main.ts` driven by `Game`.
    *   Implement basic canvas drawing functions in `renderer.ts`.
    *   Implement `SceneRenderer` to draw world elements using the core `Renderer`.
    *   Functionality in `assets.ts` (`AssetLoader`) to load SVGs.
*   **Player Character:**
    *   Create `player.svg`.
    *   Implement `player.ts` class/object.
    *   Implement movement logic in `GameplayController` based on input from `input.ts`.
    *   Render the player SVG via `SceneRenderer`.
    *   Implement collision detection with screen/world boundaries (`GameplayController`).
*   **World:**
    *   Define a simple map data structure (e.g., `TerrainManager` using a 2D array for tiles).
    *   Render basic ground tiles via `SceneRenderer` using data from `TerrainManager`.
    *   Implement static obstacles (`EntityManager` managing `Tree`, `House` objects).
    *   Implement collision detection against obstacles (`GameplayController` checking against `EntityManager` data).
    *   Implement a simple camera system in `SceneRenderer` to follow the player.

## 4. Interaction & NPCs - Phase 2

*   **NPCs:**
    *   Create `npc.svg` (distinct from the player).
    *   Implement `npc.ts` class/object (managed by `EntityManager`?).
    *   Place static NPCs on the map.
    *   Implement interaction logic in `GameplayController`: detect player proximity and key press (`E`).
*   **House Entry (Implemented):**
    *   Detect player collision with house door trigger areas (`GameplayController.checkDoorEntry`). House instances now have unique IDs (`crypto.randomUUID`).
    *   Implemented scene transition mechanism (`Game.changeScene`) triggered by door collision. Saves outgoing scene state (via `SceneStateManager`).
    *   Interior scenes use ID format `interior-<houseId>`. If an interior scene doesn't exist in IndexedDB, a default 10x10 wood-floor room is generated (`GameScene.generateDefaultLayout`).
    *   The default interior includes a `DoorExit` object (`doorExit.ts`, using `door-exit.svg`) placed at the bottom center. This object stores the `originSceneId` and `exitTargetPosition` passed as context during the transition.
    *   `GameplayController.checkExitTrigger` handles collision with the `DoorExit` object to trigger the transition back to the origin scene using the stored target data.
    *   `TerrainManager` updated to handle dynamic grid resizing (`resizeGrid`, `setGrid`) for different scene sizes.
    *   `SceneRenderer` updated to handle dynamic world dimensions for correct camera centering in smaller scenes.
    *   House interior scenes are deleted from IndexedDB (`db.deleteSceneState`) when the corresponding House object is deleted in creative mode (`CreativeController`).
*   **Dialogue System:**
    *   Implement `ui.ts` or dedicated UI components to handle UI elements.
    *   Create a simple dialogue box UI (HTML/CSS overlay or drawn on canvas).
    *   Store basic dialogue data (e.g., arrays of strings per NPC).
    *   Display dialogue text when interacting with an NPC.

## 5. Inventory & Items - Phase 3

*   **Items:**
    *   Create SVGs for a few basic items (e.g., `key.svg`, `potion.svg`).
    *   Implement `item.ts` definitions.
    *   Place items on the map (`EntityManager` manages `droppedItems`).
*   **Inventory System:**
    *   Add inventory data structure to `player.ts`.
    *   Implement item pickup logic in `GameplayController` (collision detection, adding to player inventory, removing from `EntityManager`).
    *   Create an inventory screen UI (`Renderer.drawInventoryUI`, potentially a separate UI component later).
    *   Display inventory items in the UI.
    *   Implement item dropping logic (`GameplayController` handling 'G' key, `Game` handling UI clicks, interacting with `Player` and `EntityManager`).

## 6. Combat System (Basic) - Phase 4

*   **Combat Mechanics:**
    *   Define basic stats (HP) for player and enemies (`player.ts`, `enemy.ts`).
    *   Implement a player attack action (e.g., `GameplayController` handling `Spacebar` press).
    *   Visualize the attack (`SceneRenderer` showing player/weapon animation).
*   **Enemies:**
    *   Create `enemy.svg`.
    *   Implement `enemy.ts` class/object (managed by `EntityManager`?).
    *   Basic enemy AI (e.g., move towards player within a certain range - logic potentially in an `AIController` or within `Enemy` class).
    *   Implement collision detection for attacks (`GameplayController` checking player attacks vs enemies, enemies vs player).
    *   Basic damage calculation and health reduction (handled by entity methods, triggered by controllers).
    *   Enemy death/removal (`EntityManager`).
*   **UI:**
    *   Display player HP on the main game screen (`Renderer` drawing HUD, potentially via a UI component).

## 7. Crafting System (Basic) - Phase 6 (Implemented)

*   **Goal:** Allow the player to craft items from resources.
*   **Design Document:** Created `crafting.md` outlining the system.
*   **Core Logic (`crafting/`):**
    *   `recipes.ts`: Defines `CraftingRecipe`, `CraftingIngredient`, holds `CRAFTING_RECIPES`. (Initial: Knife from stick/sharp stone).
    *   `craftingTask.ts`: Defines `CraftingTask` for managing active craft state and timer.
    *   `craftingManager.ts`: Defines `CraftingManager` to handle:
        *   Recipe validation (`canCraft`: checks ingredients, required tool/station - future).
        *   Starting/updating/cancelling tasks.
        *   Ingredient consumption (`Player.hasItem`, `Player.removeItem`).
        *   Output item handling (add to player inventory or drop via `Game.spawnItemNearPlayer`).
*   **UI (`ui/craftingUI.ts`):**
    *   Basic UI panel toggled by 'B' key.
    *   Displays list of available recipes (`CraftingManager.getAvailableRecipes`).
    *   Shows details for selected recipe (output, ingredients, availability indication).
    *   "Craft" button to initiate crafting.
    *   Handles mouse input for selection and crafting.
    *   Pauses other game interactions when open.
    *   Proactively loads ingredient/output icons via `AssetLoader` when opened to prevent missing images.
*   **Integration & Dependencies:**
    *   `Player.hasItem` method added.
    *   `InputHandler` tracks 'B' (toggle UI) and 'ESC' (cancel craft/close UI).
    *   `Renderer` added `drawProgressBar`.
    *   `Game` manages `CraftingManager`, `CraftingUI` instances, `playerIsCrafting` state, updates managers/UI, draws progress bar.
    *   `GameplayController` prevents tool use while crafting.
*   **UI Refinements:**
    *   Recipe name display adjusted.
    *   Unicode arrow `→` used.
    *   Reusable `drawButton` component created (`ui/components/button.ts`) and used in `CraftingUI` and `CreativeModeSelector` for consistent rendering and centered text.

## 8. Refinement & Expansion - Phase 7

*   **Graphics & Animation:** Enhance SVGs, add simple animations.
*   **Content:** Add more NPCs, dialogue, quests, items, recipes, enemies, map areas.
*   **Systems:** Expand inventory, combat, NPC behavior.
*   **Audio:** Integrate sound effects (`AudioPlayer`).
*   **Persistence:** Implement game saving/loading (`SceneStateManager` for scene, `Game` for player progress).
*   **World Management:** Implement utilities to manage the world grid:
    *   "Delete Other Scenes" button in Creative Mode to clean up unused scenes while preserving the current scene and any linked interior scenes.
    *   Scene visualization tools (future enhancement).
*   **Polish:** Bug fixing, performance optimization, balancing.

## 8. Tile-Based Terrain System (Implemented via `TerrainManager`)

*   **Goal:** Replace the single repeating background pattern with a grid-based tile system allowing varied terrain, controllable via creative mode.
*   **Data Structure:**
    *   `tileSize` constant defined in `GameScene`.
    *   `TerrainManager` holds the 2D array (`terrainGrid: string[][]`) storing terrain type IDs.
*   **Configuration (`terrain.ts`):**
    *   Defines `TerrainType`, `TERRAIN_CONFIG` (mapping types to properties like `assetPath`, `isWalkable`).
*   **Asset Loading:**
    *   `GameScene.load` loads all defined terrain tile SVGs.
*   **Rendering:**
    *   `SceneRenderer.drawTerrain` iterates through visible portions of the grid (via `TerrainManager.getTileConfig`) and uses `Renderer.drawTile`.
*   **Persistence:**
    *   `SceneStateManager` saves/loads the `terrainGrid` from `TerrainManager`.
*   **Creative Mode Integration:**
    *   `CreativeController` handles input (clicks) when terrain type is selected.
    *   `CreativeController` calls `TerrainManager.placeTerrainAt` to update the grid.
    *   `SceneRenderer` (using info from `CreativeController`) shows preview/highlight of the selected terrain tile.
    *   `CreativeModeSelector` UI manages terrain selection.
*   **Collision:**
    *   `GameplayController` checks `TerrainManager.isWalkable` before allowing player movement.

This plan provides a roadmap. We can adjust priorities and details as development progresses. 
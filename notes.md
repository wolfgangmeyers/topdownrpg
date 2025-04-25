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
*   **Rendering:** `Renderer` class (`renderer.ts`) encapsulates all Canvas 2D drawing. Clears canvas, applies camera transforms, draws images/patterns/text/UI elements.
*   **Coordinate System:** Distinction between fixed **World Coordinates** (used for game logic, object positions) and **Screen Coordinates** (used for UI fixed to the viewport, like inventory).
*   **Camera:** Managed by `Renderer` (`cameraX`, `cameraY`). `GameScene` updates the camera position in its `update` loop to follow the player, clamped to world boundaries (`worldWidth`, `worldHeight`). Camera translation (`ctx.translate(-cameraX, -cameraY)`) is applied before drawing world elements.
*   **Assets:** SVGs (`public/assets/svg/`) loaded asynchronously via `AssetLoader` (`assets.ts`) into `HTMLImageElement` cache. Ground uses a repeating SVG pattern defined in `ground-pattern.svg`, drawn by `Renderer.drawBackground` covering the world area. Audio files (`.mp3`) are loaded via `AudioPlayer`.
*   **Audio:** `AudioPlayer` class (`audio.ts`) handles loading (`loadSound`) and playing (`play`) sounds using the Web Audio API. Requires context resuming via user interaction (handled in `Game` constructor).

## Game Structure

*   **Scenes:** Abstract `Scene` class with concrete `GameScene` (`scene.ts`). `Game` class holds the `currentScene`. Scenes manage their own objects, update/draw logic, world boundaries, and persistence. `Scene` constructor now requires `AudioPlayer`.
*   **Game Objects:**
    *   `Player` (`player.ts`): Stores position, dimensions, speed, rotation (0 rad = up). Moves via WASD/Arrows, rotates to face mouse. Now includes `inventory` (`Map<string, InventorySlot>`), `equippedItemId` (`string | null`), and methods for item management (`addItem`, `removeItem`, `equipItem`, `unequipItem`, `getEquippedItem`). Also includes animation state (`isSwinging`, `swingTimer`, etc.) and methods (`startSwing`, `getSwingAngleOffset`) for the tool swing animation.
    *   Static Objects (`Tree`, `House`): Managed in `GameScene.staticObjects` array.
        *   `Tree`: Now has `maxHealth`, `currentHealth`, and `state` (`'STANDING'` | `'FALLING'`). `takeDamage` method updates health but doesn't directly signal destruction.
*   **Input:** `InputHandler` (`input.ts`) captures keyboard/mouse events. Translates mouse coordinates to both world (`mousePosition`) and screen (`mouseScreenPosition`). Provides state flags for single-frame actions (`useToolPressed`, `interactPressed`, `uiMouseClicked`, etc.) reset via `resetFrameState`. Stores/checks key presses in lowercase for case-insensitivity (e.g., WASD movement works with Caps Lock).
*   **Collision:** Simple AABB collision detection (`checkCollision` in `GameScene`) implemented between player and `staticObjects`. Player movement collision ignores trees in `'FALLING'` state. Tool usage (axe) uses hitbox collision check against standing trees.
*   **Item System (`item.ts`):** Defines `ItemType` enum, `Item` interface, and `ITEM_CONFIG` map for defining item properties (Axe, Wood Log implemented).
*   **Dropped Items (`scene.ts`):** `DroppedItem` interface defined. `GameScene` manages `droppedItems: DroppedItem[]` list for items on the ground.

## Feature: Axe, Tree Chopping & Inventory (Implemented)

*   **Axe & Chopping:**
    *   Player starts with an Axe equipped (handled in `Game.init`).
    *   Left-clicking (outside creative mode) triggers `useToolPressed` in `InputHandler`.
    *   `GameScene.handleGameplayInput` checks cooldown (`actionCooldown`), equipped item ('axe'), calculates an `axeHitbox` based on player rotation, and checks for collision with `STANDING` trees.
    *   On hit: `axe-hit` sound plays, `Tree.takeDamage` is called, `Player.startSwing` is called.
    *   If tree health drops <= 0: Tree `state` becomes `'FALLING'`, `tree-fall` sound plays, `destroyTreeAndSpawnLogs` is scheduled using `setTimeout` (1s delay). Falling trees are ignored for collision/targeting.
    *   `destroyTreeAndSpawnLogs`: Removes the tree object, spawns a `DroppedItem` ('wood_log') at the tree's location, adds it to `GameScene.droppedItems`.
    *   On miss (or hitting non-standing tree): `axe-miss` sound plays, `Player.startSwing` is called.
*   **Item Pickup:**
    *   `GameScene.handleItemPickup` checks for the closest `DroppedItem` within `pickupRange` of the player.
    *   If an item is close, `Renderer.drawPickupPrompt` displays "E - Pick up [Item Name]".
    *   Pressing 'E' (`interactPressed` flag in `InputHandler`) triggers pickup attempt.
    *   `Player.addItem` is called; if successful, the item is removed from `GameScene.droppedItems`.
*   **Inventory UI:**
    *   Persistently drawn at the bottom-center of the screen by `Renderer.drawInventoryUI` (called from `Game.draw`).
    *   Displays item icons and quantities (for stackable items > 1).
    *   Highlights the currently equipped item with a yellow border.
*   **Equipping via UI:**
    *   Clicking on an inventory slot (`uiMouseClicked` in `InputHandler`) triggers `Game.handleInventoryClick`.
    *   Logic calculates the clicked slot index, finds the corresponding item ID in the player's inventory, and calls `Player.equipItem`.
*   **Visual Feedback:**
    *   Implemented health bar display using `Renderer.drawHealthBar`. Bar appears above damaged, standing trees.

## Persistence

*   **Scene Layout (IndexedDB):** Saves/loads `staticObjects` (including Tree `currentHealth`) and `droppedItems` (ID, position, quantity). Managed by `GameScene.saveState`/`loadState` and `db.ts`. Trees with <= 0 health are not re-added on load.
*   **Player Progress (localStorage):** Saves/loads player `currentSceneId`, `position`, `inventory` (as array), and `equippedItemId`. Handled by `savePlayerData`/`loadPlayerData` and restoration logic in `Game.init`.

## Known Issues / Next Steps (Implied)

*   Only one scene ('defaultForest') implemented.
*   No transitions between scenes.
*   No NPCs or interaction system (beyond item pickup).
*   Collision resolution is basic (stop on contact).
*   Saving is manual (F5); auto-save could be added.
*   No visual feedback for falling trees (they just disappear after delay). Needs animation/tweening.
*   No way to drop items *from* inventory yet.
*   Limited item types (Axe, Wood Log).
*   Swing animation is very basic (simple rotation).
*   No sound for item pickup.
*   Creative mode probably doesn't save/load tree health correctly (uses simpler save format). 
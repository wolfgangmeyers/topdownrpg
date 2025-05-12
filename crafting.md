# Crafting System Design & Implementation Plan

## 1. Overview
The crafting system lets the player convert a set of input items into a single output item.

*   **Always-Known Recipes** – The player does **not** need to learn or unlock recipes. If they hold the required ingredients/tools, the recipe automatically becomes craftable.
*   **Tools & Stations** – Some recipes may require that the player (a) equips a specific tool, and/or (b) is interacting with a crafting station (e.g. Workbench, Furnace).
*   **Timed Actions** – Crafting takes a fixed amount of in-game time. A progress bar is shown. Crafting can be cancelled at any time.
    *   Player **can move** while crafting, but **cannot use tools** or initiate other actions (e.g., inventory, other UI).
*   **Result Handling** – On completion, the crafted item is added to the player's inventory. If the inventory is full, the item is spawned as a dropped item in front of the player.
*   **Initial Scope** – One recipe: **Knife** = `1 stick` + `1 stone_triangular` (no station / tool required, 2 seconds).
*   **Sound Effects**: Will be added later; not part of the initial implementation.

## 2. Player Experience (UX)
1. **Opening the Crafting Panel**
   *  Press **"B"** (for **B**uild) to toggle the crafting UI.
   *  Panel overlays the screen (similar style to inventory/creative panel).
2. **Browsing Recipes**
   *  The panel lists all known recipes in a scrollable grid.
   *  Recipes for which the player lacks ingredients/tools are shown semi-transparent + tooltip "Missing ingredients".
3. **Starting Crafting**
   *  Clicking an available recipe closes the panel and starts the crafting task.
   *  The player enters a **Crafting State**:
        *  Movement disabled (optional – configurable).
        *  A progress bar (center-bottom of screen) shows elapsed time.
        *  "Cancel (ESC)" hint displayed.
4. **Cancelling**
   *  Press **ESC** to cancel. Ingredients are **not** consumed when cancelled. Player control (tool use) restored.
5. **Completion**
   *  On completion, ingredients are removed, output item granted/dropped, sound played (eventually), player control (tool use) restored.

## 3. Data Model
```ts
// craftingRecipe.ts
export interface CraftingIngredient {
    itemId: string;    // e.g. 'stick'
    quantity: number;  // >=1
}

export interface CraftingRecipe {
    id: string;                // e.g. 'knife'
    outputItemId: string;      // e.g. 'knife'
    outputQuantity: number;    // usually 1
    ingredients: CraftingIngredient[];
    durationMs: number;        // crafting time in milliseconds
    requiredToolId?: string;   // item that must be equipped (optional)
    requiredStationId?: string;// static object type player must interact with (optional)
}
```

* Recipes stored in `CRAFTING_RECIPES: Record<string, CraftingRecipe>`.

## 4. Core Classes / Modules
1. **CraftingManager (singleton)**
   *  Holds recipe list, validates craftability (`canCraft(recipe, player)`), starts tasks.
   *  Manages the current `CraftingTask | null`.
   *  Emits events → UI (`onCraftingStarted`, `onCraftingProgress`, `onCraftingCompleted`, `onCraftingCancelled`).
2. **CraftingTask**
   *  Holds `recipe`, `startTime`, `durationMs`.
   *  `update()` called each frame → returns progress 0-1.
3. **CraftingUI** (`ui/craftingPanel.ts`)
   *  Similar structure to `CreativeModeSelector`.
   *  Displays recipe grid, handles clicks.
4. **ProgressBarRenderer** (add to `Renderer` or separate component)
   *  Draws the on-screen progress bar when a task is active.
5. **Integration Points**
   *  **InputHandler** – add `craftingUIPressed` flag for key "B".
   *  **Game.update()** – toggle CraftingUI; if a task is active call `CraftingManager.update(delta)`. Restrict tool usage if crafting task is active.
   *  **Player** – helper `hasItem(id, qty)`, `removeItem(id, qty)`.
   *  **EntityManager** – spawn dropped result if inventory full.

## 5. Implementation Steps
1. **Data Definitions**
   *  Create `src/crafting/recipes.ts` containing the interfaces & recipe list (start with Knife recipe).
2. **CraftingManager**
   *  `startCrafting(recipeId)` – validates requirements, consumes ingredients, creates task.
   *  `cancelCurrentTask()` – restores consumed items.
   *  `update(deltaMs)` – updates task, fires completion.
3. **CraftingUI Panel**
   *  New file `src/ui/craftingPanel.ts`. Follows existing UI patterns.
   *  Shows recipe icon (use output item's asset).
   *  Displays required ingredients/icons when hovered/selected.
4. **Input & Game Loop**
   *  Add key binding **B**.
   *  Game holds `isCraftingPanelOpen` & forwards clicks to `CraftingPanel.update()`.
   *  While crafting task active:
        *  Player movement remains enabled.
        *  Tool use and other primary actions (inventory, attacking) are disabled.
5. **Progress Bar Rendering**
   *  Add method `Renderer.drawProgressBar(x, y, width, height, progress)`.
   *  Game draws it during a crafting task.
6. **Knife Recipe**
```ts
{
  id: 'knife',
  outputItemId: 'knife',
  outputQuantity: 1,
  ingredients: [
      { itemId: 'stick', quantity: 1 },
      { itemId: 'stone_triangular', quantity: 1 }
  ],
  durationMs: 2000
}
```

## 6. Future Extensions
*  Multiple output quantities (e.g. arrows x10).
*  Station objects with UI prompts ("Press E to use Furnace").
*  Queued crafting, bulk crafting, experience gains, recipe discovery.
*  Persistence of tasks across game reloads.

## 7. Open Questions
*  <s>Should the player be able to move while crafting small items?</s> **Decision: Yes, player can move.**
*  <s>Do we need sound effects for start/complete/cancel?</s> **Decision: Yes, eventually. Not for MVP.**

---
End of initial design. Further discussion & approvals required before coding. 
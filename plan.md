# Top-Down Action RPG Development Plan

This document outlines the plan for creating a web-based, top-down action RPG using HTML, CSS, JavaScript, and SVG for assets.

## 1. Technology Stack

*   **HTML:** Structure of the game page (`index.html`).
*   **CSS:** Styling for UI elements and potentially some visual effects (`style.css`). The overall visual style will be dark mode with an edgy, retro video game aesthetic.
*   **TypeScript:** Core game logic, interaction, rendering. We'll organize this into modules (e.g., `main.ts`, `player.ts`, `npc.ts`, `game.ts`, `ui.ts`, `assets.ts`).
*   **SVG:** Vector graphics for characters, items, UI elements, and environment details. Assets will be stored in `assets/svg/`.
*   **Rendering:** Initially, we'll use the **HTML5 Canvas API** for rendering the main game view. SVGs will be loaded and drawn onto the canvas. We may consider direct SVG manipulation in the DOM for UI elements if beneficial.

## 2. Project Setup

*   Create `index.html` in the project root with a `<canvas>` element and `<script type="module" src="/src/main.ts"></script>`.
*   Create `style.css` for basic page and UI styling (e.g., in `css/` or `src/`).
*   Set up the project using Node.js and npm:
    *   Initialize `npm` (`npm init -y`) if not already done.
    *   Install dependencies: `npm install typescript --save-dev` and `npm install vite --save-dev`.
    *   Create/update `tsconfig.json` for TypeScript compiler options (ensure `moduleResolution: 'bundler'` or compatible, `target: 'ESNext'`, `module: 'ESNext'`).
    *   Add scripts to `package.json`:
        *   `"dev": "vite"` (starts dev server)
        *   `"build": "vite build"` (creates production build in `dist/`)
        *   `"preview": "vite preview"` (serves the production build locally)
*   Create core TypeScript files within a `src/` directory:
    *   `main.ts`: Entry point, game loop initialization.
    *   `game.ts`: Main game state management, scene handling.
    *   `renderer.ts`: Handles drawing onto the canvas.
    *   `input.ts`: Manages keyboard/mouse input.
    *   `assets.ts`: Handles loading and management of SVG assets.
*   Create directories: `src/` (for `.ts` files), `css/` (for styles, if separate), `assets/svg/` (for graphics).
*   Create a `.gitignore` file including `node_modules/` and `dist/`.

## 3. Core Mechanics - Phase 1

*   **Rendering Engine:**
    *   Set up the main game loop (`requestAnimationFrame`) in `main.ts`.
    *   Implement basic canvas drawing functions in `renderer.ts`.
    *   Functionality in `assets.ts` to load SVGs (potentially parsing them or drawing them to offscreen canvases).
*   **Player Character:**
    *   Create `player.svg` (more than a basic shape).
    *   Implement `player.ts` class/object.
    *   Implement movement logic in `player.ts` based on input from `input.ts`.
    *   Render the player SVG on the canvas via `renderer.ts`.
    *   Implement collision detection with screen/world boundaries.
*   **World:**
    *   Define a simple map data structure (e.g., 2D array for tiles).
    *   Render basic ground tiles (could be simple colored rects initially, or basic SVGs).
    *   Implement static obstacles (e.g., walls) and collision detection against them.
    *   Implement a simple camera system in `renderer.ts` to follow the player if the map is larger than the canvas.

## 4. Interaction & NPCs - Phase 2

*   **NPCs:**
    *   Create `npc.svg` (distinct from the player).
    *   Implement `npc.ts` class/object.
    *   Place static NPCs on the map.
    *   Implement interaction logic: detect player proximity and key press (`E`).
*   **Dialogue System:**
    *   Implement `ui.ts` to handle UI elements.
    *   Create a simple dialogue box UI (HTML/CSS overlay or drawn on canvas).
    *   Store basic dialogue data (e.g., arrays of strings per NPC).
    *   Display dialogue text when interacting with an NPC.

## 5. Inventory & Items - Phase 3

*   **Items:**
    *   Create SVGs for a few basic items (e.g., `key.svg`, `potion.svg`).
    *   Implement `item.ts` class/object.
    *   Place items on the map.
*   **Inventory System:**
    *   Add inventory data structure to `player.ts` (e.g., an array).
    *   Implement item pickup logic (collision detection, adding to inventory, removing from world).
    *   Create an inventory screen UI in `ui.ts` (toggle with `I` key).
    *   Display inventory items in the UI.

## 6. Combat System (Basic) - Phase 4

*   **Combat Mechanics:**
    *   Define basic stats (HP) for player and enemies in their respective classes (`player.ts`, `enemy.ts`).
    *   Implement a player attack action (e.g., key press `Spacebar`).
    *   Visualize the attack (e.g., brief animation/effect).
*   **Enemies:**
    *   Create `enemy.svg`.
    *   Implement `enemy.ts` class/object.
    *   Basic enemy AI (e.g., move towards player within a certain range).
    *   Implement collision detection for attacks (player hitting enemy, enemy hitting player).
    *   Basic damage calculation and health reduction.
    *   Enemy death/removal.
*   **UI:**
    *   Display player HP on the main game screen (HUD in `ui.ts`).

## 7. Refinement & Expansion - Phase 5

*   **Graphics & Animation:** Enhance SVGs, add simple animations (e.g., walk cycles, attack animations - might involve manipulating SVG elements or using sprite sheets generated from SVGs).
*   **Content:** Add more NPCs, dialogue, quests, items, enemies, map areas.
*   **Systems:** Expand inventory (equipping, using items), combat (skills, different weapons/attacks), NPC behavior (schedules, pathfinding).
*   **Audio:** Integrate sound effects and background music using the Web Audio API.
*   **Persistence:** Implement game saving/loading using `localStorage` or `IndexedDB`.
*   **Polish:** Bug fixing, performance optimization, balancing.

This plan provides a roadmap. We can adjust priorities and details as development progresses. 
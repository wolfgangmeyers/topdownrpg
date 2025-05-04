# Scene Edge Transition Implementation Plan

## Overview
This document outlines the plan for implementing the scene edge transition system. When a player reaches the edge of a scene, a transition to an adjacent scene will occur, creating a new scene if one doesn't exist yet.

## Scene ID Naming Convention
- Format: `world-${randomUUID()}` for new outdoor scenes
- Existing scene IDs (like `defaultForest`) remain unchanged
- Interior scenes will continue using the `interior-${house.id}` format

## Implementation Steps

### 1. Add Scene Link Data to GameScene
- Add properties to `GameScene` to store adjacent scene IDs:
  ```typescript
  private northSceneId: string | null = null;
  private eastSceneId: string | null = null;
  private southSceneId: string | null = null;
  private westSceneId: string | null = null;
  ```
- Include these references in the scene state saved to IndexedDB
- Update `SavedSceneState` interface to include these properties

### 2. Edge Detection & Transition
- Modify `GameplayController.handleMovement` to:
  - Skip boundary clamping for outdoor scenes
  - Maintain boundary clamping for interior scenes (`sceneId.startsWith('interior-')`)
- Implement new `checkSceneEdgeTransition` method:
  - Call this after player movement is processed
  - Check if player position is beyond scene boundaries
  - Determine exit direction (North, East, South, West)
  - Get or generate adjacent scene ID based on direction
  - Calculate target position on opposite side of new scene
  - Call `game.changeScene` with appropriate context data

### 3. Scene Creation Logic
- When a player exits a scene where no adjacent scene exists yet:
  - Generate a new scene ID: `world-${crypto.randomUUID()}`
  - Update directional links in both current and new scene (bidirectional)
  - Generate default terrain and objects for the new scene (similar to forest)

### 4. Scene Persistence
- Update `SceneStateManager.saveState` to include adjacent scene IDs
- Update `SceneStateManager.loadState` to restore these references
- Update `SavedSceneState` interface in both `scene.ts` and `db.ts`

### 5. Interior Scene Handling
- Add condition to skip edge transition for interior scenes
- Maintain the current boundary clamping for interior scenes to prevent players from leaving them

## Implementation Details

### Scene Edge Detection
Use player position relative to world dimensions to detect when the player crosses a scene boundary:
```typescript
if (player.x < 0) {
  // West edge exit
} else if (player.x > worldWidth) {
  // East edge exit
} else if (player.y < 0) {
  // North edge exit
} else if (player.y > worldHeight) {
  // South edge exit
}
```

### Player Positioning During Transition
When transitioning, place the player at the opposite edge of the new scene, maintaining the same relative position along that edge:
- North → South: Place at bottom edge, same X coordinate
- East → West: Place at left edge, same Y coordinate
- South → North: Place at top edge, same X coordinate
- West → East: Place at right edge, same Y coordinate

### Edge Direction Naming
Define a Direction enum for clarity and consistency:
```typescript
enum Direction {
  NORTH,
  EAST,
  SOUTH,
  WEST
}
```

### Bidirectional Scene Linking
When creating a new scene, set up bidirectional links:
- If exiting current scene to the North, set new scene's South link to current scene ID
- If exiting current scene to the East, set new scene's West link to current scene ID
- If exiting current scene to the South, set new scene's North link to current scene ID
- If exiting current scene to the West, set new scene's East link to current scene ID 
# Scene Transition System Architecture

## Overview

The Scene Transition System has been refactored into a dedicated module to improve code organization and maintainability. This document explains the architecture and responsibilities of the new system.

## Components

### SceneTransitionSystem

The `SceneTransitionSystem` class is responsible for handling all scene transitions in the game:

- **Scene Edge Transitions**: When a player crosses the edge of an outdoor scene grid
- **Interior Entry Transitions**: When a player enters a house
- **Interior Exit Transitions**: When a player uses an exit door in an interior scene

## Responsibilities

The system encapsulates the following functionality:

1. **Edge Detection**: Determining when the player has reached the edge of an outdoor scene
2. **Direction Calculation**: Identifying which direction the player is exiting the scene
3. **Grid Coordinates**: Managing the coordinate system for the world grid (world-x-y format)
4. **Scene Adjacency**: Creating and maintaining bidirectional links between adjacent scenes
5. **House Entry**: Detecting when a player enters a house and transitioning to the interior scene
6. **Exit Detection**: Managing exit points from interior scenes back to the exterior world

## Class Structure

The `SceneTransitionSystem` class contains the following key methods:

- `update()`: Main entry point called during the game loop
- `checkSceneEdgeTransition()`: Checks for transitions between outdoor grid scenes
- `checkDoorEntry()`: Checks for entering houses
- `checkExitTrigger()`: Checks for exiting interior scenes via exit doors

## Integration

The system is integrated with the game architecture as follows:

1. The `GameplayController` instantiates the `SceneTransitionSystem`
2. During the update loop, the controller calls `transitionSystem.update()`
3. The transition system handles all scene changes through the `Game.changeScene()` method

## Direction Enum

The system uses a Direction enum to represent the four cardinal directions:
- NORTH
- EAST
- SOUTH
- WEST

This is used for bidirectional scene linking and calculating adjacent scene coordinates.

## Benefits of Refactoring

- **Separation of Concerns**: The GameplayController now focuses on player movement and actions
- **Improved Maintainability**: Scene transition logic is centralized in one class
- **Easier Extensions**: New transition types can be added without modifying the gameplay controller
- **Better Testability**: The transition system can be tested independently

## Future Improvements

Potential future improvements to the system:
- Add support for more complex scene transitions (e.g., teleporters, portals)
- Enhance the transition effects with animations
- Support for multi-floor interior scenes with staircases
- Add custom transition points within scenes 
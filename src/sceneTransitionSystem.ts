import { Game } from './game';
import { Player } from './player';
import { EntityManager } from './entityManager';
import { House } from './house';
import { DoorExit } from './doorExit';

// Define interfaces needed
interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Direction enum
export enum Direction {
    NORTH = 'north',
    EAST = 'east',
    SOUTH = 'south',
    WEST = 'west'
}

/**
 * SceneTransitionSystem handles all scene transition logic:
 * - Scene edge transitions (outdoor grid navigation)
 * - Interior entry (entering houses)
 * - Interior exit (exiting houses via doors)
 */
export class SceneTransitionSystem {
    // Edge transition detection threshold
    private readonly threshold: number = 2;

    constructor(
        private game: Game,
        private player: Player,
        private entityManager: EntityManager
    ) {}

    /**
     * Main update method - checks all possible transitions
     */
    public update(): void {
        // Skip edge transitions for interior scenes
        const currentSceneId = this.game.getCurrentSceneId();
        const isInteriorScene = currentSceneId.startsWith('interior-');
        
        if (!isInteriorScene) {
            this.checkSceneEdgeTransition();
            this.checkDoorEntry();
        } else {
            this.checkExitTrigger();
        }
    }

    /**
     * Check if player is at a scene edge and should transition to adjacent scene
     */
    private checkSceneEdgeTransition(): void {
        // Get current scene from game
        const currentScene = this.game.getCurrentScene();
        if (!currentScene) return;

        // Get world dimensions
        const dimensions = currentScene.getWorldDimensions();
        const worldWidth = dimensions.width;
        const worldHeight = dimensions.height;

        // Check if player is near or beyond scene boundaries
        let direction: Direction | null = null;
        let targetPosition = { x: this.player.x, y: this.player.y };

        // Determine exit direction and calculate entry position
        const halfWidth = this.player.width / 2;
        const halfHeight = this.player.height / 2;
        
        // Check actual position with a small threshold
        if (this.player.x <= this.threshold) {
            direction = Direction.WEST;
            targetPosition.x = worldWidth - halfWidth; // Place at right edge
        } else if (this.player.x >= worldWidth - this.threshold) {
            direction = Direction.EAST;
            targetPosition.x = halfWidth; // Place at left edge
        } else if (this.player.y <= this.threshold) {
            direction = Direction.NORTH;
            targetPosition.y = worldHeight - halfHeight; // Place at bottom edge
        } else if (this.player.y >= worldHeight - this.threshold) {
            direction = Direction.SOUTH;
            targetPosition.y = halfHeight; // Place at top edge
        }

        // If not at an edge, return
        if (!direction) return;

        const currentSceneId = this.game.getCurrentSceneId();
        let sceneX = 0;
        let sceneY = 0;
        let parsedSuccessfully = false;

        // Try parsing new format: world_X_Y (e.g., world_0_0, world_-1_0)
        if (currentSceneId.startsWith("world_")) {
            const parts = currentSceneId.substring("world_".length).split('_');
            if (parts.length === 2) {
                const xVal = parseInt(parts[0]);
                const yVal = parseInt(parts[1]);
                if (!isNaN(xVal) && !isNaN(yVal)) {
                    sceneX = xVal;
                    sceneY = yVal;
                    parsedSuccessfully = true;
                }
            }
        }

        // If new format parsing failed or wasn't applicable, try parsing old format: world-X-Y (e.g., world-0-0, world--1-0)
        if (!parsedSuccessfully && currentSceneId.startsWith("world-")) {
            const oldFormatRegex = /^world-(-?\d+)-(-?\d+)$/;
            const match = currentSceneId.match(oldFormatRegex);
            if (match && match.length === 3) {
                const xVal = parseInt(match[1]);
                const yVal = parseInt(match[2]);
                if (!isNaN(xVal) && !isNaN(yVal)) {
                    sceneX = xVal;
                    sceneY = yVal;
                    parsedSuccessfully = true;
                }
            }
        }

        if (!parsedSuccessfully) {
            // Fallback for initial scene like "defaultForest" or if parsing completely fails
            // For "world-0-0" (old format but positive), regex should handle it.
            // If currentSceneId is something like "defaultForest" (no longer used for dynamic scenes) or truly unparseable
            console.warn(`Could not parse scene coordinates from ID: ${currentSceneId}. Defaulting to 0,0 for coordinate calculation purposes.`);
            sceneX = 0; 
            sceneY = 0; 
        }
        
        // Calculate new scene coordinates based on direction
        switch(direction) {
            case Direction.NORTH: sceneY--; break;
            case Direction.EAST: sceneX++; break;
            case Direction.SOUTH: sceneY++; break;
            case Direction.WEST: sceneX--; break;
        }
        
        // Create the new scene ID using grid coordinates with UNDERSCORE separator
        const newSceneId = `world_${sceneX}_${sceneY}`;

        // Get adjacent scene ID 
        let adjacentSceneId = currentScene.getAdjacentSceneId(direction.toLowerCase() as 'north' | 'east' | 'south' | 'west');

        // If no adjacent scene exists yet, create a new one with the grid-based ID
        if (!adjacentSceneId) {
            adjacentSceneId = newSceneId;
            
            // Update bidirectional links
            const oppositeDirection = this.getOppositeDirection(direction);
            
            // Update current scene with link to new scene
            currentScene.setAdjacentSceneId(direction.toLowerCase() as 'north' | 'east' | 'south' | 'west', adjacentSceneId);
            
            // Save current scene state to ensure the link is persisted
            currentScene.save();

            // Create context data with reverse link
            const contextData = {
                isNewScene: true,
                linkedDirection: oppositeDirection,
                linkedSceneId: this.game.getCurrentSceneId(),
                targetPosition: targetPosition
            };

            // Transition to the new scene
            this.game.changeScene(adjacentSceneId, contextData);
        } else {
            // Transition to existing adjacent scene
            this.game.changeScene(adjacentSceneId, { targetPosition });
        }
    }

    /**
     * Check if player is at a house door and should enter the house
     */
    private checkDoorEntry(): void {
        for (const obj of this.entityManager.staticObjects) {
            if (obj instanceof House) {
                const house = obj;
                
                // Calculate door bounds
                const doorWidth = house.width / 4;
                const doorTopMargin = 15; 
                const doorBottomMargin = 20;
                const doorXOffset = 0; 
                const houseBottomY = house.y + house.height / 2;
                const doorTopY = houseBottomY - doorTopMargin;
                const doorBottomY = houseBottomY + doorBottomMargin;
                const doorHeight = doorBottomY - doorTopY;
                const doorX = house.x - doorWidth / 2 + doorXOffset; 
                const doorBounds: BoundingBox = { 
                    x: doorX, 
                    y: doorTopY, 
                    width: doorWidth, 
                    height: doorHeight 
                }; 
                
                const playerCenterX = this.player.x;
                const playerCenterY = this.player.y;
                
                // Check if player center is inside the door bounds
                if (playerCenterX >= doorBounds.x && 
                    playerCenterX <= doorBounds.x + doorBounds.width &&
                    playerCenterY >= doorBounds.y && 
                    playerCenterY <= doorBounds.y + doorBounds.height) {
                    
                    const interiorSceneId = `interior-${house.id}`;
                    const originSceneId = this.game.getCurrentSceneId();
                    const exitTargetPosition = { x: playerCenterX, y: house.y + house.height + 15 };
                    
                    console.log(`Player entered door of House ID: ${house.id}. Triggering scene change to [${interiorSceneId}]...`);
                    
                    // Call changeScene with context data
                    this.game.changeScene(interiorSceneId, {
                        originSceneId: originSceneId,
                        exitTargetPosition: exitTargetPosition
                    }); 
                    return; // Exit loop once a door is entered
                }
            }
        }
    }

    /**
     * Check if player is on an exit door and should exit the interior
     */
    private checkExitTrigger(): void {
        // Only log if debug is needed
        // console.log(`Checking for exit triggers: ${this.entityManager.staticObjects.length} static objects`); 
        
        for (const obj of this.entityManager.staticObjects) {
            // Check if the object is a DoorExit
            if (obj instanceof DoorExit) {
                const exitDoor = obj;
                
                // Check collision between player center and the door exit bounds
                // Use simple AABB check with player center as a point
                const playerBounds: BoundingBox = { 
                    x: this.player.x, 
                    y: this.player.y, 
                    width: 1, 
                    height: 1 
                };
                
                const doorBounds: BoundingBox = { 
                    x: exitDoor.x, 
                    y: exitDoor.y, 
                    width: exitDoor.width, 
                    height: exitDoor.height 
                };
                
                if (this.checkCollision(playerBounds, doorBounds)) {
                    // Check if the door has a valid target
                    if (exitDoor.targetSceneId && exitDoor.targetPosition) {
                        console.log(`Player collided with DoorExit. Target: Scene=${exitDoor.targetSceneId}`);
                        // Trigger scene change with the target position
                        this.game.changeScene(exitDoor.targetSceneId, { 
                            targetPosition: exitDoor.targetPosition 
                        });
                        return; // Exit loop after triggering
                    } else {
                        console.warn(`Player collided with DoorExit, but it has no valid targetSceneId or targetPosition.`);
                    }
                }
            }
        }
    }

    /**
     * Helper to get opposite direction
     */
    private getOppositeDirection(direction: Direction): 'north' | 'east' | 'south' | 'west' {
        switch (direction) {
            case Direction.NORTH: return 'south';
            case Direction.EAST: return 'west';
            case Direction.SOUTH: return 'north';
            case Direction.WEST: return 'east';
        }
    }

    /**
     * Simple AABB collision check helper
     */
    private checkCollision(rect1: BoundingBox, rect2: BoundingBox): boolean {
        const halfWidth1 = rect1.width / 2;
        const halfHeight1 = rect1.height / 2;
        const halfWidth2 = rect2.width / 2;
        const halfHeight2 = rect2.height / 2;

        // Check for overlap on both axes
        const collisionX = (rect1.x - halfWidth1 < rect2.x + halfWidth2) && 
                          (rect1.x + halfWidth1 > rect2.x - halfWidth2);
        const collisionY = (rect1.y - halfHeight1 < rect2.y + halfHeight2) && 
                          (rect1.y + halfHeight1 > rect2.y - halfHeight2);

        return collisionX && collisionY;
    }
} 
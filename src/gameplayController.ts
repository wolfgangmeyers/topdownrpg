import { InputHandler } from './input';
import { Player } from './player';
import { EntityManager } from './entityManager'; // Import EntityManager
import { DroppedItem } from './droppedItem'; // Import DroppedItem
import { TerrainManager } from './terrainManager';
import { AudioPlayer } from './audio';
import { ItemType } from './item'; // Import ItemType
import { Tree } from './tree'; // Import Tree for instanceof check
import { House } from './house'; // Import House type if needed
import { DoorExit } from './doorExit'; // Import DoorExit
import { Game } from './game'; // Import Game

// Define a simple structure for collision checks
interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// --- Direction Enum ---
enum Direction {
    NORTH = 'north',
    EAST = 'east',
    SOUTH = 'south',
    WEST = 'west'
}
// --- End Direction Enum ---

export class GameplayController {
    private closestPickupItem: DroppedItem | null = null;
    private readonly pickupRange: number = 50; // Max distance to show pickup prompt (Squared later)
    private lastActionTime: number = 0;
    private readonly actionCooldown: number = 500; // Milliseconds

    constructor(
        private game: Game, // Add Game instance
        private inputHandler: InputHandler,
        private player: Player,
        private entityManager: EntityManager,
        private terrainManager: TerrainManager,
        private audioPlayer: AudioPlayer,
        private worldWidth: number, // Needed for boundaries
        private worldHeight: number, // Needed for boundaries
        private tileSize: number // Needed for terrain checks
    ) {}

    update(deltaTime: number): void {
        // DEBUG: Force player beyond boundary with number keys
        if (this.inputHandler.isKeyPressed('1')) {
            // Force player beyond left edge
            this.player.x = -60; // Use a much larger negative value
            console.log(`DEBUG KEY 1: Forcing player to X=${this.player.x}`); 
        } else if (this.inputHandler.isKeyPressed('2')) {
            // Force player beyond right edge
            const width = this.game.getCurrentScene().getWorldDimensions().width;
            this.player.x = width + 60; // Use a much larger positive value
            console.log(`DEBUG KEY 2: Forcing player to X=${this.player.x}`);
        } else if (this.inputHandler.isKeyPressed('3')) {
            // Force player beyond top edge
            this.player.y = -60; // Use a much larger negative value
            console.log(`DEBUG KEY 3: Forcing player to Y=${this.player.y}`);
        } else if (this.inputHandler.isKeyPressed('4')) {
            // Force player beyond bottom edge
            const height = this.game.getCurrentScene().getWorldDimensions().height;
            this.player.y = height + 60; // Use a much larger positive value
            console.log(`DEBUG KEY 4: Forcing player to Y=${this.player.y}`);
        }
        
        this.handleMovement(deltaTime);
        this.checkSceneEdgeTransition();
        this.handleToolUsage();
        this.handleItemPickup();
        this.handleItemDrop();
        this.checkExitTrigger();
        this.updateClosestPickupItem();
    }

    // --- Getters for UI / Debug --- 
    getClosestPickupItem(): DroppedItem | null {
        return this.closestPickupItem;
    }

    // --- End Getters ---


    private handleMovement(deltaTime: number): void {
        const { dx, dy } = this.inputHandler.getMovementDirection();
        if (dx === 0 && dy === 0) return; // No movement input

        const currentSpeed = this.player.speed;
        const oldX = this.player.x;
        const oldY = this.player.y;

        // Calculate proposed new position
        const proposedX = oldX + dx * currentSpeed * deltaTime * 60; // Use scaled delta time
        const proposedY = oldY + dy * currentSpeed * deltaTime * 60;

        // Get world dimensions for bounds checking
        const dimensions = this.game.getCurrentScene().getWorldDimensions();
        const worldWidth = dimensions.width;
        const worldHeight = dimensions.height;

        // --- Terrain Collision Check ---
        const targetGridX = Math.floor(proposedX / this.tileSize);
        const targetGridY = Math.floor(proposedY / this.tileSize);
        let canMoveToTile = true; // Default to true instead of checking terrain

        // Only check terrain within bounds - allow moving beyond bounds
        if (targetGridX >= 0 && targetGridX < dimensions.width / this.tileSize &&
            targetGridY >= 0 && targetGridY < dimensions.height / this.tileSize) {
            canMoveToTile = this.terrainManager.isWalkable(targetGridX, targetGridY);
        }

        let finalX = oldX;
        let finalY = oldY;

        if (canMoveToTile) {
            finalX = proposedX;
            finalY = proposedY;
            
            // Check if we're in an interior scene
            const isInteriorScene = this.game.getCurrentSceneId().startsWith('interior-');
            
            // Only apply boundary clamping for interior scenes
            if (isInteriorScene) {
                // Apply boundaries for interior scenes only
                const clampedPos = this.clampToBoundaries({ x: finalX, y: finalY, width: this.player.width, height: this.player.height });
                finalX = clampedPos.x;
                finalY = clampedPos.y;
            }
            // For outdoor scenes, allow moving beyond boundaries for scene transitions
        } else {
            // Prevent movement into non-walkable terrain
            finalX = oldX;
            finalY = oldY;
        }


        // --- Object Collision Check ---
        // Create a temporary bounding box for the player's potential new position
        const playerMoved = (finalX !== oldX || finalY !== oldY);
        let blockMovement = false; // Flag to indicate if movement should be blocked

        if (playerMoved) {
            const playerBounds: BoundingBox = { x: finalX, y: finalY, width: this.player.width, height: this.player.height };
            let collisionDetected = false;
            for (const obj of this.entityManager.staticObjects) {
                // Ignore collision with falling trees
                if (obj instanceof Tree && obj.state === 'FALLING') {
                    continue;
                }
                
                // Ignore collision with DoorExit objects for movement blocking
                if (obj instanceof DoorExit) {
                    continue;
                }
                
                // Define the object's bounds for collision check
                let objBounds: BoundingBox;
                if (obj instanceof House) {
                    // For houses, use a slightly shorter bounding box to allow overlap with the door area
                    const collisionHeight = obj.height - 10; // Exclude bottom 10 pixels (door area)
                    objBounds = {
                        x: obj.x,
                        y: obj.y - 5, // Adjust center slightly upwards to match reduced height
                        width: obj.width,
                        height: collisionHeight
                    };
                } else {
                    // For other objects (Trees), use the full bounding box
                    objBounds = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
                }

                if (EntityManager.checkCollision(playerBounds, objBounds)) { // Use static checkCollision
                    collisionDetected = true;
                    break;
                }
            }

            // If collision with an object, revert to the original position
            if (collisionDetected) {
                finalX = oldX;
                finalY = oldY;
            }
        }

        // Apply movement restriction *after* checking all relevant objects
        if (blockMovement) {
            finalX = oldX;
            finalY = oldY;
        }

        // Apply the final position
        this.player.x = finalX;
        this.player.y = finalY;

        // --- House and exit checks ---
        this.checkDoorEntry(); // Check for house entry
    }

    // --- Door Entry Check Method (New) ---
    private checkDoorEntry(): void {
        for (const obj of this.entityManager.staticObjects) {
            if (obj instanceof House) {
                const house = obj; // Now we have the specific house instance
                
                // --- Calculate door bounds (Offset already adjusted to 15) --- 
                const doorWidth = house.width / 4;
                const doorTopMargin = 15; 
                const doorBottomMargin = 60; 
                const doorXOffset = 0; 
                const houseBottomY = house.y + house.height / 2;
                const doorTopY = houseBottomY - doorTopMargin;
                const doorBottomY = houseBottomY + doorBottomMargin;
                const doorHeight = doorBottomY - doorTopY;
                const doorX = house.x - doorWidth / 2 + doorXOffset; 
                const doorBounds: BoundingBox = { x: doorX, y: doorTopY, width: doorWidth, height: doorHeight }; 
                
                const playerCenterX = this.player.x;
                const playerCenterY = this.player.y;
                
                // Check if player center is inside the door bounds
                if (playerCenterX >= doorBounds.x && playerCenterX <= doorBounds.x + doorBounds.width &&
                    playerCenterY >= doorBounds.y && playerCenterY <= doorBounds.y + doorBounds.height) {
                    
                    const interiorSceneId = `interior-${house.id}`;
                    const originSceneId = this.game.getCurrentSceneId(); // Get the ID of the scene we are leaving
                    const exitTargetPosition = { x: playerCenterX, y: playerCenterY + 40 }; // Position slightly below entry
                    
                    console.log(`Player entered door of House ID: ${house.id}. Triggering scene change to [${interiorSceneId}]...`);
                    console.log(`  Origin scene: ${originSceneId}, Exit target pos: (${exitTargetPosition.x.toFixed(0)}, ${exitTargetPosition.y.toFixed(0)})`);
                    
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
    // --- End Door Entry Check Method ---

    private handleToolUsage(): void {
        if (!this.inputHandler.useToolPressed) return;

        const now = Date.now();
        if (now - this.lastActionTime < this.actionCooldown) return; // Action on cooldown

        this.lastActionTime = now;
        const equippedItem = this.player.getEquippedItem();

        if (!equippedItem) {
            console.log("Cannot use tool, nothing equipped.");
            // TODO: Play 'empty hand' sound?
            return;
        }

        if (equippedItem.itemType !== ItemType.TOOL) {
            console.log(`Cannot use item '${equippedItem.name}' as a tool.`);
            // TODO: Play 'cannot use' sound?
            return;
        }

        // Assume it's a tool, start animation
        this.player.startSwing();

        if (equippedItem.id === 'axe') {
            // Specific Axe Logic
            console.log("Axe Swing Attempt");

            // Define hitbox based on player position and rotation
            const reachDistance = 50;
            const hitboxWidth = 20;
            const hitboxHeight = 20;
            const angle = this.player.rotation - Math.PI / 2; // Adjust rotation
            const hitboxX = this.player.x + Math.cos(angle) * reachDistance; // Center of hitbox
            const hitboxY = this.player.y + Math.sin(angle) * reachDistance; // Center of hitbox
            const axeHitbox: BoundingBox = { x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight };


            let hitTree: Tree | null = null;
             for (const obj of this.entityManager.staticObjects) {
                 if (obj instanceof Tree && obj.state === 'STANDING') {
                     const treeBounds: BoundingBox = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
                     if (this.checkCollision(axeHitbox, treeBounds)) {
                         hitTree = obj;
                         break;
                     }
                 }
             }


            if (hitTree) {
                console.log("Hit Tree!");
                this.audioPlayer.play('axe-hit');
                hitTree.takeDamage(25); // Example damage
                console.log(`Tree health: ${hitTree.currentHealth}/${hitTree.maxHealth}`);

                if (hitTree.currentHealth <= 0) {
                    console.log("Tree Felled!");
                    hitTree.state = 'FALLING';
                    this.audioPlayer.play('tree-fall');
                    // Schedule destruction via EntityManager
                    setTimeout(() => this.entityManager.destroyTreeAndSpawnLogs(hitTree!), 1000);
                }
            } else {
                console.log("Axe Missed!");
                this.audioPlayer.play('axe-miss');
            }
        } else {
            // Handle other tools later?
            console.log(`Swinging tool: ${equippedItem.name} (no specific action implemented)`);
            this.audioPlayer.play('axe-miss'); // Use miss sound as default for now
        }
    }

     // Calculates the closest item within pickup range for UI prompt
    private updateClosestPickupItem(): void {
        let closestDistSq = this.pickupRange * this.pickupRange; // Check squared distance
        this.closestPickupItem = null; // Reset each frame

        for (const item of this.entityManager.droppedItems) {
            const dx = this.player.x - item.x;
            const dy = this.player.y - item.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDistSq) {
                closestDistSq = distSq;
                this.closestPickupItem = item;
            }
        }
    }

    private handleItemPickup(): void {
        if (!this.inputHandler.interactPressed || !this.closestPickupItem) return;

        // Attempt to add to player inventory
        const success = this.player.addItem(this.closestPickupItem.itemConfig.id, this.closestPickupItem.quantity);
        if (success) {
            // Remove from world via EntityManager
            this.entityManager.removeDroppedItem(this.closestPickupItem); // Need to add this method to EntityManager
            console.log(`Picked up ${this.closestPickupItem.itemConfig.name}`);
            this.audioPlayer.play('pickup');
            this.closestPickupItem = null; // Clear the prompt
        } else {
            console.log(`Inventory full, cannot pick up ${this.closestPickupItem.itemConfig.name}`);
            // TODO: Play 'cannot pickup' sound or show message
        }
    }


    private handleItemDrop(): void {
         if (!this.inputHandler.dropItemPressed) return;

         const droppedItemId = this.player.dropEquippedItem();
         if (droppedItemId) {
             // Spawn item slightly in front of the player
             const dropDistance = 30;
             const angle = this.player.rotation - Math.PI / 2;
             const dropX = this.player.x + Math.cos(angle) * dropDistance;
             const dropY = this.player.y + Math.sin(angle) * dropDistance;

             // Use EntityManager to spawn
             this.entityManager.spawnDroppedItem(droppedItemId, dropX, dropY, 1);
             // Save state? (Responsibility of Game/Scene)
         }
    }

     // --- Collision Helpers ---

    private clampToBoundaries(entity: BoundingBox): { x: number, y: number } {
        const halfWidth = entity.width / 2;
        const halfHeight = entity.height / 2;
        let x = entity.x;
        let y = entity.y;

        // Left boundary
        if (x < halfWidth) x = halfWidth;
        // Right boundary
        if (x > this.worldWidth - halfWidth) x = this.worldWidth - halfWidth;
        // Top boundary
        if (y < halfHeight) y = halfHeight;
        // Bottom boundary
        if (y > this.worldHeight - halfHeight) y = this.worldHeight - halfHeight;

        return { x, y };
    }


    // Simple AABB collision check helper
    private checkCollision(rect1: BoundingBox, rect2: BoundingBox): boolean {
        const halfWidth1 = rect1.width / 2;
        const halfHeight1 = rect1.height / 2;
        const halfWidth2 = rect2.width / 2;
        const halfHeight2 = rect2.height / 2;

        // Check for overlap on both axes
        const collisionX = (rect1.x - halfWidth1 < rect2.x + halfWidth2) && (rect1.x + halfWidth1 > rect2.x - halfWidth2);
        const collisionY = (rect1.y - halfHeight1 < rect2.y + halfHeight2) && (rect1.y + halfHeight1 > rect2.y - halfHeight2);

        return collisionX && collisionY;
    }
    // --- End Collision Helpers ---

    // --- Exit Trigger Check Method --- 
    private checkExitTrigger(): void {
        // Debug log to check if the method is being called
        console.log(`Checking for exit triggers: ${this.entityManager.staticObjects.length} static objects`); 
        
        // Check specifically for DoorExit objects
        const doorExits = this.entityManager.staticObjects.filter(obj => obj instanceof DoorExit);
        console.log(`Found ${doorExits.length} DoorExit objects`);
        
        if (doorExits.length > 0) {
            // Log properties of each exit door
            doorExits.forEach((door, i) => {
                const exit = door as DoorExit;
                console.log(`DoorExit #${i}: position (${exit.x.toFixed(0)}, ${exit.y.toFixed(0)}), targetSceneId: ${exit.targetSceneId}, has target position: ${exit.targetPosition !== null}`);
            });
        }
        
        for (const obj of this.entityManager.staticObjects) {
            // Check if the object is a DoorExit
            if (obj instanceof DoorExit) {
                const exitDoor = obj;
                
                // Check collision between player center and the door exit bounds
                // Use simple AABB check with player center as a point
                const playerBounds: BoundingBox = { x: this.player.x, y: this.player.y, width: 1, height: 1 };
                const doorBounds: BoundingBox = { x: exitDoor.x, y: exitDoor.y, width: exitDoor.width, height: exitDoor.height };
                
                if (EntityManager.checkCollision(playerBounds, doorBounds)) {
                    // Check if the door has a valid target
                    if (exitDoor.targetSceneId && exitDoor.targetPosition) {
                        console.log(`Player collided with DoorExit. Target: Scene=${exitDoor.targetSceneId}, Pos=(${exitDoor.targetPosition.x.toFixed(0)}, ${exitDoor.targetPosition.y.toFixed(0)})`);
                        // Trigger scene change with the target position
                        this.game.changeScene(exitDoor.targetSceneId, { targetPosition: exitDoor.targetPosition });
                        return; // Exit loop after triggering
                    } else {
                        console.warn(`Player collided with DoorExit, but it has no valid targetSceneId or targetPosition.`);
                    }
                }
            }
        }
    }
    // --- End Exit Trigger Check ---

    private checkSceneEdgeTransition(): void {
        // Skip for interior scenes
        const currentSceneId = this.game.getCurrentSceneId();
        if (currentSceneId.startsWith('interior-')) {
            return;
        }

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
        
        // Use a small threshold for near-boundary detection
        const threshold = 2;

        // Check actual position with a small threshold
        if (this.player.x <= threshold) {
            direction = Direction.WEST;
            targetPosition.x = worldWidth - halfWidth; // Place at right edge
        } else if (this.player.x >= worldWidth - threshold) {
            direction = Direction.EAST;
            targetPosition.x = halfWidth; // Place at left edge
        } else if (this.player.y <= threshold) {
            direction = Direction.NORTH;
            targetPosition.y = worldHeight - halfHeight; // Place at bottom edge
        } else if (this.player.y >= worldHeight - threshold) {
            direction = Direction.SOUTH;
            targetPosition.y = halfHeight; // Place at top edge
        }

        // If not at an edge, return
        if (!direction) return;

        // Parse current scene coordinates
        const [scenePrefix, sceneXStr, sceneYStr] = currentSceneId.split('-');
        let sceneX = parseInt(sceneXStr) || 0;
        let sceneY = parseInt(sceneYStr) || 0;
        
        // Calculate new scene coordinates based on direction
        switch(direction) {
            case Direction.NORTH: sceneY--; break;
            case Direction.EAST: sceneX++; break;
            case Direction.SOUTH: sceneY++; break;
            case Direction.WEST: sceneX--; break;
        }
        
        // Create the new scene ID using grid coordinates
        const newSceneId = `world-${sceneX}-${sceneY}`;

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
                linkedSceneId: currentSceneId,
                targetPosition: targetPosition
            };

            // Transition to the new scene
            this.game.changeScene(adjacentSceneId, contextData);
        } else {
            // Transition to existing adjacent scene
            this.game.changeScene(adjacentSceneId, { targetPosition });
        }
    }

    // Helper to get opposite direction
    private getOppositeDirection(direction: Direction): 'north' | 'east' | 'south' | 'west' {
        let result: 'north' | 'east' | 'south' | 'west';
        switch (direction) {
            case Direction.NORTH: result = 'south'; break;
            case Direction.EAST: result = 'west'; break;
            case Direction.SOUTH: result = 'north'; break;
            case Direction.WEST: result = 'east'; break;
        }
        return result;
    }
} 
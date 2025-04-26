import { InputHandler } from './input';
import { Player } from './player';
import { EntityManager } from './entityManager'; // Import EntityManager
import { DroppedItem } from './droppedItem'; // Import DroppedItem
import { TerrainManager } from './terrainManager';
import { AudioPlayer } from './audio';
import { ItemType } from './item'; // Import ItemType
import { Tree } from './tree'; // Import Tree for instanceof check
import { House } from './house'; // Import House type if needed

// Define a simple structure for collision checks
interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}


export class GameplayController {
    private closestPickupItem: DroppedItem | null = null;
    private readonly pickupRange: number = 50; // Max distance to show pickup prompt (Squared later)
    private lastActionTime: number = 0;
    private readonly actionCooldown: number = 500; // Milliseconds

    constructor(
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
        this.handleMovement(deltaTime);
        this.handleToolUsage();
        this.handleItemPickup();
        this.handleItemDrop();

        // Update closest item for UI prompt (could be moved to a separate UI controller later)
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

        // --- Terrain Collision Check ---
        const targetGridX = Math.floor(proposedX / this.tileSize);
        const targetGridY = Math.floor(proposedY / this.tileSize);
        const canMoveToTile = this.terrainManager.isWalkable(targetGridX, targetGridY);

        let finalX = oldX;
        let finalY = oldY;

        if (canMoveToTile) {
            finalX = proposedX;
            finalY = proposedY;
             // Apply boundaries *after* terrain check, *before* object check
             const clampedPos = this.clampToBoundaries({ x: finalX, y: finalY, width: this.player.width, height: this.player.height });
             finalX = clampedPos.x;
             finalY = clampedPos.y;
        } else {
            // Prevent movement into non-walkable terrain
             finalX = oldX;
             finalY = oldY;
            // TODO: Implement sliding logic against walls/terrain later if desired
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

                 if (this.checkCollision(playerBounds, objBounds)) {
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

        // --- Door Entry Check (New) ---
        // Check *after* final position is set, independent of collision blocking
        this.checkDoorEntry(); 
    }

    // --- Door Entry Check Method (New) ---
    private checkDoorEntry(): void {
        for (const obj of this.entityManager.staticObjects) {
            if (obj instanceof House) {
                const house = obj;
                // Estimate door bounds, ensuring calculation MATCHES debug visual in scene.ts
                const doorWidth = house.width / 4;
                const doorTopMargin = 15; // How far inside the house the detection starts
                const doorBottomMargin = 60; // INCREASED: How far below the house the detection ends
                const doorXOffset = 20; // Horizontal offset

                const houseBottomY = house.y + house.height / 2;
                const doorTopY = houseBottomY - doorTopMargin;
                const doorBottomY = houseBottomY + doorBottomMargin;
                const doorHeight = doorBottomY - doorTopY; // Effective detection height

                const doorX = house.x - doorWidth / 2 + doorXOffset; 
                const doorBounds: BoundingBox = { x: doorX, y: doorTopY, width: doorWidth, height: doorHeight }; 
                
                // Use player's *current* center position
                const playerCenterX = this.player.x;
                const playerCenterY = this.player.y;
                
                // REMOVED DEBUGGING
                // console.log(`House Check: BottomY=${houseBottomY.toFixed(1)}`);
                // console.log(`  Door Check: X=[${doorBounds.x.toFixed(1)}, ${(doorBounds.x + doorBounds.width).toFixed(1)}], Y=[${doorBounds.y.toFixed(1)}, ${(doorBounds.y + doorBounds.height).toFixed(1)}] (TopY=${doorTopY.toFixed(1)}, BottomY=${doorBottomY.toFixed(1)})`);
                // console.log(`  Player Center: x=${playerCenterX.toFixed(1)}, y=${playerCenterY.toFixed(1)}`);

                if (
                    playerCenterX >= doorBounds.x && playerCenterX <= doorBounds.x + doorBounds.width &&
                    playerCenterY >= doorBounds.y && playerCenterY <= doorBounds.y + doorBounds.height // Check within the full height
                ) {
                    console.log(`Player IS INSIDE door bounds of House at (${house.x.toFixed(0)}, ${house.y.toFixed(0)})!`);
                    // Scene transition logic will go here later.
                    // Potentially add a small cooldown or flag to prevent rapid re-entry?
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

} 
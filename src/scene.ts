import { Renderer } from './renderer';
import { InputHandler } from './input';
import { AssetLoader } from './assets';
import { Player } from './player';
import { Tree } from './tree';
import { House } from './house';
import { PlaceableObjectType, PLACEABLE_OBJECT_CONFIG } from './game';
import { saveSceneState, loadSceneState } from './db';
import { Item, ItemType, getItemConfig } from './item'; // Import Item types and getter
import { AudioPlayer } from './audio'; // Import AudioPlayer

// --- Dropped Item Structure ---
export interface DroppedItem {
    itemConfig: Item; // Reference to the item config
    x: number;
    y: number;
    quantity: number; // Usually 1 for non-stackable on ground, but allows potential stacking
}
// --- End Dropped Item Structure ---

// Define structure for saved objects
interface SavedObjectState {
    type: PlaceableObjectType;
    x: number;
    y: number;
    currentHealth?: number; // Optional health
}

// This interface should match the structure used in db.ts save/load helpers
// It doesn't need the 'id' property itself, that's handled by the keyPath/key
interface SavedSceneState {
    objects: SavedObjectState[];
    droppedItems?: Array<{itemId: string, x: number, y: number, quantity: number}>;
    // Could add other scene-specific data here later (e.g., background type)
}

export abstract class Scene {
    protected renderer: Renderer;
    protected inputHandler: InputHandler;
    protected assetLoader: AssetLoader;
    protected player: Player;
    protected audioPlayer: AudioPlayer; // Add AudioPlayer
    protected readonly sceneId: string;
    
    // Maybe add generic game object list later
    // protected gameObjects: any[] = [];

    constructor(sceneId: string, renderer: Renderer, inputHandler: InputHandler, assetLoader: AssetLoader, player: Player, audioPlayer: AudioPlayer) {
        this.sceneId = sceneId;
        this.renderer = renderer;
        this.inputHandler = inputHandler;
        this.assetLoader = assetLoader;
        this.player = player;
        this.audioPlayer = audioPlayer; // Store AudioPlayer
    }

    public getId(): string {
        return this.sceneId;
    }

    abstract load(): Promise<void>;
    abstract update(deltaTime: number, creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType): void;
    abstract draw(creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType): void;
}

export class GameScene extends Scene {
    private staticObjects: (Tree | House)[] = [];
    private droppedItems: DroppedItem[] = []; // List of items on the ground
    private groundPattern: CanvasPattern | null = null;
    private readonly worldWidth: number = 1500; // Example world width
    private readonly worldHeight: number = 1500; // Example world height

    // --- Interaction Properties --- 
    private closestPickupItem: DroppedItem | null = null;
    private readonly pickupRange: number = 50; // Max distance to show pickup prompt
    // --- End Interaction Properties ---

    // --- Action Cooldown --- 
    private lastActionTime: number = 0;
    private readonly actionCooldown: number = 500; // Milliseconds between actions (e.g., axe swings)
    // --- End Action Cooldown ---

    constructor(sceneId: string, renderer: Renderer, inputHandler: InputHandler, assetLoader: AssetLoader, player: Player, audioPlayer: AudioPlayer) {
        super(sceneId, renderer, inputHandler, assetLoader, player, audioPlayer); // Pass audioPlayer to parent
    }

    async load(): Promise<void> {
        // Load assets specific to this scene (trees, ground pattern)
        const treeSvgPath = PLACEABLE_OBJECT_CONFIG['Tree'].assetPath;
        const houseSvgPath = PLACEABLE_OBJECT_CONFIG['House'].assetPath;
        const groundPatternPath = '/assets/svg/ground-pattern.svg';
        
        try {
            // Load scene object images
            await this.assetLoader.loadImages([treeSvgPath, houseSvgPath]);

            // Load ground pattern image
            const groundPatternImg = await this.assetLoader.loadImage(groundPatternPath);
            this.groundPattern = this.renderer.getContext().createPattern(groundPatternImg, 'repeat');

            // Attempt to load saved state asynchronously
            const loadedSuccessfully = await this.loadState(); // Now async

            // Populate the scene with defaults ONLY if no save data was loaded
            if (!loadedSuccessfully) {
                this.populateTrees(15); 
                console.log('GameScene loaded and populated with defaults.');
            }

        } catch (error) {
            console.error("Failed to load GameScene assets or populate:", error);
        }
    }

    update(deltaTime: number, creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType): void {
        if (creativeModeEnabled) {
            // Handle creative mode logic (placing/removing)
            this.handleCreativeModeInput(selectedObjectType);
        } else {
            // Handle normal gameplay logic (player movement/collision)
            this.handleGameplayInput(deltaTime);
        }
        // Always update player rotation
        this.player.update(deltaTime, this.inputHandler.mousePosition);
        
        // --- Update Camera --- 
        this.updateCameraPosition();

        // --- Handle Item Pickup Prompt Logic ---
        this.updateClosestPickupItem(); 
    }

    draw(creativeModeEnabled: boolean, selectedObjectType: PlaceableObjectType): void {
        this.renderer.clear();
        const ctx = this.renderer.getContext();

        // --- Apply Camera Transform --- 
        ctx.save();
        ctx.translate(-this.renderer.cameraX, -this.renderer.cameraY);

        // --- Draw World Elements (relative to world coords) --- 
        // Draw background
        this.renderer.drawBackground(this.groundPattern, this.worldWidth, this.worldHeight);

        // Draw static objects FIRST (now they can be behind player)
        this.staticObjects.forEach(obj => {
            const objImg = this.assetLoader.getImage(obj.svgPath);
            if (objImg) {
                this.renderer.drawImage(objImg, obj.x, obj.y, obj.width, obj.height);
            }
            // --- Draw Tree Health Bar --- 
            if (obj instanceof Tree && obj.state === 'STANDING' && obj.currentHealth < obj.maxHealth) {
                this.renderer.drawHealthBar(obj.x, obj.y, obj.width, obj.currentHealth, obj.maxHealth);
            }
            // --- End Draw Tree Health Bar ---
        });

        // --- Draw Dropped Items --- 
        this.droppedItems.forEach(itemDrop => {
            const itemImg = this.assetLoader.getImage(itemDrop.itemConfig.assetPath);
            if (itemImg) {
                 // Draw slightly smaller than original? Or use fixed size?
                 const dropWidth = itemImg.naturalWidth * 0.8;
                 const dropHeight = itemImg.naturalHeight * 0.8;
                 this.renderer.drawImage(itemImg, itemDrop.x, itemDrop.y, dropWidth, dropHeight); 
            } else {
                // Placeholder if image not loaded
                this.renderer.drawPlaceholder(itemDrop.x, itemDrop.y, 'orange'); 
            }
        });
        // --- End Draw Dropped Items ---

        // --- Draw Pickup Prompt --- 
        if (this.closestPickupItem) {
            const item = this.closestPickupItem;
            const itemImg = this.assetLoader.getImage(item.itemConfig.assetPath);
            if (itemImg) {
                 const dropWidth = itemImg.naturalWidth * 0.8;
                 const dropHeight = itemImg.naturalHeight * 0.8;
                 const promptText = `E - Pick up ${item.itemConfig.name}`;
                 this.renderer.drawPickupPrompt(promptText, item.x, item.y, dropWidth, dropHeight);
            }
        }
        // --- End Draw Pickup Prompt ---

        // Draw Player 
        const playerImg = this.assetLoader.getImage(this.player.svgPath);
        if (playerImg) {
            // Revert: Use player rotation directly, assuming SVG points up
            this.renderer.drawImage(playerImg, this.player.x, this.player.y, this.player.width, this.player.height, this.player.rotation);
        } else {
            this.renderer.drawPlaceholder(this.player.x, this.player.y, 'lime');
        }

        // --- Draw Equipped Item (e.g., Axe) --- 
        const equippedItem = this.player.getEquippedItem();
        if (equippedItem && !creativeModeEnabled) { // Only draw if equipped and not in creative mode
            const itemImg = this.assetLoader.getImage(equippedItem.assetPath);
            if (itemImg) {
                let itemRotation = this.player.rotation;
                // Offset relative to player facing UP (0 rotation)
                const holdOffsetAngle = Math.PI / 4; // 45 degrees held angle
                const holdOffsetX = 22; // Even further to the right of center
                const holdOffsetY = -15; // Further FORWARD of center (negative Y is up)

                if (this.player.isSwinging && equippedItem.itemType === ItemType.TOOL) { // Check if it's a tool for swinging
                    // Apply swing animation angle offset
                    itemRotation += this.player.getSwingAngleOffset();
                } else {
                    // Apply basic holding angle
                    itemRotation += holdOffsetAngle;
                }

                // Calculate position relative to player center and rotation
                // Rotate the base offset by player's rotation
                const playerRotationRad = this.player.rotation;
                const rotatedOffsetX = Math.cos(playerRotationRad) * holdOffsetX - Math.sin(playerRotationRad) * holdOffsetY;
                const rotatedOffsetY = Math.sin(playerRotationRad) * holdOffsetX + Math.cos(playerRotationRad) * holdOffsetY;

                const itemX = this.player.x + rotatedOffsetX;
                const itemY = this.player.y + rotatedOffsetY;

                // Use item's natural dimensions (or define specific ones later)
                const itemWidth = itemImg.naturalWidth * 0.8; // Slightly smaller?
                const itemHeight = itemImg.naturalHeight * 0.8;

                this.renderer.drawImage(itemImg, itemX, itemY, itemWidth, itemHeight, itemRotation);
            }
        }
        // --- End Draw Equipped Item ---

        // Draw NPCs later
        // Draw other world elements later (items, effects)

        // --- Draw UI/Overlay Elements within World Transform --- 
        // Draw creative mode overlay if enabled
        if (creativeModeEnabled) {
            // Pass selectedObjectType down
            this.drawCreativeModeOverlay(selectedObjectType); 
        }

        // --- Restore Transform (back to screen coords) --- 
        ctx.restore();
        
        // --- Draw UI Elements (relative to screen coords) ---
        // IMPORTANT: Any UI drawn here needs to use SCREEN coordinates.
        // Example: A minimap, health bar, fixed menus would go here.
        // Currently, the creative mode text is handled inside the overlay 
        // drawing logic for simplicity, but could be moved here if needed.
    }

    // --- Camera Update Logic ---
    private updateCameraPosition(): void {
        const viewportWidth = this.renderer.getWidth();
        const viewportHeight = this.renderer.getHeight();

        // Calculate ideal target camera position to center player
        const targetCameraX = this.player.x - viewportWidth / 2;
        const targetCameraY = this.player.y - viewportHeight / 2;

        let finalCameraX: number;
        let finalCameraY: number;

        // Determine final X position
        if (viewportWidth >= this.worldWidth) {
            // Center world horizontally if viewport is wider than world
            finalCameraX = (this.worldWidth - viewportWidth) / 2;
        } else {
            // Clamp camera X to world boundaries if viewport is narrower
            finalCameraX = Math.max(0, Math.min(targetCameraX, this.worldWidth - viewportWidth));
        }

        // Determine final Y position
        if (viewportHeight >= this.worldHeight) {
            // Center world vertically if viewport is taller than world
            finalCameraY = (this.worldHeight - viewportHeight) / 2;
        } else {
            // Clamp camera Y to world boundaries if viewport is shorter
            finalCameraY = Math.max(0, Math.min(targetCameraY, this.worldHeight - viewportHeight));
        }

        // TODO: Add smoothing/lerping later if desired (apply *before* final update)

        // Update the renderer's camera position
        this.renderer.updateCamera(finalCameraX, finalCameraY);
    }

    // --- End Camera Update Logic ---

    // --- Helper methods for splitting logic ---

    private handleGameplayInput(deltaTime: number): void {
        // --- Handle Movement ---
        const { dx, dy } = this.inputHandler.getMovementDirection();
        if (dx !== 0 || dy !== 0) {
            const oldX = this.player.x;
            const oldY = this.player.y;
            this.player.move(dx * deltaTime * 60, dy * deltaTime * 60); // Adjust speed based on deltaTime

            // Check boundaries after calculating new position
            this.checkBoundaries(this.player);

            // Check collision with static objects AFTER boundary check
            let collision = false;
            for (const obj of this.staticObjects) {
                // Ignore collision with falling trees
                if (obj instanceof Tree && obj.state === 'FALLING') {
                    continue;
                }
                if (this.checkCollision(this.player, obj)) {
                    collision = true;
                    break;
                }
            }

            // If collision, revert movement
            if (collision) {
                this.player.x = oldX;
                this.player.y = oldY;
            }
        }

        // --- Handle Tool Usage (e.g., Axe Swing) ---
        if (this.inputHandler.useToolPressed) {
            const now = Date.now();
            if (now - this.lastActionTime >= this.actionCooldown) {
                this.lastActionTime = now;

                const equippedItem = this.player.getEquippedItem();
                if (equippedItem && equippedItem.itemType === ItemType.TOOL && equippedItem.id === 'axe') {
                    console.log("Axe Swing Attempt");
                    this.player.startSwing(); // Start swing animation regardless of hit

                    // Define hitbox based on player position and rotation
                    const reachDistance = 50; // How far the axe reaches
                    const hitboxWidth = 20;
                    const hitboxHeight = 20;

                    // Calculate position in front of the player
                    const angle = this.player.rotation - Math.PI / 2; // Adjust rotation to match world coords
                    const hitboxX = this.player.x + Math.cos(angle) * reachDistance - hitboxWidth / 2;
                    const hitboxY = this.player.y + Math.sin(angle) * reachDistance - hitboxHeight / 2;

                    let hitTree: Tree | null = null;
                    for (const obj of this.staticObjects) {
                        if (obj instanceof Tree && obj.state === 'STANDING') { // Only hit standing trees
                            if (this.checkCollision({ x: hitboxX, y: hitboxY, width: hitboxWidth, height: hitboxHeight }, obj)) {
                                hitTree = obj;
                                break;
                            }
                        }
                    }

                    if (hitTree) {
                        console.log("Hit Tree!");
                        this.audioPlayer.play('axe-hit'); // Play hit sound
                        hitTree.takeDamage(25); // Example damage
                        console.log(`Tree health: ${hitTree.currentHealth}/${hitTree.maxHealth}`);

                        if (hitTree.currentHealth <= 0) {
                            console.log("Tree Felled!");
                            hitTree.state = 'FALLING'; // Mark as falling
                            this.audioPlayer.play('tree-fall'); // Play fall sound
                            // Schedule destruction and log spawning after a delay
                            setTimeout(() => this.destroyTreeAndSpawnLogs(hitTree!), 1000); // 1 second delay
                        }
                    } else {
                        console.log("Axe Missed!");
                        this.audioPlayer.play('axe-miss'); // Play miss sound
                    }
                } else if (equippedItem) {
                    console.log(`Cannot use item '${equippedItem.name}' as a tool.`);
                    // Maybe play a different sound?
                } else {
                    console.log("Cannot use tool, nothing equipped.");
                    // Play an 'empty hand' sound?
                }
            } else {
                // console.log("Action on cooldown"); // Optional: feedback for cooldown
            }
        } // End Tool Usage

        // --- Handle Item Pickup ---
        this.handleItemPickup();

        // --- Handle Item Drop ---
        if (this.inputHandler.dropItemPressed) {
            const droppedItemId = this.player.dropEquippedItem();
            if (droppedItemId) {
                const itemConfig = getItemConfig(droppedItemId);
                if (itemConfig) {
                    // Spawn item slightly in front of the player
                    const dropDistance = 30; // Distance in front
                    const angle = this.player.rotation - Math.PI / 2; // Adjust rotation
                    const dropX = this.player.x + Math.cos(angle) * dropDistance;
                    const dropY = this.player.y + Math.sin(angle) * dropDistance;
                    
                    // Use the new reusable method
                    this.spawnDroppedItem(droppedItemId, dropX, dropY, 1);
                    
                    // Potentially trigger save state here? Or rely on manual/periodic save.
                } else {
                    // This case should be less likely now since dropEquippedItem ensures it exists
                    console.error(`Could not find config for dropped item ID: ${droppedItemId}`);
                }
            }
            // No 'else' needed, dropEquippedItem handles 'nothing equipped' case
        } // End Item Drop
    }

    /**
     * Spawns a dropped item in the world at the specified location.
     * @param itemId The ID of the item to drop.
     * @param x World x-coordinate to drop at.
     * @param y World y-coordinate to drop at.
     * @param quantity The number of items in the drop.
     */
    public spawnDroppedItem(itemId: string, x: number, y: number, quantity: number): void {
        const itemConfig = getItemConfig(itemId);
        if (itemConfig) {
            const droppedItem: DroppedItem = {
                itemConfig: itemConfig,
                x: x,
                y: y,
                quantity: quantity
            };
            this.droppedItems.push(droppedItem);
            console.log(`Spawned ${quantity} ${itemConfig.name}(s) at (${x.toFixed(1)}, ${y.toFixed(1)})`);
            this.audioPlayer.play('item-drop');
        } else {
            console.error(`Could not find config for dropped item ID: ${itemId}`);
        }
    }

    private destroyTreeAndSpawnLogs(treeToDestroy: Tree): void {
        console.log(`Destroying fallen tree at (${treeToDestroy.x.toFixed(0)}, ${treeToDestroy.y.toFixed(0)})`);
        const destroyedTreeX = treeToDestroy.x;
        const destroyedTreeY = treeToDestroy.y;

        // Remove the tree from static objects
        this.staticObjects = this.staticObjects.filter(obj => obj !== treeToDestroy);
        console.log("Fallen tree removed from scene.");
        
        // Spawn WoodLog Item (copied from previous location)
        const logConfig = getItemConfig('wood_log');
        if (logConfig) {
            const dropQuantity = 1; // Drop one log for now
            const droppedLog: DroppedItem = {
                itemConfig: logConfig,
                x: destroyedTreeX,
                y: destroyedTreeY,
                quantity: dropQuantity
            };
            this.droppedItems.push(droppedLog);
            console.log(`Dropped ${dropQuantity} ${logConfig.name} at (${destroyedTreeX.toFixed(0)}, ${destroyedTreeY.toFixed(0)})`);
            // Ensure log asset is loaded (might be loaded already)
            this.assetLoader.loadImages([logConfig.assetPath]);
        } else {
            console.error("Could not find item config for 'wood_log' to drop!");
        }
    }

    // Calculates the closest item within pickup range for UI prompt
    private updateClosestPickupItem(): void {
        let closestDistSq = this.pickupRange * this.pickupRange; // Check squared distance
        this.closestPickupItem = null; // Reset each frame

        for (const item of this.droppedItems) {
            const dx = this.player.x - item.x;
            const dy = this.player.y - item.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < closestDistSq) {
                closestDistSq = distSq;
                this.closestPickupItem = item;
            }
        }
    }

    // Handles actually picking up an item when Interact is pressed
    private handleItemPickup(): void {
        if (this.inputHandler.interactPressed && this.closestPickupItem) {
            // Attempt to add to player inventory
            const success = this.player.addItem(this.closestPickupItem.itemConfig.id, this.closestPickupItem.quantity);
            if (success) {
                // Remove from world
                const index = this.droppedItems.indexOf(this.closestPickupItem);
                if (index > -1) {
                    this.droppedItems.splice(index, 1);
                    console.log(`Picked up ${this.closestPickupItem.itemConfig.name}`);
                    // Play pickup sound
                    this.audioPlayer.play('pickup'); // Assume 'pickup.mp3' exists and is loaded
                    this.closestPickupItem = null; // Clear the prompt
                }
            } else {
                console.log(`Inventory full, cannot pick up ${this.closestPickupItem.itemConfig.name}`);
                // Optional: Play a 'cannot pickup' sound or show message
            }
        }
    }

    // Handles placing/removing objects in creative mode
    private handleCreativeModeInput(selectedObjectType: PlaceableObjectType): void {
        const mouseWorldX = this.inputHandler.mousePosition.x;
        const mouseWorldY = this.inputHandler.mousePosition.y;

        // --- Handle Deletion (if Delete key is held while hovering) ---
        if (this.inputHandler.deletePressed) {
            let objectToRemove: Tree | House | null = null;
            for (const obj of this.staticObjects) {
                // Bounding box check for hover
                if (mouseWorldX >= obj.x - obj.width / 2 && mouseWorldX <= obj.x + obj.width / 2 &&
                    mouseWorldY >= obj.y - obj.height / 2 && mouseWorldY <= obj.y + obj.height / 2) {
                    objectToRemove = obj; // Found object under cursor
                    break;
                }
            }
            // If hovering over an object, remove it
            if (objectToRemove) {
                this.removeObjectAt(objectToRemove.x, objectToRemove.y, this.staticObjects);
                // Early exit? If we successfully deleted, maybe don't process placement click in same frame?
                // Alternatively, the placement logic below already checks `!clickedExisting` which might suffice.
            }
        }

        // --- Handle Placement (if mouse is clicked and not over existing) ---
        if (this.inputHandler.mouseClicked) {
            // Check if clicking on an existing object (to prevent placement on top)
            let clickedExisting = false;
            for (const obj of this.staticObjects) {
                 if (mouseWorldX >= obj.x - obj.width / 2 && mouseWorldX <= obj.x + obj.width / 2 &&
                     mouseWorldY >= obj.y - obj.height / 2 && mouseWorldY <= obj.y + obj.height / 2) {
                     clickedExisting = true;
                     break;
                 }
            }

            // If not clicking an existing object AND a type is selected, place it
            if (!clickedExisting && selectedObjectType) {
                this.placeObjectAt(mouseWorldX, mouseWorldY, selectedObjectType);
            }
        }
    }

    private placeObjectAt(x: number, y: number, selectedObjectType: PlaceableObjectType): void {
        const assetPath = PLACEABLE_OBJECT_CONFIG[selectedObjectType].assetPath;
        const objImg = this.assetLoader.getImage(assetPath);
        if (!objImg) return; // Ensure asset is loaded

        const objWidth = objImg.naturalWidth;
        const objHeight = objImg.naturalHeight;
        
        // Basic check: Don't place directly on player (optional)
        // if (this.checkCollision({x, y, width: objWidth, height: objHeight}, this.player)) return;

        let newObject: Tree | House;
        if (selectedObjectType === 'Tree') {
            newObject = new Tree(x, y, objWidth, objHeight);
        } else if (selectedObjectType === 'House') {
            newObject = new House(x, y, objWidth, objHeight);
        } else {
            console.warn('Attempted to place unknown object type:', selectedObjectType);
            return;
        }
        
        this.staticObjects.push(newObject);
        console.log(`Placed ${selectedObjectType} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    private removeObjectAt(x: number, y: number, objectList: (Tree | House)[]): void {
        let removed = false;
        this.staticObjects = objectList.filter(obj => {
            // Check if mouse (x,y) is within the object's bounds
            const halfWidth = obj.width / 2;
            const halfHeight = obj.height / 2;
            const isInside = (
                x >= obj.x - halfWidth && x <= obj.x + halfWidth &&
                y >= obj.y - halfHeight && y <= obj.y + halfHeight
            );
            if (isInside && !removed) { // Remove only the first object found under cursor
                console.log(`Removed object at (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`);
                removed = true;
                return false; // Filter out this object
            }
            return true; // Keep other objects
        });
    }

    private drawCreativeModeOverlay(selectedObjectType: PlaceableObjectType): void {
        const mouseX = this.inputHandler.mousePosition.x;
        const mouseY = this.inputHandler.mousePosition.y;
        
        // Determine asset path based on selection
        const assetPath = PLACEABLE_OBJECT_CONFIG[selectedObjectType].assetPath;
        const ghostImg = this.assetLoader.getImage(assetPath);

        // Draw placement preview (ghost object)
        if (ghostImg) {
            const objWidth = ghostImg.naturalWidth;
            const objHeight = ghostImg.naturalHeight;
            this.renderer.drawGhostImage(ghostImg, mouseX, mouseY, objWidth, objHeight);
        }

        // Highlight object under cursor for removal - check staticObjects
        this.staticObjects.forEach(obj => {
            const halfWidth = obj.width / 2;
            const halfHeight = obj.height / 2;
            const isInside = (
                mouseX >= obj.x - halfWidth && mouseX <= obj.x + halfWidth &&
                mouseY >= obj.y - halfHeight && mouseY <= obj.y + halfHeight
            );
            if (isInside) {
                this.renderer.drawHighlight(obj.x, obj.y, obj.width, obj.height);
            }
        });
        
        // Draw text indicator - Adjust position based on camera
        const helpText = `Creative Mode [C:Toggle|1:Tree|2:House|Click:Place|Del:Remove] | Sel: ${selectedObjectType}`;
        // Draw text relative to camera's top-left view
        this.renderer.drawText(helpText, this.renderer.cameraX + 10, this.renderer.cameraY + 10, 'white', '14px Arial');
    }

    private populateTrees(count: number): void {
        const treeImg = this.assetLoader.getImage(PLACEABLE_OBJECT_CONFIG['Tree'].assetPath);
        if (!treeImg) return; // Can't place trees if asset not loaded

        const treeWidth = treeImg.naturalWidth;
        const treeHeight = treeImg.naturalHeight;
        const spawnWidth = this.worldWidth;
        const spawnHeight = this.worldHeight;
        const padding = 50; // Prevent trees spawning too close to edge or player start

        for (let i = 0; i < count; i++) {
            let x, y, validPosition;
            do {
                validPosition = true;
                x = Math.random() * (spawnWidth - treeWidth - padding * 2) + padding + treeWidth / 2;
                y = Math.random() * (spawnHeight - treeHeight - padding * 2) + padding + treeHeight / 2;

                // Simple check to avoid spawning directly on player start (center of the *world* now?)
                const distToCenter = Math.sqrt(Math.pow(x - spawnWidth/2, 2) + Math.pow(y - spawnHeight/2, 2));
                if (distToCenter < padding * 3) { // Increase padding check near world center
                    validPosition = false;
                    continue;
                }
                
                // TODO: Add collision check with other trees if needed

            } while (!validPosition);
            
            this.staticObjects.push(new Tree(x, y, treeWidth, treeHeight));
        }
    }
    
    private checkBoundaries(player: Player): void {
        const worldWidth = this.worldWidth;
        const worldHeight = this.worldHeight;
        const halfWidth = player.width / 2;
        const halfHeight = player.height / 2;

        // Left boundary
        if (player.x < halfWidth) {
            player.x = halfWidth;
        }
        // Right boundary
        if (player.x > worldWidth - halfWidth) {
            player.x = worldWidth - halfWidth;
        }
        // Top boundary
        if (player.y < halfHeight) {
            player.y = halfHeight;
        }
        // Bottom boundary
        if (player.y > worldHeight - halfHeight) {
            player.y = worldHeight - halfHeight;
        }
    }

    // Simple AABB collision check helper
    private checkCollision(rect1: {x: number, y: number, width: number, height: number}, 
                           rect2: {x: number, y: number, width: number, height: number}): boolean {
        const halfWidth1 = rect1.width / 2;
        const halfHeight1 = rect1.height / 2;
        const halfWidth2 = rect2.width / 2;
        const halfHeight2 = rect2.height / 2;

        return (
            rect1.x - halfWidth1 < rect2.x + halfWidth2 &&
            rect1.x + halfWidth1 > rect2.x - halfWidth2 &&
            rect1.y - halfHeight1 < rect2.y + halfHeight2 &&
            rect1.y + halfHeight1 > rect2.y - halfHeight2
        );
    }

    // Type Predicate function
    private isPlaceableObjectType(type: any): type is PlaceableObjectType {
        return type === 'Tree' || type === 'House';
    }

    // --- Save/Load Logic ---

    // Make saveState async
    async saveState(): Promise<void> {
        console.log(`Attempting to save scene [${this.sceneId}]...`);
        try {
            const savedObjects: SavedObjectState[] = this.staticObjects.map(obj => {
                let type: PlaceableObjectType;
                let state: Partial<SavedObjectState> = { x: obj.x, y: obj.y }; // Use Partial for flexibility

                if (obj instanceof Tree) {
                    type = 'Tree';
                    state.currentHealth = obj.currentHealth; // Save current health
                } else if (obj instanceof House) {
                    type = 'House';
                    // Houses don't have health currently
                } else {
                    console.warn('Unknown object type during save:', obj);
                    return null; // Skip unknown objects
                }
                state.type = type; // Add type
                return state as SavedObjectState; // Assert to full type
            }).filter(obj => obj !== null) as SavedObjectState[]; // Filter out nulls

            // Serialize dropped items
            const savedDroppedItems = this.droppedItems.map(drop => ({
                itemId: drop.itemConfig.id,
                x: drop.x,
                y: drop.y,
                quantity: drop.quantity
            }));

            const sceneState: SavedSceneState = { 
                objects: savedObjects,
                droppedItems: savedDroppedItems // Add serialized items
            };
            
            // Call the async DB helper
            await saveSceneState(this.sceneId, sceneState); 
            // Log success moved to db helper

        } catch (error) {
            console.error(`Failed to save scene state for [${this.sceneId}]:`, error);
        }
    }

    // Make loadState async and use DB helper
    // Returns true if load was successful, false otherwise
    async loadState(): Promise<boolean> { 
        console.log(`Attempting to load scene [${this.sceneId}] from DB...`);
        try {
            // Ensure the loaded state matches the potentially extended structure
            interface SavedObjectState {
                type: PlaceableObjectType;
                x: number;
                y: number;
                currentHealth?: number; // Optional health
            }
            interface SavedSceneState {
                objects: SavedObjectState[];
                droppedItems?: Array<{itemId: string, x: number, y: number, quantity: number}>;
            }

            // Call the async DB helper (assuming db.ts returns the correct structure)
            const loadedState = await loadSceneState(this.sceneId) as SavedSceneState | null;

            if (!loadedState) {
                console.log(`No saved state found for scene [${this.sceneId}].`);
                return false;
            }

            // Basic validation (check if it has an objects array)
            if (!loadedState || !Array.isArray(loadedState.objects)) {
                console.error(`Invalid saved scene state format for [${this.sceneId}].`);
                // Consider deleting invalid data? 
                // await deleteSceneState(this.sceneId); // If we add a delete helper
                return false;
            }

            console.log(`Loading ${loadedState.objects.length} objects for scene [${this.sceneId}]...`);
            this.staticObjects = []; // Clear existing objects

            // Clear existing dropped items before loading
            this.droppedItems = []; 

            // Pre-check assets needed based on loaded data
            const requiredAssets = new Set<string>();
            loadedState.objects.forEach(obj => {
                // Use the type predicate here for initial check
                if (this.isPlaceableObjectType(obj.type)) {
                    const path = PLACEABLE_OBJECT_CONFIG[obj.type]?.assetPath;
                    if (path) requiredAssets.add(path);
                } else {
                    console.warn(`Invalid object type found during asset pre-check: ${obj.type}`);
                }
            });
            // Also check assets for dropped items
            if (loadedState.droppedItems) {
                loadedState.droppedItems.forEach(itemData => {
                    const itemConfig = getItemConfig(itemData.itemId);
                    if (itemConfig) {
                        requiredAssets.add(itemConfig.assetPath);
                    } else {
                        console.warn(`Asset path not found for saved dropped item ID: ${itemData.itemId}`);
                    }
                });
            }

            // Ensure required assets are loaded *before* creating objects
            // Note: Assumes assets needed are already loaded by GameScene.load, 
            // but this adds safety if loadState was called independently.
            await this.assetLoader.loadImages(Array.from(requiredAssets));

            for (const savedObj of loadedState.objects) {
                // Use the type predicate again before accessing config/creating objects
                if (!this.isPlaceableObjectType(savedObj.type)) {
                    // Warning already logged during asset check, maybe skip logging here
                    continue;
                }
                
                // Now TypeScript knows savedObj.type is PlaceableObjectType
                const assetPath = PLACEABLE_OBJECT_CONFIG[savedObj.type]?.assetPath;
                // Asset should be loaded due to pre-check, but check path again just in case
                if (!assetPath) {
                    // This check is likely redundant now due to the type guard, but safe to keep
                    console.warn(`Asset path not found for saved object type: ${savedObj.type}`);
                    continue;
                }

                const objImg = this.assetLoader.getImage(assetPath);
                if (!objImg) {
                    console.warn(`Asset not found for saved object type: ${savedObj.type}`);
                    continue;
                }

                const objWidth = objImg.naturalWidth;
                const objHeight = objImg.naturalHeight;
                let newObject: Tree | House | null = null;

                if (savedObj.type === 'Tree') {
                    // Use actual loaded dimensions
                    // Pass saved health if available, otherwise default in Tree constructor works
                    newObject = new Tree(savedObj.x, savedObj.y, objWidth, objHeight, undefined, savedObj.currentHealth);
                    // If health wasn't saved (old format), it will default to max in constructor
                    // If health was saved as 0, it correctly loads as 0
                    console.log(`Loaded Tree with health: ${(newObject as Tree).currentHealth}`);
                } else if (savedObj.type === 'House') {
                    // Use actual loaded dimensions
                    newObject = new House(savedObj.x, savedObj.y, objWidth, objHeight);
                } else {
                     console.warn(`Unknown object type during load: ${savedObj.type}`);
                }

                if (newObject) {
                    // Check type first, then health in nested if
                    if (newObject instanceof Tree) {
                        // Use type assertion as final attempt
                        if ((newObject as Tree).currentHealth <= 0) {
                            console.log(`Skipping already chopped tree at (${newObject.x.toFixed(0)}, ${newObject.y.toFixed(0)})`);
                            // Don't add the object if chopped
                        } else {
                            this.staticObjects.push(newObject); // Add healthy tree
                        }
                    } else {
                        // It's not a Tree (e.g., House), so just add it
                        this.staticObjects.push(newObject);
                    }
                }
            }

            // --- Load Dropped Items --- 
            if (loadedState.droppedItems) {
                console.log(`Loading ${loadedState.droppedItems.length} dropped items...`);
                loadedState.droppedItems.forEach(itemData => {
                    const itemConfig = getItemConfig(itemData.itemId);
                    if (itemConfig) {
                        const loadedDrop: DroppedItem = {
                            itemConfig: itemConfig,
                            x: itemData.x,
                            y: itemData.y,
                            quantity: itemData.quantity
                        };
                        this.droppedItems.push(loadedDrop);
                    } else {
                         console.warn(`Item config not found for saved dropped item ID: ${itemData.itemId}. Skipping drop.`);
                    }
                });
            }
            // --- End Load Dropped Items ---

            return true;
        } catch (error) {
            console.error(`Failed to load scene state for [${this.sceneId}]:`, error);
            return false;
        }
    }
} 
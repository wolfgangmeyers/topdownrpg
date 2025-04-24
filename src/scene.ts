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
        // --- Handle Movement & Collision --- 
        const { dx, dy } = this.inputHandler.getMovementDirection();
        if (dx !== 0 || dy !== 0) {
            // Store original position
            const originalX = this.player.x;
            const originalY = this.player.y;

            // Move on X axis and check collision
            this.player.move(dx, 0);
            let collisionX = false;
            for (const obj of this.staticObjects) {
                // Ignore falling trees for collision
                if (!(obj instanceof Tree && obj.state === 'FALLING') && this.checkCollision(this.player, obj)) {
                    collisionX = true;
                    break;
                }
            }
            if (collisionX) {
                this.player.x = originalX; // Revert X movement
            }

            // Move on Y axis and check collision
            this.player.move(0, dy);
            let collisionY = false;
            for (const obj of this.staticObjects) {
                // Ignore falling trees for collision
                // Use potentially updated player.x for Y check
                if (!(obj instanceof Tree && obj.state === 'FALLING') && this.checkCollision(this.player, obj)) {
                    collisionY = true;
                    break;
                }
            }
            if (collisionY) {
                this.player.y = originalY; // Revert Y movement
            }

            // Check boundaries *after* collision resolution
            this.checkBoundaries(this.player);
        }
        // --- End Movement & Collision ---

        // --- Handle Interactions (Item Pickup) ---
        this.handleItemPickup();
        // --- End Interactions ---

        // --- Handle Tool Usage (Axe Chopping) --- 
        const currentTime = Date.now();
        if (this.inputHandler.useToolPressed && (currentTime - this.lastActionTime > this.actionCooldown)) {
            const equippedItem = this.player.getEquippedItem();

            // Check if the Axe is equipped
            if (equippedItem && equippedItem.id === 'axe') {
                this.lastActionTime = currentTime; // Reset cooldown timer
                console.log("Player attempting to use Axe...");
                this.player.startSwing(); // Start swing animation

                // Define axe properties (get from Item config later if needed)
                const axeDamage = 25; // Health points removed per hit

                // Calculate target point slightly in front of player based on rotation
                // --- Replaced with Axe Hitbox --- 
                const axeHitboxWidth = 20; 
                const axeHitboxHeight = 20;
                const hitDist = 25; // How far in front of player the center of the hitbox is
                // Corrected calculation based on player rotation (0 = up)
                const hitX = this.player.x + Math.sin(this.player.rotation) * hitDist;
                const hitY = this.player.y - Math.cos(this.player.rotation) * hitDist; // Use -cos because Y is inverted
                const axeHitbox = {
                    x: hitX, 
                    y: hitY,
                    width: axeHitboxWidth, 
                    height: axeHitboxHeight
                }; 
                // Optional: Draw hitbox for debugging
                // this.renderer.drawDebugRect(axeHitbox.x, axeHitbox.y, axeHitbox.width, axeHitbox.height, 'red');
                // --- End Axe Hitbox Calc ---

                // Find the first tree that collides with the axe hitbox
                let hitTree: Tree | null = null;

                // Filter for standing trees only
                const treesInScene = this.staticObjects.filter((obj): obj is Tree => obj instanceof Tree && obj.state === 'STANDING');

                for (const tree of treesInScene) {
                    if (this.checkCollision(axeHitbox, tree)) {
                        hitTree = tree;
                        break; // Hit the first tree found
                    }
                }
                // --- End Finding Hit Tree ---

                // If a standing tree is found in range, damage it
                if (hitTree && hitTree.state === 'STANDING') { 
                    // Play hit sound immediately
                    this.audioPlayer.play('axe-hit');

                    // Apply damage
                    (hitTree as Tree).takeDamage(axeDamage);

                    // Check if health is now zero and start falling process
                    if ((hitTree as Tree).currentHealth <= 0) {
                        console.log(`Tree at (${(hitTree as Tree).x.toFixed(0)}, ${(hitTree as Tree).y.toFixed(0)}) starting to fall!`);
                        hitTree.state = 'FALLING'; // Change state
                        this.audioPlayer.play('tree-fall'); // Play fall sound
                        
                        // Schedule destruction and log spawning after a delay
                        const treeToDestroy = hitTree; // Capture the correct tree instance for the timeout
                        setTimeout(() => {
                            this.destroyTreeAndSpawnLogs(treeToDestroy);
                        }, 1000); // 1 second delay
                    }
                } else if (equippedItem && equippedItem.id === 'axe') {
                    // Axe equipped, but missed or hit a non-standing tree
                    console.log("Axe swung, but no standing tree in range.");
                    this.audioPlayer.play('axe-miss'); // Play miss sound
                    this.player.startSwing(); // Start swing animation on miss
                } else {
                    // Player clicked, but no axe equipped or other action
                    console.log("Player action detected, but no axe equipped or cooldown active.");
                }
            }
        }
        // --- End Tool Usage ---
    }

    // --- Tree Destruction and Log Spawning --- 
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
    // --- End Tree Destruction ---

    private handleItemPickup(): void {
        this.closestPickupItem = null; // Reset closest item each frame
        let minDistanceSq = this.pickupRange * this.pickupRange;

        // Find the closest item within pickup range
        this.droppedItems.forEach(itemDrop => {
            const dx = itemDrop.x - this.player.x;
            const dy = itemDrop.y - this.player.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                this.closestPickupItem = itemDrop;
            }
        });

        // If an item is close enough and player presses interact key
        if (this.closestPickupItem && this.inputHandler.interactPressed) {
            // Assign to local constant to help type inference
            const itemToPickup = this.closestPickupItem; 

            // Use type assertions to resolve linter errors
            console.log(`Attempting to pick up ${(itemToPickup as DroppedItem).itemConfig.name}`);
            // Attempt to add to player inventory
            const success = this.player.addItem((itemToPickup as DroppedItem).itemConfig.id, (itemToPickup as DroppedItem).quantity);

            if (success) {
                console.log("Item picked up successfully.");
                // Remove item from the world
                this.droppedItems = this.droppedItems.filter(item => item !== itemToPickup);
                this.closestPickupItem = null; // Clear reference after pickup
            } else {
                console.log("Failed to pick up item (inventory full or other issue).");
                // Optional: Provide feedback to player (e.g., flash inventory UI?)
            }
        }
    }

    private handleCreativeModeInput(selectedObjectType: PlaceableObjectType): void {
        // Placement logic
        if (this.inputHandler.mouseClicked) {
            this.placeObjectAt(this.inputHandler.mousePosition.x, this.inputHandler.mousePosition.y, selectedObjectType);
        }

        // Removal logic
        if (this.inputHandler.deletePressed) {
            this.removeObjectAt(this.inputHandler.mousePosition.x, this.inputHandler.mousePosition.y, this.staticObjects);
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